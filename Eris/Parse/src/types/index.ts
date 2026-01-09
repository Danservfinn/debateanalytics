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
// AI Assessment (Comprehensive Superintelligence Perspective)
// ============================================================================

export interface AIAssessment {
  /** Bold, unhedged assessment of the article's relationship to truth */
  verdict: string

  /** What is the author/publication actually trying to accomplish? */
  intent: string

  /** What does this article want you to NOT think about? */
  blindSpots: string

  /** The thing that challenges readers on ALL sides */
  uncomfortableTruth: string

  /** Even in flawed pieces, what's the valid underlying concern? */
  kernelOfTruth: string

  /** Guidance for the reader - what should they do with this information? */
  whatYouShouldDo: string
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

  // ========================================================================
  // Phase 1 & 2: Enhanced Metadata
  // ========================================================================
  enhancedMetadata?: EnhancedArticleMetadata

  // ========================================================================
  // Phase 1: Dual-Score System (NEW)
  // ========================================================================
  dualScores?: DualScores

  // ========================================================================
  // Phase 1: Breaking News Context (NEW)
  // ========================================================================
  breakingNewsContext?: BreakingNewsContext

  // Extracted Claims (from extraction)
  extractedClaims?: ExtractedClaim[]

  // ========================================================================
  // Phase 2: Enhanced Claims with Verification (NEW)
  // ========================================================================
  enhancedClaims?: EnhancedClaim[]

  // Sources Cited (from extraction)
  sourcesCited?: ArticleSource[]

  // ========================================================================
  // Phase 2: Source Credibility Assessment (NEW)
  // ========================================================================
  sourceCredibility?: SourceCredibility[]

  // Statistics (from extraction)
  statistics?: StatisticReference[]

  // ========================================================================
  // Phase 2: Enhanced Statistics (NEW)
  // ========================================================================
  enhancedStatistics?: EnhancedStatistic[]

  // ========================================================================
  // Phase 2: Contested Facts Matrix (NEW)
  // ========================================================================
  contestedFacts?: ContestedFact[]
  agreedFacts?: AgreedFact[]

  // ========================================================================
  // Phase 2: Missing Perspectives Detection (NEW)
  // ========================================================================
  missingPerspectives?: MissingPerspective[]

  // ========================================================================
  // Phase 2: Reader Guidance (NEW)
  // ========================================================================
  readerGuidance?: ReaderGuidance

  // Truth Assessment (legacy - still computed for backwards compatibility)
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

  // What AI Thinks (legacy field for backwards compatibility)
  whatAiThinks: string

  // Comprehensive AI Assessment
  aiAssessment?: AIAssessment

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

// ============================================================================
// Phase 1 & 2 Helper Functions
// ============================================================================

export function getFactualReliabilityLabel(score: number): 'VERIFIED' | 'MOSTLY_VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'CONTAINS_FALSE_CLAIMS' {
  if (score >= 80) return 'VERIFIED'
  if (score >= 60) return 'MOSTLY_VERIFIED'
  if (score >= 40) return 'PARTIALLY_VERIFIED'
  if (score >= 20) return 'UNVERIFIED'
  return 'CONTAINS_FALSE_CLAIMS'
}

export function getRhetoricalNeutralityLabel(score: number): 'NEUTRAL' | 'SLIGHTLY_BIASED' | 'MODERATELY_BIASED' | 'HIGHLY_BIASED' | 'PROPAGANDA' {
  if (score >= 80) return 'NEUTRAL'
  if (score >= 60) return 'SLIGHTLY_BIASED'
  if (score >= 40) return 'MODERATELY_BIASED'
  if (score >= 20) return 'HIGHLY_BIASED'
  return 'PROPAGANDA'
}

export function getFactualReliabilityColor(label: string): string {
  const colors: Record<string, string> = {
    VERIFIED: '#22c55e',           // green
    MOSTLY_VERIFIED: '#84cc16',    // lime
    PARTIALLY_VERIFIED: '#f59e0b', // amber
    UNVERIFIED: '#f97316',         // orange
    CONTAINS_FALSE_CLAIMS: '#ef4444' // red
  }
  return colors[label] || '#6b7280'
}

export function getRhetoricalNeutralityColor(label: string): string {
  const colors: Record<string, string> = {
    NEUTRAL: '#22c55e',           // green
    SLIGHTLY_BIASED: '#84cc16',   // lime
    MODERATELY_BIASED: '#f59e0b', // amber
    HIGHLY_BIASED: '#f97316',     // orange
    PROPAGANDA: '#ef4444'         // red
  }
  return colors[label] || '#6b7280'
}

