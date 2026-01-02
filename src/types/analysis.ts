/**
 * Deep Analysis Type Definitions
 * Types for GLM-4 powered debate analysis
 */

// ============================================================================
// Claim Analysis
// ============================================================================

export interface Claim {
  id: string
  text: string
  author: string
  commentId: string
  sourceCited: boolean
  sourceUrl: string | null
  verificationStatus: 'verified' | 'unverified' | 'disputed' | 'false' | 'sourced'
  refutedBy: string[]
  relevanceScore: number
  // Provenance tracking (sticky verification)
  fromCache?: boolean           // True if this verification came from claims registry
  registryId?: string           // Hash ID in claims registry
  verifiedAt?: string           // ISO timestamp of verification
  verifiedBy?: 'claude' | 'grok' | 'manual'
  verificationSources?: string[] // Sources used to verify
  sticky?: boolean              // If true, this verification is permanent
}

export interface ClaimAnalysis {
  claims: Claim[]
  totalClaims: number
  verifiedClaims: number
  sourcedClaims: number
  disputedClaims: number
}

// ============================================================================
// Argument Mapping
// ============================================================================

export type ArgumentPosition = 'support' | 'oppose' | 'nuanced' | 'neutral'

export interface ArgumentNode {
  id: string
  commentId: string
  author: string
  position: ArgumentPosition
  summary: string
  qualityScore: number
  depth: number
  parentId: string | null
  children: string[]
  claims: string[]
}

export interface ArgumentFlow {
  arguments: ArgumentNode[]
  rootArguments: string[] // Top-level argument IDs
  flowSummary: string
  dominantPosition: ArgumentPosition
  strongestProArg: string | null
  strongestConArg: string | null
}

// ============================================================================
// Fallacy Detection
// ============================================================================

export type FallacyTypeDeep =
  | 'ad_hominem'
  | 'straw_man'
  | 'false_dichotomy'
  | 'appeal_to_authority'
  | 'appeal_to_emotion'
  | 'slippery_slope'
  | 'circular_reasoning'
  | 'red_herring'
  | 'tu_quoque'
  | 'hasty_generalization'
  | 'no_true_scotsman'
  | 'whataboutism'
  | 'false_equivalence'
  | 'moving_goalposts'
  | 'gish_gallop'
  | 'loaded_question'
  | 'bandwagon'
  | 'genetic_fallacy'

export type FallacySeverity = 'minor' | 'moderate' | 'major'

export interface FallacyInstance {
  id: string
  type: FallacyTypeDeep
  description: string
  commentId: string
  author: string
  quote: string
  severity: FallacySeverity
}

export interface FallacyAnalysis {
  fallacies: FallacyInstance[]
  fallacyDensity: 'low' | 'medium' | 'high'
  mostCommonFallacy: FallacyTypeDeep | null
  fallaciesByUser: Record<string, FallacyInstance[]>
  fallaciesByType: Record<FallacyTypeDeep, number>
}

// ============================================================================
// Rhetorical Profiling
// ============================================================================

export type RhetoricalStyle =
  | 'analytical'
  | 'emotional'
  | 'balanced'
  | 'aggressive'
  | 'passive'
  | 'socratic'
  | 'combative'
  | 'diplomatic'

export interface RhetoricalProfile {
  username: string
  commentCount: number
  logicScore: number       // 0-100
  emotionScore: number     // 0-100
  evidenceScore: number    // 0-100
  authorityScore: number   // 0-100
  concessionScore: number  // 0-100
  style: RhetoricalStyle
  intellectualHonesty: number  // 0-10
  steelmans: number
  strawmans: number
  concessions: number
  dodges: number
}

export interface RhetoricalAnalysis {
  profiles: RhetoricalProfile[]
  averageHonesty: number
  mostAnalytical: string | null
  mostEmotional: string | null
  bestDebater: string | null
  worstDebater: string | null
}

// ============================================================================
// Hidden Gems
// ============================================================================

export interface HiddenGem {
  commentId: string
  author: string
  text: string
  karma: number
  qualityScore: number
  reasonUnderrated: string
}

// ============================================================================
// Manipulation Detection
// ============================================================================

export type ManipulationType =
  | 'coordinated'
  | 'statistical_anomaly'
  | 'talking_points'
  | 'gish_gallop'
  | 'astroturfing'
  | 'brigading'
  | 'bot_behavior'

export type ManipulationSeverity = 'low' | 'medium' | 'high'

export interface ManipulationAlert {
  type: ManipulationType
  description: string
  evidence: string[]
  severity: ManipulationSeverity
  involvedUsers: string[]
}

export interface ManipulationAnalysis {
  alerts: ManipulationAlert[]
  overallRisk: 'low' | 'medium' | 'high'
  suspiciousPatterns: number
}

// ============================================================================
// Debate Verdict
// ============================================================================

