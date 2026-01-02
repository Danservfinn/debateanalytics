/**
 * Flow Analysis Module - Phase 2 of Traditional Debate Scoring
 *
 * Constructs argument flow from comments using Claude API:
 * - Extracts Toulmin model arguments (claim, warrant, impact)
 * - Classifies positions (PRO/CON)
 * - Links response chains
 * - Identifies dropped arguments
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  FlowArgument,
  FlowComment,
  ArgumentStatus,
  ArgumentEvaluation,
  WarrantType,
  WarrantQuality,
  FlowAnalysisRequest
} from '@/types/debate-scoring'

// =============================================================================
// ANTHROPIC CLIENT
// =============================================================================

let anthropic: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }
  return anthropic
}

/**
 * Strip markdown code blocks from Claude's JSON response
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}

// =============================================================================
// TYPES FOR CLAUDE RESPONSES
// =============================================================================

interface ExtractedArgument {
  claim: string
  warrant: string | null
  impact: string | null
  position: 'pro' | 'con'
  respondsToQuote: string | null  // Quote from parent they're responding to
  warrantType: WarrantType
  isExplicitConcession: boolean
}

interface CommentAnalysis {
  commentId: string
  arguments: ExtractedArgument[]
}

interface ArgumentEvaluationResponse {
  claimClarity: number
  claimRelevance: number
  warrantPresent: boolean
  warrantType: WarrantType
  warrantQuality: {
    sourceCredibility: number
    recency: number
    relevance: number
    sufficiency: number
  } | null
  impactMagnitude: number
  impactProbability: number
  impactTimeframe: 'immediate' | 'short-term' | 'long-term' | 'speculative'
  impactReversibility: 'reversible' | 'irreversible' | 'unknown'
  internalLinkStrength: number
  overallStrength: number
}

// =============================================================================
// ARGUMENT EXTRACTION - Claude API Call
// =============================================================================

/**
 * Extract Toulmin-model arguments from a batch of comments
 * Uses Claude to identify claims, warrants, and impacts
 */
export async function extractArgumentsFromComments(
  comments: FlowComment[],
  centralQuestion: string,
  positionDefinitions?: {
    proDefinition: string
    conDefinition: string
  }
): Promise<CommentAnalysis[]> {
  if (comments.length === 0) return []

  const client = getAnthropicClient()
  const results: CommentAnalysis[] = []

  // Build comment context including parent text for response linking
  const commentMap = new Map<string, FlowComment>()
  for (const comment of comments) {
    commentMap.set(comment.id, comment)
  }

  // Process in batches of 5 for efficiency while maintaining quality
  const batchSize = 5

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)

    const commentsContext = batch.map((comment, idx) => {
      const parentComment = comment.parentId ? commentMap.get(comment.parentId) : null
      return `
[COMMENT ${idx + 1}]
ID: ${comment.id}
Author: ${comment.author}
${parentComment ? `Replying to: "${parentComment.text.substring(0, 300)}${parentComment.text.length > 300 ? '...' : ''}"` : 'Top-level comment'}
Text: "${comment.text}"
---`
    }).join('\n')

    const prompt = `You are a trained debate judge extracting structured arguments from Reddit comments.

CENTRAL QUESTION: ${centralQuestion}

POSITION DEFINITIONS:
- PRO: ${positionDefinitions?.proDefinition || 'Supports/affirms the proposition'}
- CON: ${positionDefinitions?.conDefinition || 'Opposes/negates the proposition'}

COMMENTS TO ANALYZE:
${commentsContext}

For EACH comment, extract ALL distinct arguments using the Toulmin model:

1. CLAIM: The main assertion being made (one clear sentence)
   - Must be a debatable proposition, not just a question or acknowledgment
   - If the comment makes multiple claims, extract each separately

2. WARRANT: The reasoning or evidence supporting the claim
   - What logic, evidence, or reasoning connects the claim to being true?
   - Can be null if no support is given (bare assertion)
   - Types: empirical (data/studies), testimonial (expert opinion), analogical (comparison),
            logical (deductive/inductive reasoning), experiential (personal experience), none

3. IMPACT: Why this matters for the debate (significance)
   - What happens if this claim is true? Why should we care?
   - Can be null if not stated

4. POSITION: Does this argument support (pro) or oppose (con) the central question?
   - PRO if it affirms/supports the proposition
   - CON if it negates/opposes the proposition

5. RESPONDS_TO_QUOTE: If responding to a specific parent argument, quote the key phrase (max 50 chars)
   - null if making a new standalone argument

6. IS_EXPLICIT_CONCESSION: Is the author explicitly conceding a point to the other side?

IMPORTANT:
- A single comment may contain multiple arguments - extract ALL of them
- Pure questions without assertions are not arguments
- "I agree" without new reasoning is not a distinct argument
- Meta-commentary about the debate is not an argument

Return JSON:
{
  "analyses": [
    {
      "commentId": "<comment id>",
      "arguments": [
        {
          "claim": "<clear one-sentence claim>",
          "warrant": "<supporting reasoning>" | null,
          "impact": "<why this matters>" | null,
          "position": "pro" | "con",
          "respondsToQuote": "<quote from parent>" | null,
          "warrantType": "empirical" | "testimonial" | "analogical" | "logical" | "experiential" | "none",
          "isExplicitConcession": boolean
        }
      ]
    }
  ]
}

Return ONLY valid JSON, no markdown or explanation.`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const parsed = JSON.parse(cleanJsonResponse(content.text)) as {
          analyses: CommentAnalysis[]
        }
        results.push(...parsed.analyses)
      }
    } catch (error) {
      console.error('Argument extraction error:', error)
      // Return empty analyses for failed batch
      for (const comment of batch) {
        results.push({
          commentId: comment.id,
          arguments: []
        })
      }
    }
  }

  return results
}

