/**
 * Debate Detection Library
 *
 * Uses Claude to segment Reddit threads into structured debates with:
 * - Position classification (PRO/CON/NEUTRAL)
 * - Quality scoring
 * - Winner determination (quality-based, not vote-based)
 * - Momentum shift detection
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DebateThread,
  DebateComment,
  DebatePosition,
  DebateWinner,
  MomentumShift,
  ThreadVerdict
} from '@/types/debate'

// Initialize Anthropic client
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
 * Claude sometimes returns JSON wrapped in ```json ... ``` blocks
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  // Remove ```json or ``` at start
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  // Remove ``` at end
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}

// ============================================================================
// Types for internal processing
// ============================================================================

interface RawComment {
  id: string
  author: string
  body: string
  score: number
  created_utc: number
  parent_id: string
  depth?: number
}

interface CommentTree {
  comment: RawComment
  children: CommentTree[]
  depth: number
}

interface PositionResult {
  position: DebatePosition
  intensity: number
  isConcession: boolean
  reasoning: string
}

interface QualityResult {
  qualityScore: number
  breakdown: {
    evidence: number
    logic: number
    clarity: number
    engagement: number
  }
  fallacies: Array<{
    type: string
    quote: string
    severity: 'low' | 'medium' | 'high'
  }>
  claims: Array<{
    text: string
    verifiable: boolean
  }>
  isConcession: boolean
}

// ============================================================================
// Debate Detection Pipeline
// ============================================================================

/**
 * Main entry point: Detect and analyze debates in a Reddit thread
 */
export async function detectDebates(
  comments: RawComment[],
  opText: string,
  threadTitle: string
): Promise<{
  debates: DebateThread[]
  verdict: ThreadVerdict
  topics: string[]
}> {
  // Step 1: Build reply tree
  const trees = buildReplyTree(comments)

  // Step 2: Identify debate roots
  const debateRoots = identifyDebateRoots(trees)

  // Step 3-6: Process each debate
  const debates: DebateThread[] = []

  for (const root of debateRoots) {
    const debate = await processDebate(root, opText, threadTitle)
    if (debate) {
      debates.push(debate)
    }
  }

  // Step 7: Generate overall verdict
  const verdict = calculateVerdict(debates, comments.length)

  // Extract topics dynamically
  const topics = await extractTopics(threadTitle, opText, debates)

  return { debates, verdict, topics }
}

// ============================================================================
// Step 1: Build Reply Tree
// ============================================================================

function buildReplyTree(comments: RawComment[]): CommentTree[] {
  // Create ID -> comment map
  const commentMap = new Map<string, RawComment>()
  for (const comment of comments) {
    commentMap.set(comment.id, comment)
  }

  // Find parent-child relationships
  const childrenMap = new Map<string, RawComment[]>()

  for (const comment of comments) {
    // Reddit parent_id format: t1_xxxxx or t3_xxxxx (post)
    const parentId = comment.parent_id?.replace(/^t[13]_/, '') || ''

    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(comment)
  }

  // Build trees starting from top-level comments (those whose parent is the post)
  const topLevel = comments.filter(c => {
    const parentId = c.parent_id || ''
    return parentId.startsWith('t3_') || !commentMap.has(parentId.replace(/^t1_/, ''))
  })

  function buildTree(comment: RawComment, depth: number): CommentTree {
    const children = childrenMap.get(comment.id) || []
    return {
      comment: { ...comment, depth },
      children: children.map(c => buildTree(c, depth + 1)),
      depth
    }
  }

  return topLevel.map(c => buildTree(c, 1))
}

// ============================================================================
// Step 2: Identify Debate Roots
// ============================================================================

function identifyDebateRoots(trees: CommentTree[]): CommentTree[] {
  const debateRoots: CommentTree[] = []

  for (const tree of trees) {
    // A tree is a debate if:
    // 1. It's a top-level reply (depth == 1)
    // 2. AND has 3+ descendant comments
    const descendantCount = countDescendants(tree)

    if (descendantCount >= 3) {
      debateRoots.push(tree)
    }
  }

  // Sort by engagement (descendant count)
  return debateRoots.sort((a, b) => countDescendants(b) - countDescendants(a))
}