export function getSourceCredibilityColor(score: number): string {
  if (score >= 8) return '#22c55e'  // green
  if (score >= 6) return '#84cc16'  // lime
  if (score >= 4) return '#f59e0b'  // amber
  if (score >= 2) return '#f97316'  // orange
  return '#ef4444'                   // red
}

export function getBiasRiskColor(risk: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  const colors = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#22c55e'
  }
  return colors[risk]
}

export function getContestedFactStatusColor(status: 'DISPUTED' | 'LIKELY_TRUE' | 'LIKELY_FALSE' | 'UNKNOWN'): string {
  const colors = {
    DISPUTED: '#f59e0b',    // amber
    LIKELY_TRUE: '#84cc16', // lime
    LIKELY_FALSE: '#f97316', // orange
    UNKNOWN: '#6b7280'       // gray
  }
  return colors[status]
}

export function getClaimVerificationColor(status: string): string {
  const colors: Record<string, string> = {
    VERIFIED: '#22c55e',
    LIKELY_TRUE: '#84cc16',
    DISPUTED: '#f59e0b',
    LIKELY_FALSE: '#f97316',
    FALSE: '#ef4444',
    UNVERIFIABLE: '#6b7280'
  }
  return colors[status] || '#6b7280'
}

export function getMissingPerspectiveColor(importance: 'CRITICAL' | 'SIGNIFICANT' | 'NOTABLE'): string {
  const colors = {
    CRITICAL: '#ef4444',
    SIGNIFICANT: '#f59e0b',
    NOTABLE: '#6b7280'
  }
  return colors[importance]
}

export function getConfidenceLevelColor(level: 'HIGH' | 'MODERATE' | 'LOW'): string {
  const colors = {
    HIGH: '#22c55e',
    MODERATE: '#f59e0b',
    LOW: '#ef4444'
  }
  return colors[level]
}

/**
 * Detects if an article is breaking news based on publish date
 * @param publishDate The article's publish date
 * @param eventDate Optional event date (defaults to publish date)
 * @returns BreakingNewsContext object
 */
