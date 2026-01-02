/**
 * Scoring Calibration Module - Phase 6 of Traditional Debate Scoring
 *
 * Provides tools for:
 * - Testing the scoring system with sample data
 * - Calibrating thresholds for different debate types
 * - Comparing traditional vs legacy scoring
 * - Logging metrics for analysis
 */

import type {
  TraditionalScoringConfig,
  FlowAnalysisRequest,
  FlowAnalysisResult,
  TraditionalDebateVerdict,
  FlowComment
} from '@/types/debate-scoring'
import { DEFAULT_SCORING_CONFIG } from '@/types/debate-scoring'

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

/**
 * Strict configuration - higher penalties for drops, requires higher clash quality
 * Best for formal debates with clear structure
 */
export const STRICT_CONFIG: TraditionalScoringConfig = {
  issueWeights: {
    argumentCount: 0.2,
    impactMagnitude: 0.6,
    centralityToQuestion: 0.2
  },
  droppedArgumentPenalty: 8,
  clashQualityThreshold: 5,
  drawMarginThreshold: 3,
  speakerPointScale: {
    content: 40,
    style: 40,
    strategy: 20
  }
}

/**
 * Lenient configuration - lower penalties, more forgiving thresholds
 * Best for casual discussions or debates with less structure
 */
export const LENIENT_CONFIG: TraditionalScoringConfig = {
  issueWeights: {
    argumentCount: 0.4,
    impactMagnitude: 0.4,
    centralityToQuestion: 0.2
  },
  droppedArgumentPenalty: 3,
  clashQualityThreshold: 2,
  drawMarginThreshold: 8,
  speakerPointScale: {
    content: 40,
    style: 40,
    strategy: 20
  }
}

/**
 * Impact-focused configuration - heavily weights impact over argument count
 * Best for policy debates where consequences matter most
 */
export const IMPACT_FOCUSED_CONFIG: TraditionalScoringConfig = {
  issueWeights: {
    argumentCount: 0.15,
    impactMagnitude: 0.7,
    centralityToQuestion: 0.15
  },
  droppedArgumentPenalty: 5,
  clashQualityThreshold: 4,
  drawMarginThreshold: 5,
  speakerPointScale: {
    content: 40,
    style: 40,
    strategy: 20
  }
}

/**
 * Argument-count focused - weights quantity of arguments
 * Best for ChangeMyView style debates with many participants
 */
export const QUANTITY_FOCUSED_CONFIG: TraditionalScoringConfig = {
  issueWeights: {
    argumentCount: 0.5,
    impactMagnitude: 0.3,
    centralityToQuestion: 0.2
  },
  droppedArgumentPenalty: 4,
  clashQualityThreshold: 2,
  drawMarginThreshold: 6,
  speakerPointScale: {
    content: 40,
    style: 40,
    strategy: 20
  }
}

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Sample debate fixture for testing - a simple 2-argument debate
 */
export const SIMPLE_DEBATE_FIXTURE: FlowComment[] = [
  {
    id: 'test_1',
    author: 'ProDebater',
    text: 'The evidence clearly shows that renewable energy is cost-effective. According to the IEA 2023 report, solar costs have dropped 89% since 2010, making it cheaper than coal in most markets.',
    timestamp: '2024-01-01T10:00:00Z',
    parentId: null,
    karma: 50
  },
  {
    id: 'test_2',
    author: 'ConDebater',
    text: 'While costs have dropped, the intermittency problem remains unsolved. The grid cannot handle more than 30% renewable penetration without massive battery infrastructure that doesn\'t exist yet.',
    timestamp: '2024-01-01T10:30:00Z',
    parentId: 'test_1',
    karma: 45
  },
  {
    id: 'test_3',
    author: 'ProDebater',
    text: 'Actually, the 30% limit is outdated. Germany reached 46% renewables in 2023, and studies show grids can handle 70%+ with existing technology. The battery argument ignores pumped hydro and demand response.',
    timestamp: '2024-01-01T11:00:00Z',
    parentId: 'test_2',
    karma: 60
  },
  {
    id: 'test_4',
    author: 'ConDebater',
    text: 'Germany also has the highest electricity prices in Europe. The "existing technology" point concedes massive infrastructure costs. This makes the cost-effectiveness claim questionable at scale.',
    timestamp: '2024-01-01T11:30:00Z',
    parentId: 'test_3',
    karma: 40
  }
]

/**
 * Sample debate with clear winner (PRO dominates)
 */