function countDescendants(tree: CommentTree): number {
  let count = 0
  for (const child of tree.children) {
    count += 1 + countDescendants(child)
  }
  return count
}

// ============================================================================
// Steps 3-6: Process Individual Debate
// ============================================================================

async function processDebate(
  tree: CommentTree,
  opText: string,
  threadTitle: string
): Promise<DebateThread | null> {
  // Flatten tree to get all comments
  const allComments = flattenTree(tree)

  if (allComments.length < 2) {
    return null
  }

  // Classify positions and score arguments using Claude
  const scoredComments = await classifyAndScoreComments(allComments, opText, threadTitle)

  // Determine winner based on quality
  const { winner, winnerReason, proScore, conScore } = determineWinner(scoredComments)

  // Detect momentum shifts
  const momentumShifts = detectMomentumShifts(scoredComments)

  // Calculate heat level
  const heatLevel = calculateHeatLevel(scoredComments)

  // Generate debate title
  const { title, keyClash } = await generateDebateTitle(scoredComments, opText)

  return {
    id: `debate_${tree.comment.id}`,
    title,
    keyClash,
    rootCommentId: tree.comment.id,
    winner,
    winnerReason,
    proScore,
    conScore,
    replyCount: allComments.length,
    heatLevel,
    replies: scoredComments,
    momentumShifts
  }
}

function flattenTree(tree: CommentTree): RawComment[] {
  const result: RawComment[] = [tree.comment]
  for (const child of tree.children) {
    result.push(...flattenTree(child))
  }
  return result
}

// ============================================================================
// Step 3 & 4: Classify Positions and Score Arguments
// ============================================================================