export function detectBreakingNews(publishDate: string, eventDate?: string): BreakingNewsContext {
  const articleDate = new Date(publishDate)
  const eventDateTime = eventDate ? new Date(eventDate) : articleDate
  const now = new Date()

  const hoursAfterEvent = Math.floor((articleDate.getTime() - eventDateTime.getTime()) / (1000 * 60 * 60))
  const hoursSincePublish = Math.floor((now.getTime() - articleDate.getTime()) / (1000 * 60 * 60))

  const isBreakingNews = hoursAfterEvent < 48 || hoursSincePublish < 72

  const warnings: string[] = []
  if (hoursAfterEvent < 24) {
    warnings.push('Article published within 24 hours of event - facts may be incomplete or inaccurate')
  }
  if (hoursAfterEvent < 48) {
    warnings.push('Early reporting typically relies heavily on official statements')
  }
  if (hoursSincePublish < 72) {
    warnings.push('Breaking news - independent investigation may not have occurred')
  }

  // Recommend reanalysis 72 hours after event
  const recommendDate = new Date(eventDateTime.getTime() + (72 * 60 * 60 * 1000))

  return {
    isBreakingNews,
    hoursAfterEvent: hoursAfterEvent >= 0 ? hoursAfterEvent : 0,
    warnings,
    recommendReanalysisAfter: recommendDate.toISOString()
  }
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
// Phase 1 & 2: Dual-Score Architecture
// ============================================================================

export interface ScoreWithBreakdown {
  score: number
  max: number
  confidence: number // 0-1, how confident is the AI in this score
  label: string
  breakdown: Array<{
    component: string
    score: number
    max: number
    details: string
  }>
}

export interface FactualReliabilityScore extends ScoreWithBreakdown {
  label: 'VERIFIED' | 'MOSTLY_VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'CONTAINS_FALSE_CLAIMS'
}

export interface RhetoricalNeutralityScore extends ScoreWithBreakdown {
  label: 'NEUTRAL' | 'SLIGHTLY_BIASED' | 'MODERATELY_BIASED' | 'HIGHLY_BIASED' | 'PROPAGANDA'
}

export interface DualScores {
  factualReliability: FactualReliabilityScore
  rhetoricalNeutrality: RhetoricalNeutralityScore
  overallConfidence: number // 0-1
}

// ============================================================================
// Phase 2: Source Credibility Assessment
// ============================================================================

export interface SourceCredibilityFactor {
  score: number // 0-10
  max: number // 10
  reasoning: string
}

export interface SourceCredibility {
  id: string
  name: string
  type: 'GOVERNMENT' | 'ORGANIZATION' | 'EXPERT' | 'EYEWITNESS' | 'MEDIA' | 'DOCUMENT' | 'ANONYMOUS'
  role: 'PRIMARY_PARTY' | 'THIRD_PARTY' | 'DIRECT_OBSERVER' | 'ANALYST'

  factors: {
    authority: SourceCredibilityFactor
    independence: SourceCredibilityFactor
    trackRecord: SourceCredibilityFactor
    proximity: SourceCredibilityFactor
  }

  overallScore: number // Weighted average 0-10
  biasRisk: 'HIGH' | 'MEDIUM' | 'LOW'
  biasDirection?: string // e.g., "Pro-law enforcement", "Anti-administration"

  warnings: string[] // Specific credibility concerns
  claimsAttributed: string[] // IDs of claims from this source
}

// ============================================================================
// Phase 2: Contested Facts Matrix
// ============================================================================

export interface ContestedFactAccount {
  position: 'YES' | 'NO' | 'PARTIAL'
  sources: string[]
  sourceCredibility: number // 0-10
  claims: string[]
  motivationToDistort: 'HIGH' | 'MEDIUM' | 'LOW'
  motivationReason: string
}

export interface ContestedFact {
  id: string
  question: string // e.g., "Did Good attempt to run over the officer?"
  status: 'DISPUTED' | 'LIKELY_TRUE' | 'LIKELY_FALSE' | 'UNKNOWN'
  confidence: number // 0-1

  accounts: ContestedFactAccount[]

  resolutionEvidence: string[] // What evidence would resolve this?

  assessment?: {
    likelyTruth: string
    confidence: number
    reasoning: string
  }
}

export interface AgreedFact {
  id: string
  statement: string
  sources: string[] // Multiple sources agree
  confidence: number // 0-1
}

// ============================================================================
// Phase 2: Enhanced Claims Verification
// ============================================================================

export interface EnhancedClaim {
  id: string
  text: string
  type: 'FACTUAL' | 'OPINION' | 'NORMATIVE' | 'CAUSAL' | 'STATISTICAL'
  verifiability: 'OBJECTIVE' | 'SUBJECTIVE'
  source: string
  sourceCredibility: number // 0-10

  verification: {
    status: 'VERIFIED' | 'LIKELY_TRUE' | 'DISPUTED' | 'LIKELY_FALSE' | 'FALSE' | 'UNVERIFIABLE'
    confidence: number // 0-1
    supportingEvidence: string[]
    contradictingEvidence: string[]
    verificationMethod?: string
  }

  readerNote?: string // Additional context for the reader
}

// ============================================================================
// Phase 2: Enhanced Statistics
// ============================================================================

export interface EnhancedStatistic {
  id: string
  value: string
  context: string
  source: string

  validation: {
    hasBaseline: boolean
    baselineValue?: string
    hasTimePeriod: boolean
    timePeriod?: string
    hasDefinition: boolean
    definition?: string
    isVerifiable: boolean
  }

  interpretation: {
    possibleMeanings: string[] // e.g., "Could mean 1→11 or 100→1100"
    misrepresentationRisk: 'HIGH' | 'MEDIUM' | 'LOW'
    whatWouldClarify: string
  }
}

// ============================================================================
// Phase 2: Missing Perspectives Detection
// ============================================================================

export interface MissingPerspective {
  id: string
  perspective: string
  importance: 'CRITICAL' | 'SIGNIFICANT' | 'NOTABLE'
  reason: string
  whatWeAreMissing: string[]
  howToFind: string[]
}

// ============================================================================
// Phase 1: Breaking News Detection
// ============================================================================

export interface BreakingNewsContext {
  isBreakingNews: boolean
  hoursAfterEvent?: number
  warnings: string[]
  recommendReanalysisAfter?: string // ISO date
}

// ============================================================================
// Phase 2: Reader Guidance
// ============================================================================

export interface ReaderGuidance {
  summary: string
  additionalSourcesRecommended: string[]
  keyQuestionsToResearch: string[]
  waitForInformation: string[]
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW'
  confidenceReasoning: string
}

// ============================================================================
// Enhanced Article Metadata
// ============================================================================

export interface EnhancedArticleMetadata {
  title: string
  authors: string[]
  publication: string
  publishDate: string
  articleType: 'NEWS' | 'OPINION' | 'ANALYSIS' | 'INVESTIGATION'
  headline: string
  subhead: string | null
  lede: string
  emotionalLanguageDensity: number // 0-1

  // Phase 1 additions
  publicationBias?: 'LEFT' | 'CENTER_LEFT' | 'CENTER' | 'CENTER_RIGHT' | 'RIGHT'
  breakingNews: BreakingNewsContext
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
  howToFind?: string // Where readers can find this missing context
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
