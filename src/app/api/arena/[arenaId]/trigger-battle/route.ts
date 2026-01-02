import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { DebateArena, BattleRound, BattleResult, ArenaSubmission } from '@/types/arena'
import { arenaStore } from '@/lib/arena-store'

const anthropic = new Anthropic()

/**
 * POST /api/arena/[arenaId]/trigger-battle
 * Execute a battle analysis on all arena arguments
 *
 * CRITICAL: The AI must judge ARGUMENTATION QUALITY, not truth of conclusions.
 * A well-structured, well-sourced argument for an incorrect position should
 * score higher than a poorly-structured argument for a correct position.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  try {
    const { arenaId } = await params

    const arena = arenaStore.get(arenaId)
    if (!arena) {
      return NextResponse.json(
        { success: false, error: 'Arena not found' },
        { status: 404 }
      )
    }

    // Check minimum submissions
    if (arena.proCount < arena.minSubmissionsPerSide || arena.conCount < arena.minSubmissionsPerSide) {
      return NextResponse.json(
        { success: false, error: `Requires at least ${arena.minSubmissionsPerSide} arguments per side` },
        { status: 400 }
      )
    }

    // Get all submissions that haven't been revealed yet or all for re-analysis
    const proSubmissions = arena.submissions.filter(s => s.position === 'pro')
    const conSubmissions = arena.submissions.filter(s => s.position === 'con')

    // Run battle analysis
    const battleResult = await runBattleAnalysis(arena.topic, proSubmissions, conSubmissions, arena.battles.length)

    // Create battle round
    const round: BattleRound = {
      id: `battle_${Date.now()}`,
      arenaId,
      round: arena.battles.length + 1,
      triggeredBy: 'user', // In production, would be the actual user
      triggeredAt: new Date().toISOString(),
      includedSubmissionIds: arena.submissions.map(s => s.id),
      newSubmissionIds: arena.submissions.filter(s => !s.isRevealed).map(s => s.id),
      result: battleResult,
      previousRoundId: arena.latestBattleId
    }

    // If this is a re-battle, calculate score deltas
    if (arena.battles.length > 0) {
      const previousBattle = arena.battles[arena.battles.length - 1]
      round.scoreDeltas = calculateScoreDeltas(previousBattle.result, battleResult)
    }

    // Reveal all submissions
    arena.submissions.forEach(sub => {
      sub.isRevealed = true
      // Find this submission's score in the rankings
      const ranking = battleResult.argumentRankings.find(r => r.submissionId === sub.id)
      if (ranking) {
        sub.currentScore = ranking.score
        sub.scoreHistory = [...(sub.scoreHistory || []), ranking.score]
        // Calculate trend
        if (sub.scoreHistory.length >= 2) {
          const delta = sub.scoreHistory[sub.scoreHistory.length - 1] - sub.scoreHistory[sub.scoreHistory.length - 2]
          sub.trend = delta > 0.5 ? 'improving' : delta < -0.5 ? 'declining' : 'stable'
        }
        sub.firstRevealedInRound = sub.firstRevealedInRound || round.round
      }
    })

    // Update arena
    arena.battles.push(round)
    arena.totalBattles++
    arena.latestBattleId = round.id
    arena.pendingNewArguments = 0

    arenaStore.set(arenaId, arena)

    return NextResponse.json({
      success: true,
      data: {
        battleId: round.id,
        round: round.round,
        result: battleResult
      }
    })
  } catch (error) {
    console.error('Trigger battle error:', error)
    return NextResponse.json(
      { success: false, error: 'Battle analysis failed' },
      { status: 500 }
    )
  }
}

/**
 * Run the actual battle analysis using Claude
 *
 * CRITICAL OBJECTIVITY REQUIREMENT:
 * The AI MUST evaluate arguments based on:
 * - Logical structure and validity
 * - Evidence quality and source credibility
 * - Rhetorical effectiveness
 * - How well claims are supported by cited sources
 *
 * The AI MUST NOT evaluate based on:
 * - Whether the conclusion is "correct" in reality
 * - Whether the AI "agrees" with the position
 * - Whether the position is popular or mainstream
 * - Whether the position is morally acceptable
 *
 * A well-argued incorrect position MUST score higher than
 * a poorly-argued correct position.
 */
