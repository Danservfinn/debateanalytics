/**
 * Parse - Critical Media Analysis Platform
 * Core Type Definitions
 */

// ============================================================================
// Article Input & Extraction
// ============================================================================

export interface ArticleSubmission {
  url: string
  submittedAt: string
  userId: string
}

export interface ArticleSource {
  id: string
  type: 'study' | 'expert' | 'organization' | 'document' | 'data'
  name: string
  url: string | null
  credibilityIndicators: {
    isPeerReviewed: boolean
    hasFundingDisclosed: boolean
    isPreprint: boolean
    publicationDate: string | null
  }
}

export interface StatisticReference {
  id: string
  value: string
  context: string
  source: string | null
  isBaselineProvided: boolean
}

export interface ExtractedClaim {
  id: string
  text: string
  type: 'factual' | 'causal' | 'predictive' | 'normative' | 'opinion'
  verifiability: 'testable' | 'partially_testable' | 'untestable'
  section: string
  context: string
}

export interface ArticleSection {
  heading: string | null
  content: string
  order: number
}

export interface ExtractedArticle {
  id: string
  url: string
  title: string
  authors: string[]
  publication: string
  publishDate: string
  articleType: 'news' | 'op_ed' | 'blog_post' | 'analysis'
  content: {
    headline: string
    subhead: string | null
    lede: string
    body: string
    sections: ArticleSection[]
  }
  claims: ExtractedClaim[]
  sources: ArticleSource[]
  statistics: StatisticReference[]
  emotionalLanguageDensity: number // 0-1
}

// ============================================================================
// Steel-Manned Perspectives
// ============================================================================

export interface SteelMannedPerspective {
  id: string
  label: string
  originalStrength: 'strong' | 'moderate' | 'weak'
  steelMannedVersion: {
    coreClaim: string
    strongestArguments: string[]
    bestEvidence: string[]
    logicalStructure: string
    anticipatedCounterarguments: string[]
    qualityScore: number // 0-100
  }
  sourceInArticle: string[]
  isImplicit: boolean
}

// ============================================================================
// Deception Detection
// ============================================================================

export type DeceptionCategory =
  | 'emotional'
  | 'framing'
  | 'omission'
  | 'source'
  | 'propaganda'

export type DeceptionType =
  // Emotional
  | 'fear_appeal'
  | 'appeal_to_pity'
  | 'appeal_to_anger'
  // Framing
  | 'false_balance'
  | 'context_stripping'
  | 'narrative_priming'
  | 'selection_bias'
  // Omission
  | 'counter_evidence'
  | 'alternative_perspective'
  | 'critical_context'
  | 'historical_context'
  // Source
  | 'anonymous_experts'
  | 'circular_sourcing'
  | 'hidden_funding'
  | 'credential_inflation'
  // Propaganda
  | 'talking_point_repetition'
  | 'us_vs_them'
  | 'slogan_over_substance'
  | 'authority_without_evidence'

export interface DeceptionInstance {
  id: string
  category: DeceptionCategory
  type: DeceptionType
  quote: string
  context: string
  severity: 'low' | 'medium' | 'high'
  explanation: string
  deduction: number // Points deducted from truth score
}

export interface ManipulationRisk {
  overallRisk: 'low' | 'medium' | 'high'
  score: number // 0-100 (higher = more manipulation)
  breakdown: {
    emotional: number // 0-100
    framing: number // 0-100
    omission: number // 0-100
    source: number // 0-100
    propaganda: number // 0-100
  }
  severityDistribution: {
    high: number
    medium: number
    low: number
  }
}

// ============================================================================
// Fallacy Detection (reuse from debate-analytics)
// ============================================================================

export type FallacyType =
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

export interface FallacyInstance {
  id: string
  type: FallacyType
  name: string // Human-readable name
  quote: string
  context: string
  severity: 'low' | 'medium' | 'high'
  explanation: string
  deduction: number // Points deducted
}

// ============================================================================
// Fact-Checking
// ============================================================================

export interface ExternalSource {
  type: 'primary_study' | 'meta_analysis' | 'news_article' | 'expert_commentary' | 'data_source'
  title: string
  url: string
  credibility: 'high' | 'medium' | 'low'
  relevantFindings: string
  methodology: string // e.g., "RCT, n=500, 6-month follow-up"
}

export interface FactCheckResult {
  id: string
  claimId: string
  claim: string
  verification: 'supported' | 'partially_supported' | 'not_supported' | 'refuted' | 'inconclusive'
  confidence: number // 0-100
  sources: ExternalSource[]
  methodology: string
  methodologyScore: number // 0-25
  evidenceHierarchy: 'primary' | 'secondary' | 'tertiary'
  reasoning: string
}

// ============================================================================
// Truth Assessment
// ============================================================================

export interface TruthScoreBreakdown {
  evidenceQuality: number // 0-40
  evidenceRationale?: string // Explanation for evidence score
  methodologyRigor: number // 0-25
  methodologyRationale?: string // Explanation for methodology score
  logicalStructure: number // 0-20
  logicalRationale?: string // Explanation for logic score
  manipulationAbsence: number // 0-15
  manipulationRationale?: string // Explanation for manipulation score
}

export interface CredibilityRating {
  score: number // 0-100
  level: 'high' | 'moderate' | 'low' | 'very_low'
  breakdown: TruthScoreBreakdown
}

// ============================================================================
// Full Analysis Result
// ============================================================================