export const PRO_DOMINANT_FIXTURE: FlowComment[] = [
  {
    id: 'dom_1',
    author: 'StrongPro',
    text: 'Remote work increases productivity by 13% according to Stanford research. It also reduces overhead costs by 30% and improves employee satisfaction by 20%.',
    timestamp: '2024-01-01T10:00:00Z',
    parentId: null,
    karma: 100
  },
  {
    id: 'dom_2',
    author: 'WeakCon',
    text: 'But what about company culture?',
    timestamp: '2024-01-01T10:30:00Z',
    parentId: 'dom_1',
    karma: 10
  },
  {
    id: 'dom_3',
    author: 'StrongPro',
    text: 'Company culture can be maintained through regular virtual meetings and quarterly in-person events. Gitlab has 1500 employees fully remote with excellent culture scores.',
    timestamp: '2024-01-01T11:00:00Z',
    parentId: 'dom_2',
    karma: 80
  }
  // Note: WeakCon drops the argument
]

/**
 * Sample debate with draw (equally matched)
 */
export const DRAW_FIXTURE: FlowComment[] = [
  {
    id: 'draw_1',
    author: 'BalancedPro',
    text: 'Nuclear energy provides reliable baseload power with zero carbon emissions during operation.',
    timestamp: '2024-01-01T10:00:00Z',
    parentId: null,
    karma: 50
  },
  {
    id: 'draw_2',
    author: 'BalancedCon',
    text: 'Nuclear waste remains radioactive for thousands of years with no permanent storage solution.',
    timestamp: '2024-01-01T10:30:00Z',
    parentId: 'draw_1',
    karma: 50
  },
  {
    id: 'draw_3',
    author: 'BalancedPro',
    text: 'Modern reactors produce minimal waste, and deep geological storage has been proven safe in Finland.',
    timestamp: '2024-01-01T11:00:00Z',
    parentId: 'draw_2',
    karma: 48
  },
  {
    id: 'draw_4',
    author: 'BalancedCon',
    text: 'Finland is one example. Most countries lack suitable geology. The cost and timeline for building new plants is prohibitive.',
    timestamp: '2024-01-01T11:30:00Z',
    parentId: 'draw_3',
    karma: 52
  }
]

// =============================================================================
// CALIBRATION METRICS
// =============================================================================

export interface CalibrationMetrics {
  // Basic counts
  totalArguments: number
  proArguments: number
  conArguments: number
  totalClashes: number

  // Status breakdown
  statusBreakdown: {
    extended: number
    dropped: number
    refuted: number
    turned: number
    conceded: number
    contested: number
  }

  // Issue metrics
  totalIssues: number
  proIssueWins: number
  conIssueWins: number
  issueDraws: number
  averageIssueWeight: number

  // Clash quality
  averageClashQuality: number
  lowQualityClashes: number  // Below threshold

  // Verdict confidence
  winnerConfidence: number
  scoreMargin: number

  // Time metrics
  analysisTimeMs: number
}

/**
 * Extract calibration metrics from flow analysis result
 */
export function extractCalibrationMetrics(
  result: FlowAnalysisResult,
  verdict: TraditionalDebateVerdict | null,
  analysisTimeMs: number
): CalibrationMetrics {
  const statusBreakdown = {
    extended: 0,
    dropped: 0,
    refuted: 0,
    turned: 0,
    conceded: 0,
    contested: 0
  }

  for (const arg of result.arguments) {
    statusBreakdown[arg.status]++
  }

  const totalClashQuality = result.clashes.reduce((sum, c) => sum + c.clashQuality, 0)
  const avgClashQuality = result.clashes.length > 0
    ? totalClashQuality / result.clashes.length
    : 0

  const totalIssueWeight = result.issues.reduce((sum, i) => sum + i.issueWeight, 0)
  const avgIssueWeight = result.issues.length > 0
    ? totalIssueWeight / result.issues.length
    : 0

  return {
    totalArguments: result.arguments.length,
    proArguments: result.arguments.filter(a => a.position === 'pro').length,
    conArguments: result.arguments.filter(a => a.position === 'con').length,
    totalClashes: result.clashes.length,

    statusBreakdown,

    totalIssues: result.issues.length,
    proIssueWins: result.issues.filter(i => i.issueWinner === 'pro').length,
    conIssueWins: result.issues.filter(i => i.issueWinner === 'con').length,
    issueDraws: result.issues.filter(i => i.issueWinner === 'draw').length,
    averageIssueWeight: avgIssueWeight,

    averageClashQuality: avgClashQuality,
    lowQualityClashes: result.clashes.filter(c => c.clashQuality < DEFAULT_SCORING_CONFIG.clashQualityThreshold).length,

    winnerConfidence: verdict?.winnerConfidence || 0,
    scoreMargin: verdict?.margin || 0,

    analysisTimeMs
  }
}