// =============================================================================
// ARGUMENT EVALUATION - Claude API Call
// =============================================================================

/**
 * Evaluate the strength of extracted arguments
 * Scores each dimension of the Toulmin model
 */
export async function evaluateArguments(
  args: FlowArgument[]
): Promise<Map<string, ArgumentEvaluation>> {
  if (args.length === 0) return new Map()

  const client = getAnthropicClient()
  const results = new Map<string, ArgumentEvaluation>()

  // Process in batches of 3 for detailed evaluation
  const batchSize = 3

  for (let i = 0; i < args.length; i += batchSize) {
    const batch = args.slice(i, i + batchSize)

    const argsContext = batch.map((arg, idx) => `
[ARGUMENT ${idx + 1}]
ID: ${arg.id}
Position: ${arg.position.toUpperCase()}
Claim: "${arg.claim}"
Warrant: ${arg.warrant ? `"${arg.warrant}"` : 'None provided'}
Impact: ${arg.impact ? `"${arg.impact}"` : 'None stated'}
Warrant Type: ${arg.finalEvaluation?.warrantType || 'unknown'}
---`).join('\n')

    const prompt = `You are scoring debate arguments using traditional judging criteria.

ARGUMENTS TO EVALUATE:
${argsContext}

For EACH argument, score on these dimensions (0-10 scale):

CLAIM ANALYSIS:
- claimClarity (0-10): Is the claim specific, falsifiable, and unambiguous?
  * 10: Crystal clear, easily tested/verified
  * 7-9: Clear with minor ambiguity
  * 4-6: Somewhat vague or overly broad
  * 1-3: Very unclear or unfalsifiable
  * 0: Not actually a claim

- claimRelevance (0-10): Does it directly address the central question?
  * 10: Directly addresses the core issue
  * 7-9: Clearly relevant
  * 4-6: Tangentially related
  * 1-3: Barely relevant
  * 0: Off-topic

WARRANT ANALYSIS:
- warrantPresent: Is any reasoning/evidence provided?
- warrantType: empirical/testimonial/analogical/logical/experiential/none
- warrantQuality (if present):
  * sourceCredibility (0-10): How trustworthy is the source?
  * recency (0-10): How recent/current is the evidence?
  * relevance (0-10): How directly does it support the claim?
  * sufficiency (0-10): Is there enough to support the claim?

IMPACT ANALYSIS:
- impactMagnitude (0-10): How significant is the consequence?
  * 10: Existential/fundamental
  * 7-9: Major consequences
  * 4-6: Moderate importance
  * 1-3: Minor impact
  * 0: No real impact

- impactProbability (0-10): How likely is this outcome?
- impactTimeframe: immediate/short-term/long-term/speculative
- impactReversibility: reversible/irreversible/unknown

INTERNAL LINK (0-10): Does the warrant actually support the claim?

OVERALL STRENGTH (0-10): Composite assessment

Return JSON:
{
  "evaluations": [
    {
      "argumentId": "<id>",
      "claimClarity": <0-10>,
      "claimRelevance": <0-10>,
      "warrantPresent": boolean,
      "warrantType": "<type>",
      "warrantQuality": {
        "sourceCredibility": <0-10>,
        "recency": <0-10>,
        "relevance": <0-10>,
        "sufficiency": <0-10>
      } | null,
      "impactMagnitude": <0-10>,
      "impactProbability": <0-10>,
      "impactTimeframe": "<timeframe>",
      "impactReversibility": "<reversibility>",
      "internalLinkStrength": <0-10>,
      "overallStrength": <0-10>
    }
  ]
}

Return ONLY valid JSON.`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const parsed = JSON.parse(cleanJsonResponse(content.text)) as {
          evaluations: Array<ArgumentEvaluationResponse & { argumentId: string }>
        }

        for (const evaluation of parsed.evaluations) {
          const argId = evaluation.argumentId
          results.set(argId, {
            claimClarity: evaluation.claimClarity,
            claimRelevance: evaluation.claimRelevance,
            warrantPresent: evaluation.warrantPresent,
            warrantType: evaluation.warrantType,
            warrantQuality: evaluation.warrantQuality,
            impactMagnitude: evaluation.impactMagnitude,
            impactProbability: evaluation.impactProbability,
            impactTimeframe: evaluation.impactTimeframe,
            impactReversibility: evaluation.impactReversibility,
            internalLinkStrength: evaluation.internalLinkStrength,
            overallStrength: evaluation.overallStrength
          })
        }
      }
    } catch (error) {
      console.error('Argument evaluation error:', error)
    }
  }

  return results
}

