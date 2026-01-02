/**
 * Verdict Calculation Module - Phase 4 of Traditional Debate Scoring
 *
 * Calculates the final debate verdict:
 * - Speaker evaluation (World Schools format)
 * - Burden of proof analysis
 * - Final winner determination
 * - Voting issue identification
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  FlowArgument,
  ClashEvaluation,
  DebateIssue,
  SpeakerEvaluation,
  BurdenAnalysis,
  TraditionalDebateVerdict,
  VotingIssue,
  FlowAnalysisRequest,
  TraditionalScoringConfig
} from '@/types/debate-scoring'
import { DEFAULT_SCORING_CONFIG } from '@/types/debate-scoring'
import { calculateEvidenceDistribution, calculateDisplayScores, generateVerdictSummary, generateJudgeNotes } from './traditional-scoring'

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

interface SpeakerEvaluationResponse {
  author: string
  position: 'pro' | 'con'
  content: number      // 0-40
  style: number        // 0-40
  strategy: number     // 0-20
  intellectualHonesty: number  // 0-10
  reasoning: string
}

interface BurdenAnalysisResponse {
  affirmativeBurden: string
  negativeBurden: string
  presumption: 'pro' | 'con' | 'none'
  proMetBurden: boolean
  conMetBurden: boolean
  reasoning: string
}

// =============================================================================
// SPEAKER EVALUATION - Claude API Call
// =============================================================================

/**
 * Evaluate individual speakers/participants
 * Uses World Schools format: Content (40) + Style (40) + Strategy (20)
 */
