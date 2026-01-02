/**
 * Traditional Debate Scoring Module
 *
 * Implements flow-based judging methodology where debate winners are determined
 * by who won more contested issues, not by averaging quality scores.
 *
 * This module provides the core functions for:
 * - Building argument flows from comments
 * - Evaluating clashes between arguments
 * - Grouping arguments into issues
 * - Calculating verdicts based on issue wins
 * - Converting to legacy format for backward compatibility
 */

import type {
  FlowArgument,
  ArgumentStatus,
  ArgumentEvaluation,
  WarrantType,
  WarrantQuality,
  ClashEvaluation,
  ClashType,
  DebateIssue,
  SpeakerEvaluation,
  BurdenAnalysis,
  TraditionalDebateVerdict,
  TraditionalThreadVerdict,
  EvidenceDistribution,
  LegacyVerdictCompat,
  FlowAnalysisRequest,
  FlowAnalysisResult,
  FlowComment,
  VotingIssue,
  TraditionalScoringConfig
} from '@/types/debate-scoring'

import { DEFAULT_SCORING_CONFIG } from '@/types/debate-scoring'

// Import Phase 2 flow analysis functions
import {
  buildArgumentFlow as buildFlow,
  extractArgumentsFromComments,
  evaluateArguments as evaluateFlowArguments,
  linkArgumentResponses as linkResponses
} from './flow-analysis'

// Import Phase 3 clash evaluation functions
import {
  evaluateClashes as evaluateFlowClashes,
  evaluateSingleClash,
  groupArgumentsIntoIssues as groupIntoIssues,
  determineIssueWinner as calculateIssueWinner,
  determineIssueWinners,
  updateArgumentStatusesFromClashes,
  classifyClashType as classifyClash
} from './clash-evaluation'

// Import Phase 4 verdict calculation functions
import {
  evaluateSpeakers as evaluateFlowSpeakers,
  analyzeBurden as analyzeFlowBurden,
  calculateTraditionalVerdict as calculateFlowVerdict,
  identifyVotingIssues as identifyFlowVotingIssues,
  calculateSpeakerPoints as calculateFlowSpeakerPoints
} from './verdict-calculation'

// =============================================================================
// FLOW BUILDING
// =============================================================================

/**
 * Build argument flow from raw comments
 * Extracts claims, warrants, impacts and establishes response chains
 *
 * @param comments - Raw comments from the thread
 * @param centralQuestion - The main question being debated
 * @param positionDefinitions - Optional PRO/CON definitions for context
 * @returns Array of structured FlowArguments
 */
export async function buildArgumentFlow(
  comments: FlowComment[],
  centralQuestion: string,
  positionDefinitions?: { proDefinition: string; conDefinition: string }
): Promise<FlowArgument[]> {
  // Delegate to flow-analysis module
  return buildFlow({
    comments,
    centralQuestion,
    threadTitle: '', // Will be populated by caller
    positionDefinitions
  })
}

/**
 * Determine the position (PRO/CON) of an argument
 * Uses the central question to classify stance
 *
 * @param argument - The argument text to classify
 * @param centralQuestion - The question being debated
 * @returns 'pro' or 'con'
 */
export async function classifyPosition(
  argument: string,
  centralQuestion: string
): Promise<'pro' | 'con'> {
  // TODO: Implement position classification
  throw new Error('classifyPosition not yet implemented')
}

/**
 * Extract Toulmin model components from an argument
 *
 * @param text - Raw argument text
 * @returns Claim, warrant, and impact extracted from text
 */
export async function extractToulminComponents(
  text: string
): Promise<{ claim: string; warrant: string | null; impact: string | null }> {
  // TODO: Implement Toulmin extraction with Claude
  throw new Error('extractToulminComponents not yet implemented')
}

/**
 * Link response arguments to their parent arguments
 * Creates the flow structure showing argument chains
 *
 * Re-exports from flow-analysis module
 */
export { linkArgumentResponses } from './flow-analysis'

// =============================================================================
// ARGUMENT EVALUATION
// =============================================================================

/**
 * Evaluate a single argument's strength
 * Assesses claim clarity, warrant quality, and impact significance
 *
 * @param argument - The argument to evaluate
 * @returns Detailed evaluation scores
 */
