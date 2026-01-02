/**
 * Clash Evaluation Module - Phase 3 of Traditional Debate Scoring
 *
 * Evaluates argumentative clashes and groups arguments into contested issues:
 * - Identifies clash type (denial, turn, outweigh, etc.)
 * - Determines clash winner
 * - Groups related arguments into debate issues
 * - Calculates issue-level winners
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  FlowArgument,
  ClashEvaluation,
  ClashType,
  DebateIssue,
  TraditionalScoringConfig
} from '@/types/debate-scoring'
import { DEFAULT_SCORING_CONFIG } from '@/types/debate-scoring'

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

interface ClashAnalysisResponse {
  attackerId: string
  defenderId: string
  clashType: ClashType
  clashQuality: number
  winner: 'attacker' | 'defender' | 'draw'
  winnerReasoning: string
}

interface IssueGroupingResponse {
  issues: Array<{
    topic: string
    description: string
    argumentIds: string[]
    centralityScore: number  // 0-10: How central to the main question
  }>
}

// =============================================================================
// CLASH EVALUATION - Claude API Call
// =============================================================================

/**
 * Evaluate all clashes between linked arguments
 * A clash occurs when one argument directly responds to another
 */
export async function evaluateClashes(
  args: FlowArgument[],
  centralQuestion: string
): Promise<ClashEvaluation[]> {
  // Find all argument pairs where one responds to another
  const clashPairs: Array<{ attacker: FlowArgument; defender: FlowArgument }> = []

  for (const arg of args) {
    if (arg.respondsTo) {
      const defender = args.find(a => a.id === arg.respondsTo)
      if (defender && arg.position !== defender.position) {
        // Only count as clash if positions are opposite
        clashPairs.push({ attacker: arg, defender })
      }
    }
  }

  if (clashPairs.length === 0) {
    console.log('[Clash Evaluation] No clashes found')
    return []
  }

  console.log(`[Clash Evaluation] Evaluating ${clashPairs.length} clashes...`)

  const client = getAnthropicClient()
  const results: ClashEvaluation[] = []

  // Process in batches of 3 for detailed evaluation
  const batchSize = 3

  for (let i = 0; i < clashPairs.length; i += batchSize) {
    const batch = clashPairs.slice(i, i + batchSize)

    const clashesContext = batch.map((pair, idx) => `
[CLASH ${idx + 1}]
Attacker ID: ${pair.attacker.id}
Defender ID: ${pair.defender.id}

DEFENDING ARGUMENT (${pair.defender.position.toUpperCase()} by ${pair.defender.author}):
Claim: "${pair.defender.claim}"
Warrant: ${pair.defender.warrant ? `"${pair.defender.warrant}"` : 'None'}
Impact: ${pair.defender.impact ? `"${pair.defender.impact}"` : 'None stated'}
Strength: ${pair.defender.finalEvaluation?.overallStrength || 'Not evaluated'}/10

ATTACKING ARGUMENT (${pair.attacker.position.toUpperCase()} by ${pair.attacker.author}):
Claim: "${pair.attacker.claim}"
Warrant: ${pair.attacker.warrant ? `"${pair.attacker.warrant}"` : 'None'}
Impact: ${pair.attacker.impact ? `"${pair.attacker.impact}"` : 'None stated'}
Strength: ${pair.attacker.finalEvaluation?.overallStrength || 'Not evaluated'}/10
---`).join('\n')

    const prompt = `You are a trained debate judge evaluating argumentative clashes.

CENTRAL QUESTION: ${centralQuestion}

CLASHES TO EVALUATE:
${clashesContext}

For EACH clash, determine:

1. CLASH TYPE - What kind of refutation is being attempted?
   - denial: "That's not true because..." - Directly disputes the factual claim
   - mitigation: "Even if true, it's not that bad because..." - Accepts but minimizes
   - turn: "Actually, your argument supports MY side because..." - Flips the argument
   - outweigh: "Even if true, my argument is more important because..." - Concedes but priorities
   - no_link: "Your evidence doesn't support your claim because..." - Disputes internal logic
   - counterplan: "Here's a better solution..." - Offers alternative
   - talking_past: Arguments don't actually engage with each other (score = 0)

2. CLASH QUALITY (0-10) - How effectively do they engage?
   - 10: Perfect point-by-point refutation with stronger evidence
   - 7-9: Strong engagement, addresses main points with reasoning
   - 4-6: Partial engagement, misses some key aspects
   - 1-3: Weak engagement, mostly ignores the actual argument
   - 0: Complete talking past each other

3. WINNER - Who won this specific exchange?
   - attacker: The refutation was more persuasive/stronger
   - defender: The original argument survived the attack
   - draw: Neither clearly prevailed

4. WINNER_REASONING - One sentence explaining why (max 100 chars)

IMPORTANT JUDGING PRINCIPLES:
- A dropped argument (no response) counts against the side that dropped it
- Quality of evidence matters more than quantity
- A "turn" that sticks is devastating (defender loses their own argument)
- "Talking past" means neither side gets credit for this exchange
- Don't let bias affect your judgment - evaluate the arguments as presented

Return JSON:
{
  "clashes": [
    {
      "attackerId": "<attacker id>",
      "defenderId": "<defender id>",
      "clashType": "<type>",
      "clashQuality": <0-10>,
      "winner": "attacker" | "defender" | "draw",
      "winnerReasoning": "<brief explanation>"
    }
  ]
}

Return ONLY valid JSON.`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const parsed = JSON.parse(cleanJsonResponse(content.text)) as {
          clashes: ClashAnalysisResponse[]
        }

        for (const clash of parsed.clashes) {
          results.push({
            id: `clash_${clash.attackerId}_${clash.defenderId}`,
            attackerId: clash.attackerId,
            defenderId: clash.defenderId,
            clashType: clash.clashType,
            clashQuality: clash.clashQuality,
            winner: clash.winner,
            winnerReasoning: clash.winnerReasoning
          })
        }
      }
    } catch (error) {
      console.error('Clash evaluation error:', error)
      // Fall back to basic evaluation for failed batch
      for (const pair of batch) {
        results.push({
          id: `clash_${pair.attacker.id}_${pair.defender.id}`,
          attackerId: pair.attacker.id,
          defenderId: pair.defender.id,
          clashType: 'contested' as ClashType,
          clashQuality: 5,
          winner: 'draw',
          winnerReasoning: 'Could not evaluate clash'
        })
      }
    }
  }

  console.log(`[Clash Evaluation] Evaluated ${results.length} clashes`)
  return results
}