export async function evaluateSpeakers(
  args: FlowArgument[],
  clashes: ClashEvaluation[],
  centralQuestion: string
): Promise<SpeakerEvaluation[]> {
  // Group arguments by author
  const authorArgs = new Map<string, FlowArgument[]>()
  for (const arg of args) {
    const existing = authorArgs.get(arg.author) || []
    existing.push(arg)
    authorArgs.set(arg.author, existing)
  }

  if (authorArgs.size === 0) {
    return []
  }

  console.log(`[Speaker Evaluation] Evaluating ${authorArgs.size} speakers...`)

  const client = getAnthropicClient()
  const results: SpeakerEvaluation[] = []

  // Build summary for each speaker
  const speakerSummaries = Array.from(authorArgs.entries()).map(([author, authorArguments]) => {
    const position = authorArguments[0]?.position || 'neutral'
    const argCount = authorArguments.length

    // Calculate clash record
    const clashesInvolved = clashes.filter(c =>
      authorArguments.some(a => a.id === c.attackerId || a.id === c.defenderId)
    )
    const clashesWon = clashesInvolved.filter(c => {
      const wasAttacker = authorArguments.some(a => a.id === c.attackerId)
      return (wasAttacker && c.winner === 'attacker') || (!wasAttacker && c.winner === 'defender')
    }).length
    const clashesLost = clashesInvolved.filter(c => {
      const wasAttacker = authorArguments.some(a => a.id === c.attackerId)
      return (wasAttacker && c.winner === 'defender') || (!wasAttacker && c.winner === 'attacker')
    }).length

    // Count concessions and drops
    const concessions = authorArguments.filter(a => a.status === 'conceded').length
    const dropped = authorArguments.filter(a => a.status === 'dropped').length

    // Get argument summaries
    const argSummaries = authorArguments.slice(0, 5).map(a =>
      `"${a.claim.substring(0, 100)}..." (strength: ${a.finalEvaluation?.overallStrength || 'N/A'}/10)`
    ).join('\n    ')

    return {
      author,
      position,
      argCount,
      clashesWon,
      clashesLost,
      concessions,
      dropped,
      argSummaries
    }
  })

  const prompt = `You are evaluating debate participants using World Schools debate scoring criteria.

CENTRAL QUESTION: ${centralQuestion}

PARTICIPANTS TO EVALUATE:
${speakerSummaries.map((s, idx) => `
[SPEAKER ${idx + 1}]
Author: ${s.author}
Position: ${s.position.toUpperCase()}
Arguments Made: ${s.argCount}
Clashes: Won ${s.clashesWon}, Lost ${s.clashesLost}
Concessions: ${s.concessions}
Dropped Arguments: ${s.dropped}
Sample Arguments:
    ${s.argSummaries}
---`).join('\n')}

For EACH speaker, evaluate using World Schools format:

CONTENT (0-40): Quality and substance of arguments
- 35-40: Outstanding - Deep analysis, excellent evidence, compelling reasoning
- 28-34: Above average - Good arguments with solid support
- 20-27: Average - Adequate substance, some gaps
- 12-19: Below average - Weak arguments, poor support
- 0-11: Poor - Little substantive contribution

STYLE (0-40): Communication effectiveness
- 35-40: Outstanding - Crystal clear, highly persuasive, excellent tone
- 28-34: Above average - Clear and engaging, good persuasion
- 20-27: Average - Understandable, some clarity issues
- 12-19: Below average - Unclear or poor tone
- 0-11: Poor - Confusing or hostile

STRATEGY (0-20): Debate management
- 17-20: Outstanding - Perfect prioritization, excellent clash engagement
- 13-16: Above average - Good structure, responds to key points
- 9-12: Average - Adequate structure, misses some opportunities
- 5-8: Below average - Poor prioritization, weak responses
- 0-4: Poor - No clear strategy

INTELLECTUAL HONESTY (0-10): Good faith engagement
- 9-10: Exemplary - Acknowledges valid points, avoids fallacies
- 7-8: Good - Generally honest, minor issues
- 5-6: Average - Some questionable tactics
- 3-4: Below average - Ignores valid points, uses fallacies
- 0-2: Poor - Dishonest argumentation

Return JSON:
{
  "evaluations": [
    {
      "author": "<username>",
      "position": "pro" | "con",
      "content": <0-40>,
      "style": <0-40>,
      "strategy": <0-20>,
      "intellectualHonesty": <0-10>,
      "reasoning": "<brief explanation of scores>"
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
        evaluations: SpeakerEvaluationResponse[]
      }

      for (const evalData of parsed.evaluations) {
        const authorArguments = authorArgs.get(evalData.author) || []

        // Calculate argument statistics
        const argumentsWon = authorArguments.filter(a =>
          a.status === 'extended' ||
          clashes.some(c =>
            (c.attackerId === a.id && c.winner === 'attacker') ||
            (c.defenderId === a.id && c.winner === 'defender')
          )
        ).length

        const argumentsLost = authorArguments.filter(a =>
          a.status === 'refuted' || a.status === 'turned' ||
          clashes.some(c =>
            (c.attackerId === a.id && c.winner === 'defender') ||
            (c.defenderId === a.id && c.winner === 'attacker')
          )
        ).length

        results.push({
          author: evalData.author,
          position: evalData.position,
          content: evalData.content,
          style: evalData.style,
          strategy: evalData.strategy,
          speakerPoints: evalData.content + evalData.style + evalData.strategy,
          intellectualHonesty: evalData.intellectualHonesty,
          concessionsMade: authorArguments.filter(a => a.status === 'conceded').length,
          droppedArguments: authorArguments.filter(a => a.status === 'dropped').length,
          argumentsMade: authorArguments.length,
          argumentsWon,
          argumentsLost
        })
      }
    }
  } catch (error) {
    console.error('Speaker evaluation error:', error)
    // Fallback: basic evaluation
    for (const [author, authorArguments] of authorArgs) {
      const position = authorArguments[0]?.position || 'pro'
      const avgStrength = authorArguments.reduce((sum, a) =>
        sum + (a.finalEvaluation?.overallStrength || 5), 0
      ) / authorArguments.length

      results.push({
        author,
        position: position as 'pro' | 'con',
        content: Math.round(avgStrength * 4),
        style: 25,
        strategy: 12,
        speakerPoints: Math.round(avgStrength * 4) + 37,
        intellectualHonesty: 6,
        concessionsMade: authorArguments.filter(a => a.status === 'conceded').length,
        droppedArguments: authorArguments.filter(a => a.status === 'dropped').length,
        argumentsMade: authorArguments.length,
        argumentsWon: 0,
        argumentsLost: 0
      })
    }
  }

  console.log(`[Speaker Evaluation] Evaluated ${results.length} speakers`)
  return results
}

// =============================================================================
// BURDEN OF PROOF ANALYSIS - Claude API Call
// =============================================================================

/**
 * Analyze burden of proof in the debate
 * Determines what each side must prove and whether they succeeded
 */
export async function analyzeBurden(
  centralQuestion: string,
  issues: DebateIssue[],
  args: FlowArgument[]
): Promise<BurdenAnalysis> {
  console.log('[Burden Analysis] Analyzing burden of proof...')

  const client = getAnthropicClient()

  // Summarize what each side argued
  const proArgs = args.filter(a => a.position === 'pro')
  const conArgs = args.filter(a => a.position === 'con')

  const proSummary = proArgs.slice(0, 5).map(a => `- ${a.claim}`).join('\n')
  const conSummary = conArgs.slice(0, 5).map(a => `- ${a.claim}`).join('\n')

  // Summarize issue outcomes
  const issueOutcomes = issues.map(i =>
    `- ${i.topic}: ${i.issueWinner.toUpperCase()} wins (weight: ${i.issueWeight}/10)`
  ).join('\n')

  const prompt = `You are analyzing the burden of proof in a debate.

CENTRAL QUESTION: ${centralQuestion}

PRO SIDE ARGUMENTS:
${proSummary || 'No PRO arguments'}

CON SIDE ARGUMENTS:
${conSummary || 'No CON arguments'}

ISSUE OUTCOMES:
${issueOutcomes || 'No issues evaluated'}

Analyze the burden of proof:

1. AFFIRMATIVE BURDEN: What must the PRO side prove to win?
   - Based on the central question, what is PRO's obligation?

2. NEGATIVE BURDEN: What must the CON side prove (if anything)?
   - Does CON have an affirmative burden, or just need to refute PRO?

3. PRESUMPTION: Who wins if neither side meets their burden?
   - "pro" if status quo favors the proposition
   - "con" if status quo opposes the proposition (most common)
   - "none" if genuinely neutral

4. BURDEN MET: Did each side meet their burden?
   - Consider: Did they prove what they needed to prove?
   - Look at issue outcomes and argument strength

Return JSON:
{
  "affirmativeBurden": "<what PRO must prove>",
  "negativeBurden": "<what CON must prove, or 'Refute PRO's case'>",
  "presumption": "pro" | "con" | "none",
  "proMetBurden": boolean,
  "conMetBurden": boolean,
  "reasoning": "<explanation of burden analysis>"
}

Return ONLY valid JSON.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = JSON.parse(cleanJsonResponse(content.text)) as BurdenAnalysisResponse

      return {
        affirmativeBurden: parsed.affirmativeBurden,
        negativeBurden: parsed.negativeBurden,
        presumption: parsed.presumption,
        burdenMet: {
          pro: parsed.proMetBurden,
          con: parsed.conMetBurden
        },
        burdenReasoning: parsed.reasoning
      }
    }
  } catch (error) {
    console.error('Burden analysis error:', error)
  }

  // Fallback
  return {
    affirmativeBurden: 'To prove the proposition stated in the central question',
    negativeBurden: 'To refute PRO\'s case or prove the opposite',
    presumption: 'con',
    burdenMet: {
      pro: issues.filter(i => i.issueWinner === 'pro').length > issues.length / 2,
      con: issues.filter(i => i.issueWinner === 'con').length > issues.length / 2
    },
    burdenReasoning: 'Burden analysis based on issue outcomes'
  }
}