async function classifyAndScoreComments(
  comments: RawComment[],
  opText: string,
  threadTitle: string
): Promise<DebateComment[]> {
  const client = getAnthropicClient()

  // Batch process comments for efficiency
  const batchSize = 10
  const results: DebateComment[] = []

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)

    const prompt = `You are analyzing Reddit comments in a debate thread. Be very careful about position classification.

DEBATE TOPIC/PROPOSITION (from thread title):
"${threadTitle}"

ORIGINAL POST (OP) CONTEXT:
${opText.substring(0, 1500)}

COMMENTS TO ANALYZE:
${batch.map((c, idx) => `
[Comment ${idx + 1}]
Author: ${c.author}
Text: ${c.body.substring(0, 1000)}
---`).join('\n')}

For EACH comment, provide analysis in JSON format:

{
  "analyses": [
    {
      "commentIndex": 0,
      "position": "pro" | "con" | "neutral",
      "positionIntensity": 1-10,
      "qualityScore": 1-10,
      "isConcession": boolean,
      "fallacies": [
        { "type": "string", "quote": "string", "severity": "low" | "medium" | "high" }
      ],
      "claims": ["claim text 1", "claim text 2"]
    }
  ]
}

CRITICAL: POSITION CLASSIFICATION RULES

**BASE POSITIONS ON THE THREAD TITLE PROPOSITION, NOT THE OP's PERSONAL STANCE**

The thread title states a proposition or question. Classify comments relative to THAT proposition:

1. INTERPRETING THE PROPOSITION:
   - If the title is a question like "Is X good?" → PRO = "Yes, X is good", CON = "No, X is not good"
   - If the title is "CMV: X is true" → PRO = agrees X is true, CON = disagrees X is true
   - If the title is a statement like "X should happen" → PRO = supports X, CON = opposes X

2. POSITION DEFINITIONS (relative to the TITLE PROPOSITION):
   - PRO: AFFIRMS or SUPPORTS the proposition in the title
     * For "${threadTitle}": PRO means arguing YES/in favor of this proposition
     * Examples: "I agree that...", "This is correct because...", "X is essential because..."

   - CON: NEGATES or OPPOSES the proposition in the title
     * For "${threadTitle}": CON means arguing NO/against this proposition
     * Examples: "I disagree...", "This is wrong because...", "X is NOT essential because...", "We don't need X..."

   - NEUTRAL: Does not clearly affirm or negate the title proposition:
     * Purely factual statements without advocacy
     * Questions without taking a stance
     * Context or information provided neutrally
     * Arguments that don't directly address the title proposition

3. IMPORTANT: The OP may argue FOR or AGAINST their own title. Do NOT assume the OP agrees with the title.
   - "CMV" (Change My View) posts: OP states a view they want challenged
   - Question titles: OP may be neutral or have a stance
   - Classify each comment based on whether it AFFIRMS or NEGATES the title, regardless of OP's position

4. FACTUAL vs NORMATIVE:
   - Factual statements about what IS (without advocacy) → NEUTRAL
   - Normative statements about what SHOULD BE → PRO or CON based on title
   - Factual statements used rhetorically to support/oppose the title → PRO or CON

QUALITY SCORING (1-10):
- Evidence (0-3 points): Sources, statistics, concrete examples
- Logic (0-3 points): Sound reasoning, no fallacies
- Clarity (0-2 points): Well-structured, easy to follow
- Engagement (0-2 points): Addresses specific points raised

Return ONLY valid JSON, no markdown.`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const parsed = JSON.parse(cleanJsonResponse(content.text)) as {
          analyses: Array<{
            commentIndex: number
            position: DebatePosition
            positionIntensity: number
            qualityScore: number
            isConcession: boolean
            fallacies: Array<{ type: string; quote: string; severity: 'low' | 'medium' | 'high' }>
            claims: string[]
          }>
        }

        for (const analysis of parsed.analyses) {
          const comment = batch[analysis.commentIndex]
          if (comment) {
            results.push({
              id: comment.id,
              author: comment.author,
              text: comment.body,
              position: analysis.position,
              positionIntensity: analysis.positionIntensity,
              qualityScore: analysis.qualityScore,
              isConcession: analysis.isConcession,
              parentId: comment.parent_id?.replace(/^t[13]_/, '') || null,
              depth: comment.depth || 0,
              karma: comment.score,
              createdAt: new Date(comment.created_utc * 1000).toISOString(),
              claims: analysis.claims,
              fallacies: analysis.fallacies
            })
          }
        }
      }
    } catch (error) {
      console.error('Claude analysis error:', error)
      // Fall back to basic classification for failed batch
      for (const comment of batch) {
        results.push({
          id: comment.id,
          author: comment.author,
          text: comment.body,
          position: 'neutral',
          positionIntensity: 5,
          qualityScore: 5,
          isConcession: false,
          parentId: comment.parent_id?.replace(/^t[13]_/, '') || null,
          depth: comment.depth || 0,
          karma: comment.score,
          createdAt: new Date(comment.created_utc * 1000).toISOString()
        })
      }
    }
  }

  return results
}

// ============================================================================
// Step 5: Detect Momentum Shifts
// ============================================================================

function detectMomentumShifts(comments: DebateComment[]): MomentumShift[] {
  const shifts: MomentumShift[] = []

  // Sort by creation time
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Track running average quality by position
  let proTotal = 0, proCount = 0
  let conTotal = 0, conCount = 0

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    // Update running averages
    if (prev.position === 'pro') {
      proTotal += prev.qualityScore
      proCount++
    } else if (prev.position === 'con') {
      conTotal += prev.qualityScore
      conCount++
    }

    // Check for momentum shift
    const qualityDelta = curr.qualityScore - prev.qualityScore

    // Shift occurs when:
    // 1. Quality difference > 2.0 AND
    // 2. Positions are opposite AND
    // 3. The higher quality comment is from opposite side
    if (
      Math.abs(qualityDelta) > 2.0 &&
      prev.position !== 'neutral' &&
      curr.position !== 'neutral' &&
      prev.position !== curr.position
    ) {
      shifts.push({
        replyNumber: i + 1,
        fromPosition: prev.position,
        toPosition: curr.position,
        trigger: `Strong ${curr.position} argument (${curr.qualityScore}/10) following weaker ${prev.position} argument (${prev.qualityScore}/10)`,
        qualityDelta
      })
    }

    // Also check for explicit concessions
    if (curr.isConcession && prev.position !== 'neutral') {
      const oppositePosition = prev.position === 'pro' ? 'con' : 'pro'
      shifts.push({
        replyNumber: i + 1,
        fromPosition: prev.position,
        toPosition: oppositePosition,
        trigger: `${curr.author} conceded a point`,
        qualityDelta: 0
      })
    }
  }

  return shifts
}