/**
 * Evaluate a single clash between two arguments
 */
export async function evaluateSingleClash(
  attacker: FlowArgument,
  defender: FlowArgument,
  centralQuestion: string
): Promise<ClashEvaluation> {
  const results = await evaluateClashes([attacker, defender], centralQuestion)

  if (results.length > 0) {
    return results[0]
  }

  // Fallback
  return {
    id: `clash_${attacker.id}_${defender.id}`,
    attackerId: attacker.id,
    defenderId: defender.id,
    clashType: 'talking_past',
    clashQuality: 0,
    winner: 'draw',
    winnerReasoning: 'Arguments do not engage'
  }
}

// =============================================================================
// ISSUE GROUPING - Claude API Call
// =============================================================================

/**
 * Group arguments into contested issues
 * An issue is a distinct topic of contention in the debate
 */
export async function groupArgumentsIntoIssues(
  args: FlowArgument[],
  clashes: ClashEvaluation[],
  centralQuestion: string
): Promise<DebateIssue[]> {
  if (args.length === 0) {
    return []
  }

  console.log(`[Issue Grouping] Grouping ${args.length} arguments into issues...`)

  const client = getAnthropicClient()

  // Build argument summaries for Claude
  const argSummaries = args.map(arg => ({
    id: arg.id,
    position: arg.position,
    claim: arg.claim,
    hasResponses: arg.responses.length > 0,
    respondsTo: arg.respondsTo,
    strength: arg.finalEvaluation?.overallStrength || 5
  }))

  const prompt = `You are grouping debate arguments into distinct contested issues.

CENTRAL QUESTION: ${centralQuestion}

ARGUMENTS IN THE DEBATE:
${argSummaries.map((a, idx) => `
[${idx + 1}] ID: ${a.id}
Position: ${a.position.toUpperCase()}
Claim: "${a.claim}"
Strength: ${a.strength}/10
${a.respondsTo ? `Responds to: ${a.respondsTo}` : 'Standalone argument'}
${a.hasResponses ? 'Has responses' : 'No responses'}
---`).join('\n')}

GROUP these arguments into 2-6 DISTINCT ISSUES based on what they're arguing about.

For each issue:
1. TOPIC: Short name for the issue (3-6 words)
2. DESCRIPTION: One sentence explaining what this issue is about
3. ARGUMENT_IDS: List of argument IDs that belong to this issue
4. CENTRALITY_SCORE: How central is this issue to answering the main question? (0-10)
   - 10: Core issue that directly determines the answer
   - 7-9: Important supporting issue
   - 4-6: Relevant but secondary
   - 1-3: Tangential point

GROUPING RULES:
- Arguments that respond to each other should be in the same issue
- Related claims (even if not directly responding) should be grouped
- An argument can only belong to ONE issue
- Every argument should be assigned to an issue
- Don't create issues with only one argument unless it's truly standalone

Return JSON:
{
  "issues": [
    {
      "topic": "<short topic name>",
      "description": "<one sentence description>",
      "argumentIds": ["arg_id_1", "arg_id_2", ...],
      "centralityScore": <0-10>
    }
  ]
}

Return ONLY valid JSON.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = JSON.parse(cleanJsonResponse(content.text)) as IssueGroupingResponse

      // Build DebateIssue objects
      const issues: DebateIssue[] = []
      let issueCounter = 0

      for (const issueData of parsed.issues) {
        issueCounter++
        const issueId = `issue_${issueCounter}`

        // Get arguments for this issue
        const issueArgs = args.filter(a => issueData.argumentIds.includes(a.id))
        const proArgs = issueArgs.filter(a => a.position === 'pro')
        const conArgs = issueArgs.filter(a => a.position === 'con')

        // Get clashes for this issue
        const issueClashes = clashes.filter(c =>
          issueData.argumentIds.includes(c.attackerId) ||
          issueData.argumentIds.includes(c.defenderId)
        )

        // Find dropped arguments
        const droppedByPro = conArgs.filter(a =>
          a.status === 'dropped' ||
          (a.responses.length === 0 && proArgs.some(p => new Date(p.timestamp) > new Date(a.timestamp)))
        )
        const droppedByCon = proArgs.filter(a =>
          a.status === 'dropped' ||
          (a.responses.length === 0 && conArgs.some(c => new Date(c.timestamp) > new Date(a.timestamp)))
        )

        // Calculate issue weight from centrality
        const issueWeight = issueData.centralityScore

        // Determine winner will be done separately
        issues.push({
          id: issueId,
          topic: issueData.topic,
          description: issueData.description,
          proArguments: proArgs,
          conArguments: conArgs,
          clashes: issueClashes,
          droppedByPro,
          droppedByCon,
          issueWinner: 'draw', // Will be determined next
          issueWeight,
          reasoning: '' // Will be filled in
        })
      }

      console.log(`[Issue Grouping] Created ${issues.length} issues`)
      return issues
    }
  } catch (error) {
    console.error('Issue grouping error:', error)
  }

  // Fallback: Create a single issue with all arguments
  const proArgs = args.filter(a => a.position === 'pro')
  const conArgs = args.filter(a => a.position === 'con')

  return [{
    id: 'issue_1',
    topic: 'Main Debate',
    description: centralQuestion,
    proArguments: proArgs,
    conArguments: conArgs,
    clashes,
    droppedByPro: [],
    droppedByCon: [],
    issueWinner: 'draw',
    issueWeight: 10,
    reasoning: 'Single-issue fallback'
  }]
}

// =============================================================================
// ISSUE WINNER DETERMINATION
// =============================================================================

/**
 * Determine the winner of each issue based on clash results and dropped arguments
 */
export function determineIssueWinners(
  issues: DebateIssue[],
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): DebateIssue[] {
  return issues.map(issue => determineIssueWinner(issue, config))
}

/**
 * Determine the winner of a single issue
 */
export function determineIssueWinner(
  issue: DebateIssue,
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): DebateIssue {
  // Calculate points for each side
  let proPoints = 0
  let conPoints = 0
  const reasons: string[] = []

  // 1. Clash wins
  for (const clash of issue.clashes) {
    const attacker = [...issue.proArguments, ...issue.conArguments].find(a => a.id === clash.attackerId)
    const defender = [...issue.proArguments, ...issue.conArguments].find(a => a.id === clash.defenderId)

    if (!attacker || !defender) continue

    // Only count clashes above quality threshold
    if (clash.clashQuality < config.clashQualityThreshold) continue

    if (clash.winner === 'attacker') {
      if (attacker.position === 'pro') {
        proPoints += clash.clashQuality
        reasons.push(`PRO won clash: ${clash.winnerReasoning}`)
      } else {
        conPoints += clash.clashQuality
        reasons.push(`CON won clash: ${clash.winnerReasoning}`)
      }

      // Turn is devastating - defender loses their own argument
      if (clash.clashType === 'turn') {
        if (defender.position === 'pro') {
          proPoints -= 5
          reasons.push('PRO argument turned against them')
        } else {
          conPoints -= 5
          reasons.push('CON argument turned against them')
        }
      }
    } else if (clash.winner === 'defender') {
      if (defender.position === 'pro') {
        proPoints += clash.clashQuality * 0.5 // Defending is worth less than attacking
        reasons.push(`PRO successfully defended: ${clash.winnerReasoning}`)
      } else {
        conPoints += clash.clashQuality * 0.5
        reasons.push(`CON successfully defended: ${clash.winnerReasoning}`)
      }
    }
  }

  // 2. Dropped arguments (count against the side that dropped)
  const droppedPenalty = config.droppedArgumentPenalty

  for (const dropped of issue.droppedByPro) {
    proPoints -= droppedPenalty
    reasons.push(`PRO dropped: "${dropped.claim.substring(0, 40)}..."`)
  }

  for (const dropped of issue.droppedByCon) {
    conPoints -= droppedPenalty
    reasons.push(`CON dropped: "${dropped.claim.substring(0, 40)}..."`)
  }

  // 3. Extended arguments (bonus for arguments that stood)
  const proExtended = issue.proArguments.filter(a => a.status === 'extended')
  const conExtended = issue.conArguments.filter(a => a.status === 'extended')

  proPoints += proExtended.length * 2
  conPoints += conExtended.length * 2

  if (proExtended.length > 0) {
    reasons.push(`PRO had ${proExtended.length} uncontested argument(s)`)
  }
  if (conExtended.length > 0) {
    reasons.push(`CON had ${conExtended.length} uncontested argument(s)`)
  }

  // 4. Argument strength bonus
  const avgProStrength = issue.proArguments.length > 0
    ? issue.proArguments.reduce((sum, a) => sum + (a.finalEvaluation?.overallStrength || 5), 0) / issue.proArguments.length
    : 0
  const avgConStrength = issue.conArguments.length > 0
    ? issue.conArguments.reduce((sum, a) => sum + (a.finalEvaluation?.overallStrength || 5), 0) / issue.conArguments.length
    : 0

  proPoints += avgProStrength
  conPoints += avgConStrength

  // Determine winner
  const margin = Math.abs(proPoints - conPoints)
  let winner: 'pro' | 'con' | 'draw'
  let reasoning: string

  if (margin < config.drawMarginThreshold) {
    winner = 'draw'
    reasoning = `Close issue: PRO ${proPoints.toFixed(1)} vs CON ${conPoints.toFixed(1)}. ${reasons.slice(0, 2).join('; ')}`
  } else if (proPoints > conPoints) {
    winner = 'pro'
    reasoning = `PRO wins ${proPoints.toFixed(1)} to ${conPoints.toFixed(1)}. ${reasons.filter(r => r.startsWith('PRO')).slice(0, 2).join('; ')}`
  } else {
    winner = 'con'
    reasoning = `CON wins ${conPoints.toFixed(1)} to ${proPoints.toFixed(1)}. ${reasons.filter(r => r.startsWith('CON')).slice(0, 2).join('; ')}`
  }

  return {
    ...issue,
    issueWinner: winner,
    reasoning
  }
}

// =============================================================================
// ARGUMENT STATUS UPDATE BASED ON CLASHES
// =============================================================================

/**
 * Update argument statuses based on clash results
 * Called after clash evaluation to refine initial status determination
 */
export function updateArgumentStatusesFromClashes(
  args: FlowArgument[],
  clashes: ClashEvaluation[]
): FlowArgument[] {
  const argMap = new Map<string, FlowArgument>()
  for (const arg of args) {
    argMap.set(arg.id, { ...arg })
  }

  for (const clash of clashes) {
    const attacker = argMap.get(clash.attackerId)
    const defender = argMap.get(clash.defenderId)

    if (!attacker || !defender) continue

    // Update statuses based on clash result
    if (clash.winner === 'attacker') {
      // Defender was refuted or turned
      if (clash.clashType === 'turn') {
        defender.status = 'turned'
      } else {
        defender.status = 'refuted'
      }
      // Attacker's argument stands
      if (attacker.status === 'contested') {
        attacker.status = 'extended'
      }
    } else if (clash.winner === 'defender') {
      // Attacker's refutation failed
      if (attacker.status === 'contested') {
        attacker.status = 'refuted'
      }
      // Defender's argument stands
      if (defender.status === 'contested') {
        defender.status = 'extended'
      }
    }
    // Draw: both remain contested

    argMap.set(clash.attackerId, attacker)
    argMap.set(clash.defenderId, defender)
  }

  return Array.from(argMap.values())
}

// =============================================================================
// CLASH TYPE CLASSIFICATION (Standalone)
// =============================================================================

/**
 * Classify the type of clash based on argument content
 * Used for quick classification without full Claude evaluation
 */
export function classifyClashType(
  attacker: FlowArgument,
  defender: FlowArgument
): ClashType {
  const attackClaim = attacker.claim.toLowerCase()
  const defendClaim = defender.claim.toLowerCase()

  // Look for turn indicators
  if (attackClaim.includes('actually supports') ||
      attackClaim.includes('proves my point') ||
      attackClaim.includes('works against')) {
    return 'turn'
  }

  // Look for outweigh indicators
  if (attackClaim.includes('more important') ||
      attackClaim.includes('outweighs') ||
      attackClaim.includes('bigger issue')) {
    return 'outweigh'
  }

  // Look for mitigation indicators
  if (attackClaim.includes('even if') ||
      attackClaim.includes('not that bad') ||
      attackClaim.includes('minor')) {
    return 'mitigation'
  }

  // Look for no_link indicators
  if (attackClaim.includes("doesn't follow") ||
      attackClaim.includes("doesn't prove") ||
      attackClaim.includes('non sequitur')) {
    return 'no_link'
  }

  // Look for counterplan indicators
  if (attackClaim.includes('better solution') ||
      attackClaim.includes('alternative') ||
      attackClaim.includes('instead')) {
    return 'counterplan'
  }

  // Default to denial
  return 'denial'
}

// =============================================================================
// EXPORTS
// =============================================================================

export default evaluateClashes