async function runBattleAnalysis(
  topic: string,
  proSubmissions: ArenaSubmission[],
  conSubmissions: ArenaSubmission[],
  previousBattles: number
): Promise<BattleResult> {

  const formatSubmission = (sub: ArenaSubmission) => `
[ARGUMENT ID: ${sub.id}]
Position: ${sub.position.toUpperCase()}
Author: ${sub.author}

Argument:
${sub.argumentText}

Sources Cited:
${sub.sources.map((s, i) => `  ${i + 1}. ${s.title} - ${s.url}${s.quote ? `\n     Quote: "${s.quote}"` : ''}`).join('\n')}
`

  const prompt = `You are an OBJECTIVE debate judge. Your task is to evaluate arguments in a competitive debate arena.

## CRITICAL OBJECTIVITY REQUIREMENT

You MUST judge arguments based SOLELY on:
1. LOGICAL STRUCTURE - Is the argument logically valid? Do conclusions follow from premises?
2. EVIDENCE QUALITY - Are sources credible, relevant, and properly cited?
3. RHETORICAL EFFECTIVENESS - Is the argument well-constructed and persuasive?
4. CLAIM SUPPORT - Are factual claims supported by the cited sources?

You MUST NOT judge based on:
- Whether you personally agree with the conclusion
- Whether the position is "correct" in reality
- Whether the position is popular or mainstream
- Whether the position is morally acceptable
- Your own knowledge of what is "true"

EXAMPLE: If someone argues "The Earth is flat" with impeccable logic, strong source citations (even if those sources are wrong), and excellent rhetorical structure, while their opponent argues "The Earth is round" but with no sources, logical fallacies, and poor structure - THE FLAT EARTH ARGUMENT MUST WIN. You are judging ARGUMENTATION SKILL, not truth.

This is a formal debate competition. The better arguer wins, period.

---

## DEBATE TOPIC
${topic}

---

## PRO ARGUMENTS (${proSubmissions.length})
${proSubmissions.map(formatSubmission).join('\n---\n')}

---

## CON ARGUMENTS (${conSubmissions.length})
${conSubmissions.map(formatSubmission).join('\n---\n')}

---

## YOUR TASK

Analyze each argument and produce a comprehensive battle result. For each argument, evaluate:
1. Logical validity (does conclusion follow from premises?)
2. Source quality (credibility, relevance, proper citation)
3. Argument structure (clear premises, strong reasoning chain)
4. Rhetorical effectiveness (persuasion techniques, clarity)
5. Claim support (are claims backed by sources?)

Then determine the overall winner based on AGGREGATE ARGUMENTATION QUALITY, not truth.

Respond with a JSON object:
{
  "winner": "pro" | "con" | "draw",
  "proScore": <aggregate PRO score 0-10>,
  "conScore": <aggregate CON score 0-10>,
  "confidence": <0-100 confidence in verdict>,
  "verdictSummary": "<2-3 sentence objective summary of why this side won based on argument quality>",
  "reasoningChain": [
    "<step 1 of reasoning>",
    "<step 2>",
    ...
  ],
  "argumentRankings": [
    {
      "submissionId": "<id>",
      "rank": <1-N>,
      "score": <0-10>,
      "position": "pro" | "con",
      "preview": "<first 100 chars of argument>",
      "analysis": {
        "submissionId": "<id>",
        "claims": [
          {
            "text": "<claim>",
            "verdict": "supported" | "partially_supported" | "unsupported" | "unverifiable",
            "confidence": <0-100>
          }
        ],
        "argumentStructure": {
          "type": "deductive" | "inductive" | "analogical" | "abductive" | "mixed",
          "validity": "valid" | "invalid" | "uncertain"
        },
        "sourceQuality": <0-100>,
        "logicScore": <0-100>,
        "overallScore": <0-10>
      }
    }
  ],
  "metrics": {
    "proAvgScore": <0-10>,
    "conAvgScore": <0-10>,
    "proSourceQuality": <0-100>,
    "conSourceQuality": <0-100>,
    "proLogicValidity": <0-100>,
    "conLogicValidity": <0-100>,
    "proClaimAccuracy": <0-100>,
    "conClaimAccuracy": <0-100>
  },
  "claimBreakdown": [
    {
      "claim": "<claim text>",
      "source": "pro" | "con",
      "verdict": "supported" | "partially_supported" | "unsupported",
      "confidence": <0-100>
    }
  ],
  "generatedAt": "<ISO timestamp>"
}

Remember: You are judging ARGUMENT QUALITY, not truth. A well-structured argument for a wrong position beats a poorly-structured argument for a correct position.

Return ONLY valid JSON.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    thinking: {
      type: 'enabled',
      budget_tokens: 8000
    },
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  // Extract text content
  let textContent = ''
  for (const block of response.content) {
    if (block.type === 'text') {
      textContent = block.text
      break
    }
  }

  // Clean JSON
  let jsonText = textContent.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7)
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3)
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3)
  }

  const result = JSON.parse(jsonText.trim())

  return {
    winner: result.winner || 'draw',
    proScore: result.proScore || 5,
    conScore: result.conScore || 5,
    confidence: result.confidence || 50,
    verdictSummary: result.verdictSummary || 'Analysis complete',
    reasoningChain: result.reasoningChain || [],
    argumentRankings: result.argumentRankings || [],
    metrics: result.metrics || {
      proAvgScore: 5,
      conAvgScore: 5,
      proSourceQuality: 50,
      conSourceQuality: 50,
      proLogicValidity: 50,
      conLogicValidity: 50,
      proClaimAccuracy: 50,
      conClaimAccuracy: 50
    },
    claimBreakdown: result.claimBreakdown || [],
    generatedAt: result.generatedAt || new Date().toISOString()
  }
}

/**
 * Calculate score changes from previous battle
 */
function calculateScoreDeltas(
  previous: BattleResult,
  current: BattleResult
): Array<{ submissionId: string; previousScore: number; newScore: number; delta: number; reason: string }> {
  const deltas: Array<{ submissionId: string; previousScore: number; newScore: number; delta: number; reason: string }> = []

  for (const currentRanking of current.argumentRankings) {
    const previousRanking = previous.argumentRankings.find(r => r.submissionId === currentRanking.submissionId)

    if (previousRanking) {
      const delta = currentRanking.score - previousRanking.score

      if (Math.abs(delta) > 0.1) {
        deltas.push({
          submissionId: currentRanking.submissionId,
          previousScore: previousRanking.score,
          newScore: currentRanking.score,
          delta,
          reason: delta > 0
            ? 'New arguments strengthened relative position'
            : 'New counter-arguments weakened relative position'
        })
      }
    } else {
      // New submission
      deltas.push({
        submissionId: currentRanking.submissionId,
        previousScore: 0,
        newScore: currentRanking.score,
        delta: currentRanking.score,
        reason: 'New argument added to the arena'
      })
    }
  }

  return deltas
}