/**
 * Format metrics for logging
 */
export function formatMetricsLog(metrics: CalibrationMetrics): string {
  return `
═══════════════════════════════════════════════════════════════
                    CALIBRATION METRICS
═══════════════════════════════════════════════════════════════

ARGUMENTS
  Total: ${metrics.totalArguments} (PRO: ${metrics.proArguments}, CON: ${metrics.conArguments})

STATUS BREAKDOWN
  Extended:  ${metrics.statusBreakdown.extended}
  Dropped:   ${metrics.statusBreakdown.dropped}
  Refuted:   ${metrics.statusBreakdown.refuted}
  Turned:    ${metrics.statusBreakdown.turned}
  Conceded:  ${metrics.statusBreakdown.conceded}
  Contested: ${metrics.statusBreakdown.contested}

CLASHES
  Total: ${metrics.totalClashes}
  Avg Quality: ${metrics.averageClashQuality.toFixed(2)}/10
  Low Quality: ${metrics.lowQualityClashes}

ISSUES
  Total: ${metrics.totalIssues}
  PRO Wins: ${metrics.proIssueWins}
  CON Wins: ${metrics.conIssueWins}
  Draws: ${metrics.issueDraws}
  Avg Weight: ${metrics.averageIssueWeight.toFixed(2)}/10

VERDICT
  Confidence: ${metrics.winnerConfidence}%
  Margin: ${metrics.scoreMargin} points

PERFORMANCE
  Analysis Time: ${metrics.analysisTimeMs}ms

═══════════════════════════════════════════════════════════════
`
}

// =============================================================================
// COMPARISON UTILITIES
// =============================================================================

export interface ScoringComparison {
  // Traditional scoring results
  traditionalWinner: 'pro' | 'con' | 'draw'
  traditionalConfidence: number
  traditionalProScore: number
  traditionalConScore: number

  // Legacy scoring results (if available)
  legacyWinner?: 'pro' | 'con' | 'draw'
  legacyProScore?: number
  legacyConScore?: number

  // Comparison
  winnersMatch: boolean
  scoreDifference: {
    pro: number
    con: number
  }

  // Analysis insights
  insights: string[]
}

/**
 * Compare traditional scoring results with legacy system
 */
export function compareWithLegacy(
  traditionalVerdict: TraditionalDebateVerdict,
  legacyProScore?: number,
  legacyConScore?: number
): ScoringComparison {
  const insights: string[] = []

  // Determine legacy winner if scores available
  let legacyWinner: 'pro' | 'con' | 'draw' | undefined
  if (legacyProScore !== undefined && legacyConScore !== undefined) {
    if (Math.abs(legacyProScore - legacyConScore) < 5) {
      legacyWinner = 'draw'
    } else {
      legacyWinner = legacyProScore > legacyConScore ? 'pro' : 'con'
    }
  }

  const winnersMatch = legacyWinner === undefined || legacyWinner === traditionalVerdict.winner

  // Generate insights
  if (!winnersMatch) {
    insights.push(`Winner mismatch: Traditional says ${traditionalVerdict.winner.toUpperCase()}, Legacy says ${legacyWinner?.toUpperCase()}`)
  }

  if (traditionalVerdict.droppedByPro > 0 || traditionalVerdict.droppedByCon > 0) {
    insights.push(`Dropped arguments detected: PRO dropped ${traditionalVerdict.droppedByCon}, CON dropped ${traditionalVerdict.droppedByPro}`)
  }

  if (traditionalVerdict.votingIssues.length > 0) {
    const topIssue = traditionalVerdict.votingIssues[0]
    insights.push(`Key voting issue: "${topIssue.issue}" (${topIssue.winner.toUpperCase()} wins, weight ${topIssue.weight}/10)`)
  }

  const scoreDiff = {
    pro: legacyProScore !== undefined ? traditionalVerdict.proScore - legacyProScore : 0,
    con: legacyConScore !== undefined ? traditionalVerdict.conScore - legacyConScore : 0
  }

  if (Math.abs(scoreDiff.pro) > 10 || Math.abs(scoreDiff.con) > 10) {
    insights.push(`Significant score deviation: PRO ${scoreDiff.pro > 0 ? '+' : ''}${scoreDiff.pro}, CON ${scoreDiff.con > 0 ? '+' : ''}${scoreDiff.con}`)
  }

  return {
    traditionalWinner: traditionalVerdict.winner,
    traditionalConfidence: traditionalVerdict.winnerConfidence,
    traditionalProScore: traditionalVerdict.proScore,
    traditionalConScore: traditionalVerdict.conScore,
    legacyWinner,
    legacyProScore,
    legacyConScore,
    winnersMatch,
    scoreDifference: scoreDiff,
    insights
  }
}