// ============================================================================
// Step 6: Determine Winner
// ============================================================================

function determineWinner(comments: DebateComment[]): {
  winner: DebateWinner
  winnerReason: string
  proScore: number
  conScore: number
} {
  const proComments = comments.filter(c => c.position === 'pro')
  const conComments = comments.filter(c => c.position === 'con')

  if (proComments.length === 0 && conComments.length === 0) {
    return {
      winner: 'unresolved',
      winnerReason: 'No clear positions taken',
      proScore: 0,
      conScore: 0
    }
  }

  const proAvg = proComments.length > 0
    ? proComments.reduce((sum, c) => sum + c.qualityScore, 0) / proComments.length
    : 0

  const conAvg = conComments.length > 0
    ? conComments.reduce((sum, c) => sum + c.qualityScore, 0) / conComments.length
    : 0

  const difference = Math.abs(proAvg - conAvg)

  if (difference < 0.5) {
    return {
      winner: 'draw',
      winnerReason: `Close debate (PRO: ${proAvg.toFixed(1)} vs CON: ${conAvg.toFixed(1)})`,
      proScore: proAvg,
      conScore: conAvg
    }
  }

  if (proAvg > conAvg) {
    return {
      winner: 'pro',
      winnerReason: `PRO arguments stronger (${proAvg.toFixed(1)} vs ${conAvg.toFixed(1)})`,
      proScore: proAvg,
      conScore: conAvg
    }
  }

  return {
    winner: 'con',
    winnerReason: `CON arguments stronger (${conAvg.toFixed(1)} vs ${proAvg.toFixed(1)})`,
    proScore: proAvg,
    conScore: conAvg
  }
}

// ============================================================================
// Step 7: Generate Debate Title
// ============================================================================