export async function evaluateArgument(
  argument: FlowArgument
): Promise<ArgumentEvaluation> {
  // Use the flow-analysis module to evaluate a single argument
  const evaluations = await evaluateFlowArguments([argument])
  const evaluation = evaluations.get(argument.id)

  if (evaluation) {
    return evaluation
  }

  // Return default evaluation if API call fails
  return {
    claimClarity: 5,
    claimRelevance: 5,
    warrantPresent: !!argument.warrant,
    warrantType: argument.finalEvaluation?.warrantType || 'none',
    warrantQuality: null,
    impactMagnitude: 5,
    impactProbability: 5,
    impactTimeframe: 'speculative',
    impactReversibility: 'unknown',
    internalLinkStrength: 5,
    overallStrength: 5
  }
}

/**
 * Classify the type of warrant used in an argument
 *
 * @param warrant - The warrant text
 * @returns WarrantType classification
 */
export async function classifyWarrantType(
  warrant: string
): Promise<WarrantType> {
  // TODO: Implement warrant type classification
  throw new Error('classifyWarrantType not yet implemented')
}

/**
 * Assess the quality of a warrant/evidence
 *
 * @param warrant - The warrant text
 * @param warrantType - Type of warrant
 * @returns Quality assessment
 */
export async function assessWarrantQuality(
  warrant: string,
  warrantType: WarrantType
): Promise<WarrantQuality> {
  // TODO: Implement warrant quality assessment
  throw new Error('assessWarrantQuality not yet implemented')
}

/**
 * Determine the final status of an argument after the debate
 * Status: extended, dropped, refuted, turned, conceded, contested
 *
 * @param argument - The argument to assess
 * @param allArguments - All arguments in the debate
 * @param clashes - All evaluated clashes
 * @returns Final status of the argument
 */
export function determineArgumentStatus(
  argument: FlowArgument,
  allArguments: FlowArgument[],
  clashes: ClashEvaluation[]
): ArgumentStatus {
  // TODO: Implement status determination logic
  // - extended: made and never responded to by opponent
  // - dropped: opponent failed to respond (negative for opponent)
  // - refuted: opponent successfully answered
  // - turned: opponent turned argument against its maker
  // - conceded: maker explicitly conceded
  // - contested: both engaged, needs weighing
  throw new Error('determineArgumentStatus not yet implemented')
}

// =============================================================================
// CLASH EVALUATION
// =============================================================================

/**
 * Identify and evaluate all clashes in the debate
 * A clash occurs when one argument directly responds to another
 *
 * @param args - All arguments in the debate
 * @param centralQuestion - The main question being debated
 * @returns Array of clash evaluations
 */
export async function evaluateClashes(
  args: FlowArgument[],
  centralQuestion: string
): Promise<ClashEvaluation[]> {
  return evaluateFlowClashes(args, centralQuestion)
}

// Re-export evaluateSingleClash from clash-evaluation module
export { evaluateSingleClash } from './clash-evaluation'

/**
 * Classify the type of clash/refutation
 *
 * @param attacker - The attacking argument
 * @param defender - The defending argument
 * @returns Type of clash
 */
export function classifyClashType(
  attacker: FlowArgument,
  defender: FlowArgument
): ClashType {
  return classifyClash(attacker, defender)
}

// =============================================================================
// ISSUE GROUPING
// =============================================================================

/**
 * Group arguments into contested issues
 * An issue is a distinct topic of contention in the debate
 *
 * @param args - All arguments in the debate
 * @param clashes - All evaluated clashes
 * @param centralQuestion - The main question being debated
 * @returns Array of debate issues with grouped arguments
 */
export async function groupArgumentsIntoIssues(
  args: FlowArgument[],
  clashes: ClashEvaluation[],
  centralQuestion: string
): Promise<DebateIssue[]> {
  return groupIntoIssues(args, clashes, centralQuestion)
}

/**
 * Determine the winner of a single issue
 * Based on which side won more clashes and dropped fewer arguments
 *
 * @param issue - The issue to evaluate
 * @param config - Scoring configuration
 * @returns Updated issue with winner determined
 */
export function determineIssueWinner(
  issue: DebateIssue,
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): DebateIssue {
  return calculateIssueWinner(issue, config)
}

/**
 * Calculate the weight/importance of an issue
 * Weight is determined during issue grouping based on centrality to question
 *
 * @param issue - The issue to weigh
 * @param centralQuestion - The main debate question
 * @param config - Scoring configuration
 * @returns Weight from 0-10
 */
