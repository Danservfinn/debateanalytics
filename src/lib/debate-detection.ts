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

// Limits optimized for Vercel Hobby tier (10s timeout)
const MAX_COMMENTS_TOTAL = 100      // Max comments to process overall
const MAX_DEBATES = 3               // Max number of debate threads to analyze
const MAX_COMMENTS_PER_DEBATE = 15  // Max comments per debate thread

// Fast mode disabled - parallel processing + Haiku model keeps under 60s limit
// Re-enable with: const FAST_MODE = !process.env.ENABLE_AI_ANALYSIS
const FAST_MODE = false

/**
 * Main entry point: Detect and analyze debates in a Reddit thread
 * Uses fast mode on Vercel Hobby to avoid timeout
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
  const startTime = Date.now()

  // Limit total comments to prevent timeout
  const limitedComments = comments.length > MAX_COMMENTS_TOTAL
    ? comments.slice(0, MAX_COMMENTS_TOTAL)
    : comments

  if (comments.length > MAX_COMMENTS_TOTAL) {
    console.log(`Large thread: limiting from ${comments.length} to ${MAX_COMMENTS_TOTAL} comments`)
  }

  // Step 1: Build reply tree
  const trees = buildReplyTree(limitedComments)

  // Step 2: Identify debate roots (already sorted by engagement)
  const debateRoots = identifyDebateRoots(trees).slice(0, MAX_DEBATES)

  console.log(`Processing ${debateRoots.length} debates from ${limitedComments.length} comments (fast=${FAST_MODE})`)

  let debates: DebateThread[]

  if (FAST_MODE) {
    // Fast mode: Use pattern-matching instead of AI (completes in <5s)
    debates = debateRoots
      .map(root => processDebateFast(root, opText, threadTitle))
      .filter((d): d is DebateThread => d !== null)
  } else {
    // Full AI mode: Use Claude for deep analysis
    console.log(`Processing ${debateRoots.length} debates in parallel...`)

    const debatePromises = debateRoots.map(root =>
      processDebate(root, opText, threadTitle)
    )

    const debateResults = await Promise.all(debatePromises)
    debates = debateResults.filter((d): d is DebateThread => d !== null)
  }

  // Step 7: Generate overall verdict
  const verdict = calculateVerdict(debates, comments.length)

  // Extract topics (fast pattern matching)
  const topics = FAST_MODE
    ? extractTopicsFast(threadTitle)
    : await extractTopics(threadTitle, opText, debates)

  console.log(`Debate detection complete in ${Date.now() - startTime}ms`)

  return { debates, verdict, topics }
}

/**
 * Fast debate processing without AI - uses pattern matching
 * Completes in milliseconds instead of seconds
 */