export interface DebateVerdict {
  overallScore: number           // 1-10
  coreDispute: string
  evidenceQualityPct: number
  proArguments: number
  conArguments: number
  proStrong: number
  conStrong: number
  consensusPoints: string[]
  contestedPoints: string[]
  unresolvedQuestions: string[]
  redFlags: string[]
  recommendation: string
  worthReading: boolean
  mustReadComments: string[]
  skipBranches: string[]
  readingTimeMinutes: number
  optimizedPathMinutes: number
}

// ============================================================================
// Full Analysis Result
// ============================================================================

export interface DeepAnalysis {
  threadId: string
  threadTitle: string
  subreddit: string
  analyzedAt: string
  verdict: DebateVerdict
  claims: Claim[]
  arguments: ArgumentNode[]
  fallacies: FallacyInstance[]
  rhetoricalProfiles: RhetoricalProfile[]
  hiddenGems: HiddenGem[]
  manipulationAlerts: ManipulationAlert[]
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DeepAnalysisResponse {
  success: boolean
  data?: DeepAnalysis
  error?: string
  cached?: boolean
  analysisTime?: number // ms
}

export interface AnalysisProgress {
  stage: string
  progress: number // 0-100
  message: string
}

// ============================================================================
// Chart Data Types for Visualizations
// ============================================================================

export interface ArgumentTreeNode {
  id: string
  author: string
  position: ArgumentPosition
  quality: number
  children: ArgumentTreeNode[]
}

export interface FallacyTimelinePoint {
  depth: number
  fallacyCount: number
  fallacyTypes: FallacyTypeDeep[]
}

export interface RhetoricalRadarData {
  username: string
  data: {
    dimension: string
    value: number
    fullMark: number
  }[]
}

export interface ClaimVerificationMatrix {
  verified: number
  unverified: number
  disputed: number
  false: number
  sourced: number
  unsourced: number
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getFallacyDisplayName(type: FallacyTypeDeep): string {
  const names: Record<FallacyTypeDeep, string> = {
    ad_hominem: 'Ad Hominem',
    straw_man: 'Straw Man',
    false_dichotomy: 'False Dichotomy',
    appeal_to_authority: 'Appeal to Authority',
    appeal_to_emotion: 'Appeal to Emotion',
    slippery_slope: 'Slippery Slope',
    circular_reasoning: 'Circular Reasoning',
    red_herring: 'Red Herring',
    tu_quoque: 'Tu Quoque',
    hasty_generalization: 'Hasty Generalization',
    no_true_scotsman: 'No True Scotsman',
    whataboutism: 'Whataboutism',
    false_equivalence: 'False Equivalence',
    moving_goalposts: 'Moving Goalposts',
    gish_gallop: 'Gish Gallop',
    loaded_question: 'Loaded Question',
    bandwagon: 'Bandwagon',
    genetic_fallacy: 'Genetic Fallacy'
  }
  return names[type] || type
}

export function getPositionColor(position: ArgumentPosition): string {
  const colors: Record<ArgumentPosition, string> = {
    support: '#22c55e',  // green
    oppose: '#ef4444',   // red
    nuanced: '#a855f7',  // purple
    neutral: '#71717a'   // gray
  }
  return colors[position]
}

export function getSeverityColor(severity: FallacySeverity | ManipulationSeverity): string {
  const colors = {
    minor: '#f59e0b',   // amber
    low: '#f59e0b',
    moderate: '#f97316', // orange
    medium: '#f97316',
    major: '#ef4444',    // red
    high: '#ef4444'
  }
  return colors[severity]
}

export function getStyleIcon(style: RhetoricalStyle): string {
  const icons: Record<RhetoricalStyle, string> = {
    analytical: '🔬',
    emotional: '💭',
    balanced: '⚖️',
    aggressive: '⚔️',
    passive: '🕊️',
    socratic: '🤔',
    combative: '🥊',
    diplomatic: '🤝'
  }
  return icons[style]
}

export function calculateHonestyTier(score: number): {
  tier: string
  color: string
  label: string
} {
  if (score >= 8) return { tier: 'exceptional', color: '#22c55e', label: 'Highly Honest' }
  if (score >= 6) return { tier: 'good', color: '#84cc16', label: 'Good Faith' }
  if (score >= 4) return { tier: 'mixed', color: '#f59e0b', label: 'Mixed' }
  if (score >= 2) return { tier: 'poor', color: '#f97316', label: 'Questionable' }
  return { tier: 'bad', color: '#ef4444', label: 'Bad Faith' }
}

export function formatAnalysisScore(score: number): string {
  if (score >= 8) return 'Excellent'
  if (score >= 6) return 'Good'
  if (score >= 4) return 'Fair'
  if (score >= 2) return 'Poor'
  return 'Very Poor'
}