export async function calculateIssueWeight(
  issue: DebateIssue,
  centralQuestion: string,
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<number> {
  // Issue weight is already calculated during grouping
  // This function allows recalculation if needed
  return issue.issueWeight
}

// =============================================================================
// SPEAKER EVALUATION
// =============================================================================

/**
 * Evaluate individual speakers/participants
 * Separate from argument quality - measures communication effectiveness
 *
 * @param args - Arguments made by all participants
 * @param clashes - All clash evaluations
 * @param centralQuestion - The main question being debated
 * @returns Speaker evaluations for each participant
 */
export async function evaluateSpeakers(
  args: FlowArgument[],
  clashes: ClashEvaluation[],
  centralQuestion: string
): Promise<SpeakerEvaluation[]> {
  return evaluateFlowSpeakers(args, clashes, centralQuestion)
}

/**
 * Calculate speaker points for a single participant
 * Uses World Schools format: Content (40) + Style (40) + Strategy (20)
 *
 * @param author - The participant to evaluate
 * @param theirArguments - Arguments made by this participant
 * @param clashes - Clashes involving their arguments
 * @param centralQuestion - The main question being debated
 * @returns Speaker evaluation with breakdown
 */
export async function calculateSpeakerPoints(
  author: string,
  theirArguments: FlowArgument[],
  clashes: ClashEvaluation[],
  centralQuestion: string
): Promise<SpeakerEvaluation> {
  return calculateFlowSpeakerPoints(author, theirArguments, clashes, centralQuestion)
}

// =============================================================================
// BURDEN OF PROOF
// =============================================================================

/**
 * Analyze burden of proof in the debate
 * Determines what each side must prove and whether they succeeded
 *
 * @param centralQuestion - The main question being debated
 * @param issues - All contested issues
 * @param args - All arguments in the debate
 * @returns Burden analysis
 */
export async function analyzeBurden(
  centralQuestion: string,
  issues: DebateIssue[],
  args: FlowArgument[]
): Promise<BurdenAnalysis> {
  return analyzeFlowBurden(centralQuestion, issues, args)
}

// =============================================================================
// VERDICT CALCULATION
// =============================================================================

/**
 * Calculate the final debate verdict using traditional methodology
 *
 * @param request - Flow analysis request with comments and context
 * @param args - All arguments in the debate
 * @param clashes - All clash evaluations
 * @param issues - All debate issues
 * @param config - Scoring configuration
 * @returns Complete traditional debate verdict
 */
export async function calculateTraditionalVerdict(
  request: FlowAnalysisRequest,
  args: FlowArgument[],
  clashes: ClashEvaluation[],
  issues: DebateIssue[],
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<TraditionalDebateVerdict> {
  return calculateFlowVerdict(request, args, clashes, issues, config)
}

/**
 * Identify the voting issues (key reasons the winner won)
 *
 * @param issues - All debate issues with winners determined
 * @param winner - The overall debate winner
 * @returns Key voting issues that decided the debate
 */
export function identifyVotingIssues(
  issues: DebateIssue[],
  winner: 'pro' | 'con' | 'draw'
): VotingIssue[] {
  return identifyFlowVotingIssues(issues, winner)
}

/**
 * Generate the evidence distribution summary
 *
 * @param arguments - All arguments in the debate
 * @returns Distribution of evidence types used
 */
export function calculateEvidenceDistribution(
  args: FlowArgument[]
): EvidenceDistribution {
  const distribution: EvidenceDistribution = {
    empirical: 0,
    testimonial: 0,
    analogical: 0,
    logical: 0,
    experiential: 0,
    unsupported: 0
  }

  for (const arg of args) {
    if (!arg.finalEvaluation?.warrantType) {
      distribution.unsupported++
    } else {
      switch (arg.finalEvaluation.warrantType) {
        case 'empirical':
          distribution.empirical++
          break
        case 'testimonial':
          distribution.testimonial++
          break
        case 'analogical':
          distribution.analogical++
          break
        case 'logical':
          distribution.logical++
          break
        case 'experiential':
          distribution.experiential++
          break
        case 'none':
          distribution.unsupported++
          break
      }
    }
  }

  return distribution
}

/**
 * Calculate composite scores for UI display
 * Converts issue-based verdict to 0-100 scores
 *
 * @param verdict - The traditional verdict (partial, before summary/notes)
 * @returns PRO and CON scores (0-100)
 */
export function calculateDisplayScores(
  verdict: Omit<TraditionalDebateVerdict, 'proScore' | 'conScore' | 'margin' | 'verdictSummary' | 'judgeNotes'>
): { proScore: number; conScore: number; margin: number } {
  // Convert issue wins to percentage-based scores
  const totalIssues = verdict.issuesWonByPro + verdict.issuesWonByCon + verdict.issueDraws

  if (totalIssues === 0) {
    return { proScore: 50, conScore: 50, margin: 0 }
  }

  // Base score from issues won
  const proIssueScore = (verdict.issuesWonByPro / totalIssues) * 60
  const conIssueScore = (verdict.issuesWonByCon / totalIssues) * 60

  // Impact bonus (up to 20 points)
  const totalImpact = verdict.proImpactTotal + verdict.conImpactTotal
  const proImpactBonus = totalImpact > 0 ? (verdict.proImpactTotal / totalImpact) * 20 : 10
  const conImpactBonus = totalImpact > 0 ? (verdict.conImpactTotal / totalImpact) * 20 : 10

  // Speaker average bonus (up to 20 points)
  const proSpeakers = verdict.speakers.filter(s => s.position === 'pro')
  const conSpeakers = verdict.speakers.filter(s => s.position === 'con')
  const proSpeakerAvg = proSpeakers.length > 0
    ? proSpeakers.reduce((sum, s) => sum + s.speakerPoints, 0) / proSpeakers.length / 5
    : 10
  const conSpeakerAvg = conSpeakers.length > 0
    ? conSpeakers.reduce((sum, s) => sum + s.speakerPoints, 0) / conSpeakers.length / 5
    : 10

  const proScore = Math.round(proIssueScore + proImpactBonus + proSpeakerAvg)
  const conScore = Math.round(conIssueScore + conImpactBonus + conSpeakerAvg)
  const margin = Math.abs(proScore - conScore)

  return { proScore, conScore, margin }
}

// =============================================================================
// THREAD AGGREGATION
// =============================================================================

/**
 * Aggregate multiple debate verdicts into a thread-level verdict
 *
 * @param debates - Individual debate verdicts
 * @param threadId - Thread identifier
 * @returns Aggregated thread verdict
 */
export function aggregateThreadVerdict(
  debates: TraditionalDebateVerdict[],
  threadId: string
): TraditionalThreadVerdict {
  // TODO: Implement thread aggregation
  throw new Error('aggregateThreadVerdict not yet implemented')
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * Convert traditional verdict to legacy format
 * For backward compatibility with existing UI components
 *
 * @param verdict - Traditional verdict
 * @returns Legacy-compatible verdict object
 */
export function toLegacyVerdict(
  verdict: TraditionalDebateVerdict | TraditionalThreadVerdict
): LegacyVerdictCompat {
  const isThread = 'debates' in verdict

  if (isThread) {
    const threadVerdict = verdict as TraditionalThreadVerdict
    return {
      overallScore: threadVerdict.verdictConfidence / 10,
      summary: threadVerdict.verdictSummary,
      evidenceQualityPct: calculateEvidenceQualityPct(threadVerdict.evidenceDistribution),
      civilityScore: threadVerdict.averageSpeakerPoints / 10,
      worthReading: threadVerdict.recommendedReading,
      winningPosition: threadVerdict.overallWinner === 'unresolved' ? undefined : threadVerdict.overallWinner
    }
  }

  const debateVerdict = verdict as TraditionalDebateVerdict
  return {
    overallScore: debateVerdict.winnerConfidence / 10,
    summary: debateVerdict.verdictSummary,
    evidenceQualityPct: 0, // TODO: Calculate from debate arguments
    civilityScore: debateVerdict.speakers.length > 0
      ? debateVerdict.speakers.reduce((sum, s) => sum + s.intellectualHonesty, 0) / debateVerdict.speakers.length
      : 5,
    worthReading: debateVerdict.winnerConfidence > 50,
    conclusion: debateVerdict.judgeNotes,
    winningPosition: debateVerdict.winner
  }
}

/**
 * Calculate evidence quality percentage from distribution
 */
function calculateEvidenceQualityPct(dist: EvidenceDistribution): number {
  const total = dist.empirical + dist.testimonial + dist.analogical +
    dist.logical + dist.experiential + dist.unsupported

  if (total === 0) return 0

  // Weight evidence types by quality
  const weightedSum =
    dist.empirical * 1.0 +
    dist.testimonial * 0.8 +
    dist.analogical * 0.6 +
    dist.logical * 0.7 +
    dist.experiential * 0.4 +
    dist.unsupported * 0.0

  return Math.round((weightedSum / total) * 100)
}

// =============================================================================
// FULL ANALYSIS PIPELINE
// =============================================================================

/**
 * Run the complete flow analysis pipeline
 * Main entry point for traditional scoring
 *
 * @param request - Analysis request with comments and context
 * @returns Complete flow analysis result
 */
export async function runFlowAnalysis(
  request: FlowAnalysisRequest
): Promise<FlowAnalysisResult> {
  const { centralQuestion } = request

  // Phase 2: Build argument flow
  console.log('[Traditional Scoring] Phase 2: Building argument flow...')
  let args = await buildFlow(request)

  // Phase 3: Evaluate clashes
  console.log('[Traditional Scoring] Phase 3: Evaluating clashes...')
  const clashes = await evaluateFlowClashes(args, centralQuestion)

  // Update argument statuses based on clash results
  args = updateArgumentStatusesFromClashes(args, clashes)

  // Phase 3: Group into issues and determine winners
  console.log('[Traditional Scoring] Phase 3: Grouping into issues...')
  let issues = await groupIntoIssues(args, clashes, centralQuestion)

  // Determine winners for each issue
  issues = determineIssueWinners(issues)

  // Phase 4: Evaluate speakers
  console.log('[Traditional Scoring] Phase 4: Evaluating speakers...')
  const speakers = await evaluateFlowSpeakers(args, clashes, centralQuestion)

  // Phase 4: Analyze burden of proof
  console.log('[Traditional Scoring] Phase 4: Analyzing burden of proof...')
  const burden = await analyzeFlowBurden(centralQuestion, issues, args)

  console.log('[Traditional Scoring] Flow analysis complete')
  return {
    arguments: args,
    clashes,
    issues,
    speakers,
    burden
  }
}

/**
 * Generate human-readable verdict summary
 *
 * @param verdict - The verdict with scores calculated
 * @returns Narrative summary of the debate outcome
 */
export function generateVerdictSummary(
  verdict: Omit<TraditionalDebateVerdict, 'verdictSummary' | 'judgeNotes'>
): string {
  const winner = verdict.winner
  const confidence = verdict.winnerConfidence

  if (winner === 'draw') {
    return `This debate ended in a draw. Both sides won ${verdict.issuesWonByPro} issues each, ` +
      `with neither achieving a decisive advantage in impact or argumentation quality.`
  }

  const winnerName = winner === 'pro' ? 'PRO' : 'CON'
  const loserName = winner === 'pro' ? 'CON' : 'PRO'
  const issuesWon = winner === 'pro' ? verdict.issuesWonByPro : verdict.issuesWonByCon
  const issuesLost = winner === 'pro' ? verdict.issuesWonByCon : verdict.issuesWonByPro

  let summary = `${winnerName} wins this debate `

  if (confidence >= 80) {
    summary += 'decisively'
  } else if (confidence >= 60) {
    summary += 'clearly'
  } else {
    summary += 'narrowly'
  }

  summary += `, winning ${issuesWon} of ${issuesWon + issuesLost + verdict.issueDraws} contested issues. `

  // Add key voting issue if available
  if (verdict.votingIssues.length > 0) {
    const keyIssue = verdict.votingIssues[0]
    summary += `The decisive issue was "${keyIssue.issue}": ${keyIssue.explanation}`
  }

  return summary
}

/**
 * Generate judge notes explaining the decision
 *
 * @param verdict - The verdict with summary generated
 * @returns Detailed judge notes
 */
export function generateJudgeNotes(
  verdict: Omit<TraditionalDebateVerdict, 'judgeNotes'>
): string {
  const notes: string[] = []

  // Burden analysis
  if (verdict.burden.burdenMet.pro && !verdict.burden.burdenMet.con) {
    notes.push(`PRO successfully met their burden to prove ${verdict.burden.affirmativeBurden}.`)
  } else if (!verdict.burden.burdenMet.pro && verdict.burden.burdenMet.con) {
    notes.push(`CON successfully met their burden while PRO failed to establish their case.`)
  }

  // Dropped arguments impact
  const totalDropped = verdict.droppedByPro + verdict.droppedByCon
  if (totalDropped > 0) {
    notes.push(`There were ${totalDropped} dropped arguments that significantly impacted the outcome.`)
  }

  // Issue breakdown
  notes.push(`Issue breakdown: PRO won ${verdict.issuesWonByPro}, CON won ${verdict.issuesWonByCon}, ${verdict.issueDraws} draws.`)

  // Voting issues
  for (const issue of verdict.votingIssues) {
    notes.push(`• ${issue.issue}: Won by ${issue.winner.toUpperCase()} - ${issue.explanation}`)
  }

  return notes.join('\n\n')
}