function processDebateFast(
  tree: CommentTree,
  opText: string,
  threadTitle: string
): DebateThread | null {
  const allComments = flattenTree(tree).slice(0, MAX_COMMENTS_PER_DEBATE)

  if (allComments.length < 2) {
    return null
  }

  // Fast position classification using keyword patterns
  const scoredComments: DebateComment[] = allComments.map(comment => {
    const text = comment.body.toLowerCase()
    const position = classifyPositionFast(text, threadTitle)

    return {
      id: comment.id,
      author: comment.author,
      text: comment.body,
      position: position.position,
      positionIntensity: position.intensity,
      qualityScore: estimateQualityFast(comment.body),
      isConcession: /i agree|you('re| are) right|good point|fair enough|i concede/i.test(comment.body),
      parentId: comment.parent_id?.replace(/^t[13]_/, '') || null,
      depth: comment.depth || 0,
      karma: comment.score,
      createdAt: new Date(comment.created_utc * 1000).toISOString()
    }
  })

  // Determine winner
  const { winner, winnerReason, proScore, conScore } = determineWinner(scoredComments)

  // Generate simple title
  const title = generateTitleFast(threadTitle)

  return {
    id: `debate_${tree.comment.id}`,
    title,
    keyClash: 'Points of contention identified',
    rootCommentId: tree.comment.id,
    winner,
    winnerReason,
    proScore,
    conScore,
    replyCount: allComments.length,
    heatLevel: calculateHeatLevel(scoredComments),
    replies: scoredComments,
    momentumShifts: []
  }
}

/**
 * Fast position classification using keywords
 */
function classifyPositionFast(text: string, title: string): { position: DebatePosition; intensity: number } {
  // Agreement indicators
  const proPatterns = /\bi agree\b|absolutely|exactly|you('re| are) right|this is correct|true|yes|support|agree with/i
  // Disagreement indicators
  const conPatterns = /\bi disagree\b|no[,.]|wrong|false|incorrect|but|however|not true|don't think|isn't|aren't|actually/i
  // Question/neutral indicators
  const neutralPatterns = /\?$|what if|could you|how about|i'm not sure|depends/i

  const proMatch = text.match(proPatterns)
  const conMatch = text.match(conPatterns)
  const neutralMatch = text.match(neutralPatterns)

  if (neutralMatch && !proMatch && !conMatch) {
    return { position: 'neutral', intensity: 3 }
  }

  if (proMatch && !conMatch) {
    return { position: 'pro', intensity: 7 }
  }

  if (conMatch && !proMatch) {
    return { position: 'con', intensity: 7 }
  }

  // Both or neither - analyze further
  if (conMatch && proMatch) {
    // If starts with disagreement, likely con
    if (text.indexOf(conMatch[0]) < text.indexOf(proMatch[0])) {
      return { position: 'con', intensity: 5 }
    }
    return { position: 'pro', intensity: 5 }
  }

  return { position: 'neutral', intensity: 4 }
}

/**
 * Fast quality estimation based on text features
 */
function estimateQualityFast(text: string): number {
  let score = 5

  // Length bonus (longer = more detailed)
  if (text.length > 500) score += 1
  if (text.length > 1000) score += 1

  // Structure bonus (paragraphs, lists)
  if (text.includes('\n\n')) score += 0.5
  if (/^\s*[-*•]\s/m.test(text)) score += 0.5

  // Evidence indicators
  if (/https?:\/\/|source|study|research|according to|data shows/i.test(text)) score += 1

  // Logic indicators
  if (/therefore|because|since|thus|hence|as a result|consequently/i.test(text)) score += 0.5

  // Caps = shouting = lower quality
  if (text === text.toUpperCase() && text.length > 20) score -= 1

  return Math.min(10, Math.max(1, Math.round(score * 10) / 10))
}

/**
 * Generate title from thread title
 */
function generateTitleFast(threadTitle: string): string {
  // Remove CMV prefix
  let title = threadTitle.replace(/^CMV:\s*/i, '').trim()

  // Shorten if too long
  if (title.length > 50) {
    title = title.substring(0, 47) + '...'
  }

  return title
}

/**
 * Extract topics from title using patterns
 */
function extractTopicsFast(threadTitle: string): string[] {
  const title = threadTitle.toLowerCase()
  const topics: string[] = []

  // Common topic patterns
  const patterns: [RegExp, string][] = [
    [/immigra|migration|border/i, 'immigration'],
    [/cultur|tradition/i, 'culture'],
    [/global|world|international/i, 'globalization'],
    [/politi|govern|democra|republic/i, 'politics'],
    [/econom|money|financ|market/i, 'economics'],
    [/climate|environment|green/i, 'environment'],
    [/health|medic|vaccine|drug/i, 'healthcare'],
    [/tech|ai|computer|software/i, 'technology'],
    [/educat|school|university|learn/i, 'education'],
    [/social media|twitter|facebook|reddit/i, 'social_media'],
  ]

  for (const [pattern, topic] of patterns) {
    if (pattern.test(title)) {
      topics.push(topic)
    }
  }

  // Fallback
  if (topics.length === 0) {
    topics.push('general_discussion')
  }

  return topics.slice(0, 5)
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
  // Flatten tree to get all comments (limited to prevent timeout)
  let allComments = flattenTree(tree)

  if (allComments.length < 2) {
    return null
  }

  // Limit comments per debate to prevent timeout
  if (allComments.length > MAX_COMMENTS_PER_DEBATE) {
    console.log(`Limiting debate from ${allComments.length} to ${MAX_COMMENTS_PER_DEBATE} comments`)
    allComments = allComments.slice(0, MAX_COMMENTS_PER_DEBATE)
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

  // Batch process comments in PARALLEL for speed
  const batchSize = 10
  const batches: RawComment[][] = []

  for (let i = 0; i < comments.length; i += batchSize) {
    batches.push(comments.slice(i, i + batchSize))
  }

  // Process all batches in parallel
  const batchPromises = batches.map(async (batch) => {
    const batchResults: DebateComment[] = []

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
        model: 'claude-3-5-haiku-20241022',
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
            batchResults.push({
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
        batchResults.push({
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
    return batchResults
  })

  // Wait for all batches to complete and flatten results
  const allBatchResults = await Promise.all(batchPromises)
  return allBatchResults.flat()
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
      model: 'claude-haiku-4-20250514',
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
      model: 'claude-haiku-4-20250514',
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