// =============================================================================
// FLOW BUILDING - Main Function
// =============================================================================

/**
 * Build the complete argument flow from comments
 * Main entry point for Phase 2
 */
export async function buildArgumentFlow(
  request: FlowAnalysisRequest
): Promise<FlowArgument[]> {
  const { comments, centralQuestion, positionDefinitions } = request

  if (comments.length === 0) {
    return []
  }

  // Step 1: Extract arguments from all comments
  console.log(`[Flow Analysis] Extracting arguments from ${comments.length} comments...`)
  const commentAnalyses = await extractArgumentsFromComments(
    comments,
    centralQuestion,
    positionDefinitions
  )

  // Step 2: Convert to FlowArguments and generate IDs
  const flowArguments: FlowArgument[] = []
  let argCounter = 0

  for (const analysis of commentAnalyses) {
    const comment = comments.find(c => c.id === analysis.commentId)
    if (!comment) continue

    for (const extractedArg of analysis.arguments) {
      argCounter++
      const argId = `arg_${analysis.commentId}_${argCounter}`

      const flowArg: FlowArgument = {
        id: argId,
        commentId: analysis.commentId,
        author: comment.author,
        position: extractedArg.position,
        timestamp: comment.timestamp,
        claim: extractedArg.claim,
        warrant: extractedArg.warrant,
        impact: extractedArg.impact,
        respondsTo: null, // Will be linked in step 3
        responses: [],    // Will be populated in step 3
        status: 'contested', // Default, will be determined later
        finalEvaluation: null // Will be populated in step 4
      }

      // Store the response quote for linking
      ;(flowArg as FlowArgument & { _respondsToQuote?: string })._respondsToQuote =
        extractedArg.respondsToQuote || undefined

      // Store warrant type for later evaluation
      flowArg.finalEvaluation = {
        claimClarity: 0,
        claimRelevance: 0,
        warrantPresent: !!extractedArg.warrant,
        warrantType: extractedArg.warrantType,
        warrantQuality: null,
        impactMagnitude: 0,
        impactProbability: 0,
        impactTimeframe: 'speculative',
        impactReversibility: 'unknown',
        internalLinkStrength: 0,
        overallStrength: 0
      }

      // Mark concessions
      if (extractedArg.isExplicitConcession) {
        flowArg.status = 'conceded'
      }

      flowArguments.push(flowArg)
    }
  }

  console.log(`[Flow Analysis] Extracted ${flowArguments.length} arguments`)

  // Step 3: Link argument responses
  const linkedArguments = await linkArgumentResponses(flowArguments, comments, centralQuestion)

  // Step 4: Evaluate argument strength
  console.log(`[Flow Analysis] Evaluating ${linkedArguments.length} arguments...`)
  const evaluations = await evaluateArguments(linkedArguments)

  // Apply evaluations
  for (const arg of linkedArguments) {
    const evaluation = evaluations.get(arg.id)
    if (evaluation) {
      arg.finalEvaluation = evaluation
    }
  }

  // Step 5: Determine argument statuses
  const finalArguments = determineArgumentStatuses(linkedArguments)

  console.log(`[Flow Analysis] Flow construction complete`)
  return finalArguments
}

// =============================================================================
// RESPONSE LINKING
// =============================================================================

/**
 * Link arguments to what they're responding to
 * Uses both comment structure and semantic matching
 */