async function generateDebateTitle(
  comments: DebateComment[],
  opText: string
): Promise<{ title: string; keyClash: string }> {
  const client = getAnthropicClient()

  // Get key claims from both sides
  const proClaims = comments
    .filter(c => c.position === 'pro')
    .flatMap(c => c.claims || [])
    .slice(0, 3)

  const conClaims = comments
    .filter(c => c.position === 'con')
    .flatMap(c => c.claims || [])
    .slice(0, 3)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Generate a concise debate title based on the key clash points.

OP POSITION: ${opText.substring(0, 500)}

PRO CLAIMS: ${proClaims.join('; ')}
CON CLAIMS: ${conClaims.join('; ')}

Return JSON only:
{
  "title": "Short debate title (5-10 words)",
  "keyClash": "One sentence describing the core disagreement"
}`
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = JSON.parse(cleanJsonResponse(content.text))
      return {
        title: parsed.title || 'Debate',
        keyClash: parsed.keyClash || 'Unknown disagreement'
      }
    }
  } catch (error) {
    console.error('Title generation error:', error)
  }

  return {
    title: 'Discussion',
    keyClash: 'Points of disagreement'
  }
}

// ============================================================================
// Calculate Overall Verdict
// ============================================================================

function calculateVerdict(debates: DebateThread[], totalComments: number): ThreadVerdict {
  if (debates.length === 0) {
    return {
      overallScore: 5,
      summary: 'Limited debate activity detected',
      evidenceQualityPct: 50,
      civilityScore: 7,
      worthReading: totalComments > 10
    }
  }

  // Calculate averages across all debates
  const avgProScore = debates.reduce((sum, d) => sum + d.proScore, 0) / debates.length
  const avgConScore = debates.reduce((sum, d) => sum + d.conScore, 0) / debates.length
  const overallQuality = (avgProScore + avgConScore) / 2

  // Calculate evidence quality from all comments
  const allComments = debates.flatMap(d => d.replies)
  const evidenceComments = allComments.filter(c => c.claims && c.claims.length > 0)
  const evidenceQualityPct = (evidenceComments.length / Math.max(allComments.length, 1)) * 100

  // Calculate civility (inverse of fallacy density)
  const fallacyCount = allComments.reduce(
    (sum, c) => sum + (c.fallacies?.length || 0), 0
  )
  const fallacyRate = fallacyCount / Math.max(allComments.length, 1)
  const civilityScore = Math.max(1, 10 - fallacyRate * 5)

  // Determine summary
  let summary: string
  const proWins = debates.filter(d => d.winner === 'pro').length
  const conWins = debates.filter(d => d.winner === 'con').length

  if (proWins > conWins) {
    summary = `PRO side generally prevails (${proWins} vs ${conWins} debates won)`
  } else if (conWins > proWins) {
    summary = `CON side generally prevails (${conWins} vs ${proWins} debates won)`
  } else {
    summary = `Evenly matched debate with ${debates.length} active discussion threads`
  }

  return {
    overallScore: Math.round(overallQuality * 10) / 10,
    summary,
    evidenceQualityPct: Math.round(evidenceQualityPct),
    civilityScore: Math.round(civilityScore * 10) / 10,
    worthReading: overallQuality >= 5 && civilityScore >= 5
  }
}

// ============================================================================
// Calculate Heat Level
// ============================================================================

function calculateHeatLevel(comments: DebateComment[]): number {
  if (comments.length === 0) return 0

  // Factors that increase heat:
  // 1. High fallacy count
  // 2. Strong position intensities
  // 3. Few concessions
  // 4. High variance in quality scores

  const fallacyCount = comments.reduce(
    (sum, c) => sum + (c.fallacies?.length || 0), 0
  )
  const avgIntensity = comments.reduce(
    (sum, c) => sum + c.positionIntensity, 0
  ) / comments.length
  const concessionRate = comments.filter(c => c.isConcession).length / comments.length

  // Calculate quality variance
  const avgQuality = comments.reduce((sum, c) => sum + c.qualityScore, 0) / comments.length
  const qualityVariance = comments.reduce(
    (sum, c) => sum + Math.pow(c.qualityScore - avgQuality, 2), 0
  ) / comments.length

  // Combine factors
  const fallacyFactor = Math.min(fallacyCount / comments.length, 1) * 3
  const intensityFactor = (avgIntensity / 10) * 3
  const concessionPenalty = concessionRate * -2
  const varianceFactor = Math.min(qualityVariance / 10, 1) * 2

  const heat = Math.max(0, Math.min(10,
    5 + fallacyFactor + intensityFactor + concessionPenalty + varianceFactor
  ))

  return Math.round(heat * 10) / 10
}

// ============================================================================
// Extract Topics (Dynamic)
// ============================================================================

async function extractTopics(
  threadTitle: string,
  opText: string,
  debates: DebateThread[]
): Promise<string[]> {
  const client = getAnthropicClient()

  const debateSummaries = debates
    .slice(0, 5)
    .map(d => d.title)
    .join(', ')

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Extract 2-5 topics from this Reddit thread.

TITLE: ${threadTitle}
OP EXCERPT: ${opText.substring(0, 500)}
KEY DEBATES: ${debateSummaries}

Topics should be:
- Lowercase, snake_case format
- Specific enough to be useful (not just "politics")
- Hierarchical where natural (e.g., "cryptocurrency_regulation" under "economics")

Return JSON array only, most specific first:
["topic_1", "topic_2", "parent_topic"]`
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const topics = JSON.parse(cleanJsonResponse(content.text))
      if (Array.isArray(topics)) {
        return topics.slice(0, 5).map(t => String(t).toLowerCase().replace(/\s+/g, '_'))
      }
    }
  } catch (error) {
    console.error('Topic extraction error:', error)
  }

  // Fallback: extract from title
  const words = threadTitle.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 3)

  return words.length > 0 ? words : ['general_discussion']
}