export interface ParseAnalysis {
  id: string
  articleId: string
  analyzedAt: string
  url: string

  // Article Metadata (from extraction)
  articleMetadata?: {
    title: string
    authors: string[]
    publication: string
    publishDate: string
    articleType: 'news' | 'op_ed' | 'blog_post' | 'analysis'
    headline: string
    subhead: string | null
    lede: string
    emotionalLanguageDensity: number // 0-1
  }

  // Extracted Claims (from extraction)
  extractedClaims?: ExtractedClaim[]

  // Sources Cited (from extraction)
  sourcesCited?: ArticleSource[]

  // Statistics (from extraction)
  statistics?: StatisticReference[]

  // Truth Assessment
  truthScore: number // 0-100
  credibility: 'high' | 'moderate' | 'low' | 'very_low'
  scoreBreakdown: TruthScoreBreakdown

  // Evidence Quality Assessment (detailed)
  evidenceAssessment?: {
    overallScore: number // 0-40
    primarySourceCount: number
    secondarySourceCount: number
    tertiarySourceCount: number
    hasStatisticsWithBaseline: boolean
    hasDirectQuotesInContext: boolean
    sourceDiversity: 'high' | 'medium' | 'low'
    dataReproducibility: boolean
    assessment: string // Detailed explanation
  }

  // Steel-Manned Perspectives
  steelMannedPerspectives: SteelMannedPerspective[]

  // Deception Detection
  manipulationRisk: ManipulationRisk
  deceptionDetected: DeceptionInstance[]

  // Fallacy Analysis
  fallacies: FallacyInstance[]

  // Fact-Checking
  factCheckResults: FactCheckResult[]

  // What AI Thinks
  whatAiThinks: string // 2-4 sentences, candid assessment

  // Meta
  analysisDuration: number // seconds
  agentsUsed: string[]
  modelVersion: string
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ExtractRequest {
  url: string
}

export interface ExtractResponse {
  success: boolean
  data?: ExtractedArticle
  error?: string
  cached?: boolean
}

export interface AnalyzeRequest {
  articleId: string
  analysisType: 'free' | 'full'
}

export interface AnalyzeResponse {
  success: boolean
  jobId?: string
  estimatedWait?: number
  data?: ParseAnalysis
  error?: string
}

export interface JobStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: ParseAnalysis
  error?: string
  position?: number
  estimatedWait?: number
}

// ============================================================================
// Browser Extension Types
// ============================================================================

export interface QuickAnalyzeRequest {
  url: string
  clientType: 'browser_extension'
}

export interface QuickAnalyzeResponse {
  truthScore: number
  credibility: string
  manipulationRisk: string
  whatAiThinks: string
  fullAnalysisUrl: string
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getCredibilityLabel(score: number): 'high' | 'moderate' | 'low' | 'very_low' {
  if (score >= 80) return 'high'
  if (score >= 60) return 'moderate'
  if (score >= 40) return 'low'
  return 'very_low'
}

export function getCredibilityColor(level: 'high' | 'moderate' | 'low' | 'very_low'): string {
  const colors = {
    high: '#22c55e',      // green
    moderate: '#f59e0b',  // amber
    low: '#f97316',       // orange
    very_low: '#ef4444'   // red
  }
  return colors[level]
}

export function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
  const colors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e'
  }
  return colors[severity]
}

export function getDeceptionTypeLabel(type: DeceptionType): string {
  const labels: Record<DeceptionType, string> = {
    fear_appeal: 'Fear Appeal',
    appeal_to_pity: 'Appeal to Pity',
    appeal_to_anger: 'Appeal to Anger',
    false_balance: 'False Balance',
    context_stripping: 'Context Stripping',
    narrative_priming: 'Narrative Priming',
    selection_bias: 'Selection Bias',
    counter_evidence: 'Counter-Evidence Omitted',
    alternative_perspective: 'Alternative Perspective Absent',
    critical_context: 'Critical Context Omitted',
    historical_context: 'Historical Context Missing',
    anonymous_experts: 'Anonymous Experts',
    circular_sourcing: 'Circular Sourcing',
    hidden_funding: 'Hidden Funding',
    credential_inflation: 'Credential Inflation',
    talking_point_repetition: 'Talking Point Repetition',
    us_vs_them: 'Us vs. Them Framing',
    slogan_over_substance: 'Slogan Over Substance',
    authority_without_evidence: 'Authority Without Evidence'
  }
  return labels[type]
}

// ============================================================================
// Context Audit Types
// ============================================================================

export interface ContextOmission {
  id: string
  type: 'counter_evidence' | 'alternative_perspective' | 'critical_context' | 'historical_context' | 'numerical_context'
  description: string
  quote: string
  whatWasMissing: string
  severity: 'low' | 'medium' | 'high'
  impact: string
}

export interface FramingTechnique {
  id: string
  type: 'false_balance' | 'narrative_priming' | 'selection_bias' | 'context_stripping' | 'label_manipulation'
  description: string
  quote: string
  explanation: string
  severity: 'low' | 'medium' | 'high'
}

// ============================================================================
// Truth Score Breakdown Extended
// ============================================================================

export interface ExtendedTruthScoreBreakdown {
  evidenceQuality: number // 0-40
  methodologyRigor: number // 0-25
  logicalStructure: number // 0-20
  manipulationAbsence: {
    score: number // 0-15
    deductions: Array<{
      type: string
      deduction: number
    }>
  }
}