// =============================================================================
// VOTING ISSUE IDENTIFICATION
// =============================================================================

/**
 * Identify the voting issues - key reasons why the winner won
 */
export function identifyVotingIssues(
  issues: DebateIssue[],
  winner: 'pro' | 'con' | 'draw'
): VotingIssue[] {
  if (winner === 'draw') {
    return []
  }

  const votingIssues: VotingIssue[] = []

  // Sort issues by weight (most important first)
  const sortedIssues = [...issues].sort((a, b) => b.issueWeight - a.issueWeight)

  for (const issue of sortedIssues) {
    // Only include issues that contributed to the winner
    if (issue.issueWinner === winner) {
      votingIssues.push({
        issueId: issue.id,
        issue: issue.topic,
        winner: issue.issueWinner,
        weight: issue.issueWeight,
        explanation: issue.reasoning
      })
    }
  }

  // Return top 3-5 voting issues
  return votingIssues.slice(0, 5)
}

// =============================================================================
// FINAL VERDICT CALCULATION
// =============================================================================

/**
 * Calculate the final debate verdict using traditional methodology
 */
export async function calculateTraditionalVerdict(
  request: FlowAnalysisRequest,
  args: FlowArgument[],
  clashes: ClashEvaluation[],
  issues: DebateIssue[],
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<TraditionalDebateVerdict> {
  const { centralQuestion, threadTitle } = request

  console.log('[Verdict Calculation] Calculating final verdict...')

  // Step 1: Evaluate speakers
  const speakers = await evaluateSpeakers(args, clashes, centralQuestion)

  // Step 2: Analyze burden of proof
  const burden = await analyzeBurden(centralQuestion, issues, args)

  // Step 3: Count issue wins
  const issuesWonByPro = issues.filter(i => i.issueWinner === 'pro').length
  const issuesWonByCon = issues.filter(i => i.issueWinner === 'con').length
  const issueDraws = issues.filter(i => i.issueWinner === 'draw').length

  // Step 4: Calculate impact totals
  let proImpactTotal = 0
  let conImpactTotal = 0

  for (const issue of issues) {
    const issueImpact = issue.issueWeight *
      (issue.proArguments.reduce((sum, a) =>
        sum + (a.finalEvaluation?.impactMagnitude || 5) * (a.finalEvaluation?.impactProbability || 5) / 100,
        0
      ) + issue.conArguments.reduce((sum, a) =>
        sum + (a.finalEvaluation?.impactMagnitude || 5) * (a.finalEvaluation?.impactProbability || 5) / 100,
        0
      )) / Math.max(issue.proArguments.length + issue.conArguments.length, 1)

    if (issue.issueWinner === 'pro') {
      proImpactTotal += issueImpact
    } else if (issue.issueWinner === 'con') {
      conImpactTotal += issueImpact
    }
  }

  // Step 5: Count dropped arguments
  const droppedByPro = args.filter(a => a.position === 'con' && a.status === 'dropped').length
  const droppedByCon = args.filter(a => a.position === 'pro' && a.status === 'dropped').length

  // Step 6: Determine winner
  const { winner, confidence } = determineWinner(
    issuesWonByPro,
    issuesWonByCon,
    proImpactTotal,
    conImpactTotal,
    burden,
    droppedByPro,
    droppedByCon,
    config
  )

  // Step 7: Identify voting issues
  const votingIssues = identifyVotingIssues(issues, winner)

  // Step 8: Build the verdict object (without summary/notes yet)
  const partialVerdict = {
    debateId: `debate_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    issues,
    issuesWonByPro,
    issuesWonByCon,
    issueDraws,
    totalProArguments: args.filter(a => a.position === 'pro').length,
    totalConArguments: args.filter(a => a.position === 'con').length,
    droppedByPro,
    droppedByCon,
    proImpactTotal: Math.round(proImpactTotal * 10) / 10,
    conImpactTotal: Math.round(conImpactTotal * 10) / 10,
    burden,
    speakers,
    winner,
    winnerConfidence: confidence,
    votingIssues
  }

  // Step 9: Calculate display scores
  const { proScore, conScore, margin } = calculateDisplayScores(partialVerdict)

  // Step 10: Generate summary first
  const verdictWithScores = {
    ...partialVerdict,
    proScore,
    conScore,
    margin
  }

  const verdictSummary = generateVerdictSummary(verdictWithScores)

  // Step 11: Generate judge notes (needs verdictSummary)
  const verdictWithSummary = {
    ...verdictWithScores,
    verdictSummary
  }
  const judgeNotes = generateJudgeNotes(verdictWithSummary)

  console.log(`[Verdict Calculation] Verdict: ${winner.toUpperCase()} wins (${confidence}% confidence)`)

  return {
    ...verdictWithSummary,
    judgeNotes
  }
}

/**
 * Determine the winner based on all factors
 */
function determineWinner(
  issuesWonByPro: number,
  issuesWonByCon: number,
  proImpactTotal: number,
  conImpactTotal: number,
  burden: BurdenAnalysis,
  droppedByPro: number,
  droppedByCon: number,
  config: TraditionalScoringConfig
): { winner: 'pro' | 'con' | 'draw'; confidence: number } {
  // Calculate composite score for each side
  let proPoints = 0
  let conPoints = 0

  // Issue wins (weighted heavily)
  proPoints += issuesWonByPro * 20
  conPoints += issuesWonByCon * 20

  // Impact totals
  proPoints += proImpactTotal * 5
  conPoints += conImpactTotal * 5

  // Dropped arguments (penalty)
  proPoints -= droppedByPro * config.droppedArgumentPenalty
  conPoints -= droppedByCon * config.droppedArgumentPenalty

  // Burden of proof
  if (burden.burdenMet.pro && !burden.burdenMet.con) {
    proPoints += 15
  } else if (burden.burdenMet.con && !burden.burdenMet.pro) {
    conPoints += 15
  } else if (!burden.burdenMet.pro && !burden.burdenMet.con) {
    // Neither met burden - presumption wins
    if (burden.presumption === 'pro') {
      proPoints += 10
    } else if (burden.presumption === 'con') {
      conPoints += 10
    }
  }

  // Determine winner
  const difference = proPoints - conPoints
  const totalPoints = proPoints + conPoints

  if (Math.abs(difference) < config.drawMarginThreshold) {
    return {
      winner: 'draw',
      confidence: 50 - Math.abs(difference)
    }
  }

  const winner = difference > 0 ? 'pro' : 'con'
  const confidence = Math.min(95, 50 + Math.abs(difference) / (totalPoints || 1) * 100)

  return {
    winner,
    confidence: Math.round(confidence)
  }
}

// =============================================================================
// SINGLE SPEAKER EVALUATION
// =============================================================================

/**
 * Calculate speaker points for a single participant
 */
export async function calculateSpeakerPoints(
  author: string,
  theirArguments: FlowArgument[],
  clashes: ClashEvaluation[],
  centralQuestion: string
): Promise<SpeakerEvaluation> {
  const results = await evaluateSpeakers(theirArguments, clashes, centralQuestion)
  const authorResult = results.find(r => r.author === author)

  if (authorResult) {
    return authorResult
  }

  // Fallback
  return {
    author,
    position: theirArguments[0]?.position || 'pro',
    content: 25,
    style: 25,
    strategy: 12,
    speakerPoints: 62,
    intellectualHonesty: 6,
    concessionsMade: 0,
    droppedArguments: 0,
    argumentsMade: theirArguments.length,
    argumentsWon: 0,
    argumentsLost: 0
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default calculateTraditionalVerdict