// =============================================================================
// THRESHOLD TUNING
// =============================================================================

/**
 * Suggest threshold adjustments based on metrics
 */
export function suggestThresholdAdjustments(
  metrics: CalibrationMetrics,
  currentConfig: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): string[] {
  const suggestions: string[] = []

  // Check if too many draws
  const drawRate = metrics.issueDraws / Math.max(metrics.totalIssues, 1)
  if (drawRate > 0.4) {
    suggestions.push(`High draw rate (${(drawRate * 100).toFixed(0)}%): Consider lowering drawMarginThreshold from ${currentConfig.drawMarginThreshold} to ${Math.max(2, currentConfig.drawMarginThreshold - 2)}`)
  }

  // Check clash quality distribution
  const lowQualityRate = metrics.lowQualityClashes / Math.max(metrics.totalClashes, 1)
  if (lowQualityRate > 0.5) {
    suggestions.push(`Many low-quality clashes (${(lowQualityRate * 100).toFixed(0)}%): Consider lowering clashQualityThreshold from ${currentConfig.clashQualityThreshold} to ${Math.max(1, currentConfig.clashQualityThreshold - 1)}`)
  }

  // Check dropped argument impact
  const totalDropped = metrics.statusBreakdown.dropped
  const droppedRate = totalDropped / Math.max(metrics.totalArguments, 1)
  if (droppedRate > 0.3 && currentConfig.droppedArgumentPenalty < 6) {
    suggestions.push(`High drop rate (${(droppedRate * 100).toFixed(0)}%): Consider increasing droppedArgumentPenalty from ${currentConfig.droppedArgumentPenalty} to ${currentConfig.droppedArgumentPenalty + 2}`)
  }

  // Check confidence levels
  if (metrics.winnerConfidence < 55 && metrics.scoreMargin > 10) {
    suggestions.push(`Low confidence (${metrics.winnerConfidence}%) despite margin (${metrics.scoreMargin}): Issue weighting may need adjustment`)
  }

  // Check issue weight distribution
  if (metrics.averageIssueWeight < 4) {
    suggestions.push(`Low average issue weight (${metrics.averageIssueWeight.toFixed(1)}): centralityToQuestion weight may be too high`)
  }

  if (suggestions.length === 0) {
    suggestions.push('Current configuration appears well-calibrated for this debate type')
  }

  return suggestions
}

// =============================================================================
// CONFIGURATION SELECTION
// =============================================================================

/**
 * Recommend configuration based on debate characteristics
 */
export function recommendConfig(
  commentCount: number,
  averageCommentLength: number,
  hasExplicitEvidence: boolean
): {
  config: TraditionalScoringConfig
  name: string
  reasoning: string
} {
  // Large discussions with many participants
  if (commentCount > 50) {
    return {
      config: QUANTITY_FOCUSED_CONFIG,
      name: 'Quantity-Focused',
      reasoning: 'Large thread with many participants - weighting argument quantity'
    }
  }

  // Formal debates with evidence
  if (hasExplicitEvidence && averageCommentLength > 200) {
    return {
      config: IMPACT_FOCUSED_CONFIG,
      name: 'Impact-Focused',
      reasoning: 'Evidence-based discussion - focusing on impact quality'
    }
  }

  // Structured debates with medium length
  if (commentCount >= 10 && averageCommentLength > 100) {
    return {
      config: STRICT_CONFIG,
      name: 'Strict',
      reasoning: 'Structured debate format - using strict evaluation'
    }
  }

  // Casual discussions
  if (averageCommentLength < 100) {
    return {
      config: LENIENT_CONFIG,
      name: 'Lenient',
      reasoning: 'Casual discussion style - using lenient thresholds'
    }
  }

  // Default
  return {
    config: DEFAULT_SCORING_CONFIG,
    name: 'Default',
    reasoning: 'Standard debate format - using default configuration'
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  DEFAULT_SCORING_CONFIG
}

export default {
  configs: {
    DEFAULT: DEFAULT_SCORING_CONFIG,
    STRICT: STRICT_CONFIG,
    LENIENT: LENIENT_CONFIG,
    IMPACT_FOCUSED: IMPACT_FOCUSED_CONFIG,
    QUANTITY_FOCUSED: QUANTITY_FOCUSED_CONFIG
  },
  fixtures: {
    SIMPLE_DEBATE: SIMPLE_DEBATE_FIXTURE,
    PRO_DOMINANT: PRO_DOMINANT_FIXTURE,
    DRAW: DRAW_FIXTURE
  }
}