export async function linkArgumentResponses(
  args: FlowArgument[],
  comments: FlowComment[],
  centralQuestion: string
): Promise<FlowArgument[]> {
  if (args.length === 0) return args

  // Build comment-to-arguments map
  const commentArgsMap = new Map<string, FlowArgument[]>()
  for (const arg of args) {
    const existing = commentArgsMap.get(arg.commentId) || []
    existing.push(arg)
    commentArgsMap.set(arg.commentId, existing)
  }

  // Build parent comment map
  const commentMap = new Map<string, FlowComment>()
  for (const comment of comments) {
    commentMap.set(comment.id, comment)
  }

  // For each argument, try to link to parent arguments
  for (const arg of args) {
    const comment = commentMap.get(arg.commentId)
    if (!comment?.parentId) continue

    // Get parent comment's arguments
    const parentArgs = commentArgsMap.get(comment.parentId) || []
    if (parentArgs.length === 0) continue

    // Find the best match using the response quote
    const respondsToQuote = (arg as FlowArgument & { _respondsToQuote?: string })._respondsToQuote

    if (respondsToQuote && respondsToQuote.length > 5) {
      // Try semantic matching with the quote
      const bestMatch = findBestMatchingArgument(respondsToQuote, parentArgs)
      if (bestMatch) {
        arg.respondsTo = bestMatch.id
        bestMatch.responses.push(arg.id)
      }
    } else if (parentArgs.length === 1) {
      // If only one parent argument and positions differ, link them
      const parentArg = parentArgs[0]
      if (parentArg.position !== arg.position) {
        arg.respondsTo = parentArg.id
        parentArg.responses.push(arg.id)
      }
    } else {
      // Multiple parent arguments - link to opposite position if exists
      const oppositeArgs = parentArgs.filter(p => p.position !== arg.position)
      if (oppositeArgs.length > 0) {
        // Link to the strongest opposite argument
        const sorted = oppositeArgs.sort((a, b) =>
          (b.finalEvaluation?.overallStrength || 0) - (a.finalEvaluation?.overallStrength || 0)
        )
        arg.respondsTo = sorted[0].id
        sorted[0].responses.push(arg.id)
      }
    }
  }

  // Clean up internal tracking field
  for (const arg of args) {
    delete (arg as FlowArgument & { _respondsToQuote?: string })._respondsToQuote
  }

  return args
}

/**
 * Find the best matching argument based on semantic similarity
 */
function findBestMatchingArgument(
  quote: string,
  candidates: FlowArgument[]
): FlowArgument | null {
  if (candidates.length === 0) return null

  const quoteLower = quote.toLowerCase()
  let bestMatch: FlowArgument | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    // Check if quote appears in claim or warrant
    const claimLower = candidate.claim.toLowerCase()
    const warrantLower = (candidate.warrant || '').toLowerCase()

    // Simple substring matching
    let score = 0
    if (claimLower.includes(quoteLower) || quoteLower.includes(claimLower.substring(0, 30))) {
      score = 0.8
    } else if (warrantLower.includes(quoteLower)) {
      score = 0.6
    } else {
      // Word overlap
      const quoteWords = new Set(quoteLower.split(/\s+/).filter(w => w.length > 3))
      const claimWords = claimLower.split(/\s+/).filter(w => w.length > 3)
      const overlap = claimWords.filter(w => quoteWords.has(w)).length
      score = quoteWords.size > 0 ? overlap / quoteWords.size : 0
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }

  return bestScore >= 0.3 ? bestMatch : null
}

// =============================================================================
// STATUS DETERMINATION
// =============================================================================

/**
 * Determine the final status of each argument
 * Status: extended, dropped, refuted, turned, conceded, contested
 */
export function determineArgumentStatuses(args: FlowArgument[]): FlowArgument[] {
  // Build maps for quick lookup
  const argMap = new Map<string, FlowArgument>()
  for (const arg of args) {
    argMap.set(arg.id, arg)
  }

  // Group by position for drop detection
  const proArgs = args.filter(a => a.position === 'pro')
  const conArgs = args.filter(a => a.position === 'con')

  for (const arg of args) {
    // Skip already conceded
    if (arg.status === 'conceded') continue

    // Check if argument was responded to
    const hasResponses = arg.responses.length > 0

    if (!hasResponses) {
      // No responses - check if opponent had opportunity to respond
      const opponentArgs = arg.position === 'pro' ? conArgs : proArgs

      // Find arguments made after this one
      const laterOpponentArgs = opponentArgs.filter(o =>
        new Date(o.timestamp) > new Date(arg.timestamp)
      )

      if (laterOpponentArgs.length > 0) {
        // Opponent posted later but didn't respond - DROPPED
        arg.status = 'dropped'
      } else {
        // Opponent didn't post again - EXTENDED (argument stands)
        arg.status = 'extended'
      }
    } else {
      // Has responses - needs evaluation
      // For now, mark as contested - Phase 3 clash evaluation will determine winner
      arg.status = 'contested'
    }
  }

  return args
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default buildArgumentFlow
