/**
 * Analysis Orchestrator
 * Coordinates all analysis agents (MVP: no database dependency)
 */

import { extractArticle } from "@/agents/extraction-agent"
import { steelManArticle } from "@/agents/steel-manning-agent"
import { detectDeception } from "@/agents/deception-detection-agent"
import { factCheckArticle } from "@/agents/critical-fact-check-agent"
import { detectFallacies } from "@/agents/fallacy-agent"
import { auditContext } from "@/agents/context-audit-agent"
import { synthesizeAnalysis } from "@/agents/synthesis-agent"
import { generateAIAssessment } from "@/agents/ai-assessment-agent"
import { analyzePersuasionIntent } from "@/agents/persuasion-intent-agent"
import type {
  ParseAnalysis,
  DualScores,
  FactualReliabilityScore,
  RhetoricalNeutralityScore,
  BreakingNewsContext,
  ReaderGuidance,
  SourceCredibility,
  EnhancedClaim,
  EnhancedStatistic,
  ContestedFact,
  AgreedFact,
  MissingPerspective,
  PersuasionIntentResult,
} from "@/types"
import {
  getFactualReliabilityLabel,
  getRhetoricalNeutralityLabel,
  detectBreakingNews,
} from "@/types"

// ============================================================================
// Phase 2: Source Credibility Assessment
// ============================================================================

/**
 * Compute credibility scores for each source cited in the article
 */
function computeSourceCredibility(
  sources: { id: string; type: string; name: string; url: string | null; credibilityIndicators: any }[],
  claims: { id: string; text: string; source?: string }[]
): SourceCredibility[] {
  return sources.map(source => {
    // Authority score (0-10): Based on source type and verification
    const authorityScore = computeAuthorityScore(source)

    // Independence score (0-10): Based on potential conflicts of interest
    const independenceScore = computeIndependenceScore(source)

    // Track record score (0-10): Based on credibility indicators
    const trackRecordScore = computeTrackRecordScore(source)

    // Proximity score (0-10): How close to the events/facts
    const proximityScore = computeProximityScore(source)

    // Weighted average (authority 30%, independence 25%, track record 25%, proximity 20%)
    const overallScore = Math.round(
      (authorityScore.score * 0.30 +
       independenceScore.score * 0.25 +
       trackRecordScore.score * 0.25 +
       proximityScore.score * 0.20) * 10
    ) / 10

    // Determine bias risk
    const biasRisk = overallScore >= 7 ? 'LOW' as const :
                     overallScore >= 4 ? 'MEDIUM' as const : 'HIGH' as const

    // Generate warnings based on scores
    const warnings: string[] = []
    if (authorityScore.score < 5) warnings.push('Source authority is questionable')
    if (independenceScore.score < 5) warnings.push('Source may have conflicts of interest')
    if (trackRecordScore.score < 5) warnings.push('Source lacks established track record')
    if (proximityScore.score < 5) warnings.push('Source is not directly connected to events')
    if (source.type === 'expert' && !source.url) warnings.push('Expert claims not independently verifiable')

    // Find claims attributed to this source
    const claimsAttributed = claims
      .filter(c => c.text.toLowerCase().includes(source.name.toLowerCase()))
      .map(c => c.id)

    return {
      id: source.id,
      name: source.name,
      type: mapSourceType(source.type),
      role: determineSourceRole(source.type),
      factors: {
        authority: authorityScore,
        independence: independenceScore,
        trackRecord: trackRecordScore,
        proximity: proximityScore,
      },
      overallScore,
      biasRisk,
      warnings,
      claimsAttributed,
    }
  })
}

function computeAuthorityScore(source: any): { score: number; max: number; reasoning: string } {
  let score = 5 // baseline
  let reasoning = ''

  switch (source.type) {
    case 'study':
      score = source.credibilityIndicators?.isPeerReviewed ? 9 : 7
      reasoning = source.credibilityIndicators?.isPeerReviewed
        ? 'Peer-reviewed study provides high authority'
        : 'Study provides moderate authority'
      break
    case 'data':
      score = 8
      reasoning = 'Data sources provide strong factual authority'
      break
    case 'expert':
      score = source.url ? 7 : 5
      reasoning = source.url
        ? 'Named expert with verifiable credentials'
        : 'Expert claim without independent verification'
      break
    case 'organization':
      score = 6
      reasoning = 'Organizational source with institutional backing'
      break
    case 'document':
      score = 7
      reasoning = 'Documentary evidence provides solid authority'
      break
    default:
      score = 4
      reasoning = 'Source type has limited inherent authority'
  }

  return { score, max: 10, reasoning }
}

function computeIndependenceScore(source: any): { score: number; max: number; reasoning: string } {
  let score = 6
  let reasoning = 'Standard independence assessment'

  if (source.credibilityIndicators?.hasFundingDisclosed) {
    score += 1
    reasoning = 'Funding disclosure increases independence rating'
  }

  // Deduct for potentially interested parties
  const name = source.name.toLowerCase()
  if (name.includes('official') || name.includes('spokesperson') || name.includes('department')) {
    score -= 2
    reasoning = 'Official sources may have institutional bias'
  }

  if (name.includes('association') || name.includes('industry') || name.includes('council')) {
    score -= 1
    reasoning = 'Industry associations may have advocacy interests'
  }

  return { score: Math.max(1, Math.min(10, score)), max: 10, reasoning }
}

function computeTrackRecordScore(source: any): { score: number; max: number; reasoning: string } {
  let score = 5
  let reasoning = 'No specific track record data available'

  if (source.credibilityIndicators?.isPeerReviewed) {
    score = 8
    reasoning = 'Peer-reviewed sources have established review process'
  }

  if (source.credibilityIndicators?.isPreprint) {
    score = 4
    reasoning = 'Preprint status means peer review not completed'
  }

  if (source.url) {
    score += 1
    reasoning += '; verifiable reference available'
  }

  return { score: Math.min(10, score), max: 10, reasoning }
}

function computeProximityScore(source: any): { score: number; max: number; reasoning: string } {
  let score = 5
  let reasoning = 'Standard proximity to facts'

  switch (source.type) {
    case 'data':
      score = 9
      reasoning = 'Direct data provides closest proximity to facts'
      break
    case 'study':
      score = 8
      reasoning = 'Studies directly analyze the subject matter'
      break
    case 'document':
      score = 8
      reasoning = 'Documentary evidence directly relevant'
      break
    case 'expert':
      score = 6
      reasoning = 'Expert analysis one step removed from primary data'
      break
    case 'organization':
      score = 5
      reasoning = 'Organizational statements may be filtered through PR'
      break
    default:
      score = 4
      reasoning = 'Limited proximity to primary facts'
  }

  return { score, max: 10, reasoning }
}

function mapSourceType(type: string): 'GOVERNMENT' | 'ORGANIZATION' | 'EXPERT' | 'EYEWITNESS' | 'MEDIA' | 'DOCUMENT' | 'ANONYMOUS' {
  switch (type) {
    case 'study':
    case 'data':
      return 'DOCUMENT'
    case 'expert':
      return 'EXPERT'
    case 'organization':
      return 'ORGANIZATION'
    case 'document':
      return 'DOCUMENT'
    default:
      return 'MEDIA'
  }
}

function determineSourceRole(type: string): 'PRIMARY_PARTY' | 'THIRD_PARTY' | 'DIRECT_OBSERVER' | 'ANALYST' {
  switch (type) {
    case 'data':
    case 'document':
      return 'DIRECT_OBSERVER'
    case 'study':
      return 'ANALYST'
    case 'expert':
      return 'ANALYST'
    case 'organization':
      return 'PRIMARY_PARTY'
    default:
      return 'THIRD_PARTY'
  }
}

// ============================================================================
// Phase 2: Enhanced Claims with Verification
// ============================================================================

/**
 * Map fact-check results to enhanced claims with verification status
 */
function computeEnhancedClaims(
  claims: { id: string; text: string; type: string; verifiability: string; section: string; context: string }[],
  factCheckResults: { claimId: string; claim: string; verification: string; confidence: number; sources: any[]; reasoning: string }[],
  sourceCredibility: SourceCredibility[]
): EnhancedClaim[] {
  return claims.map(claim => {
    // Find matching fact-check result
    const factCheck = factCheckResults.find(fc => fc.claimId === claim.id || fc.claim === claim.text)

    // Map verification status
    let status: 'VERIFIED' | 'LIKELY_TRUE' | 'DISPUTED' | 'LIKELY_FALSE' | 'FALSE' | 'UNVERIFIABLE' = 'UNVERIFIABLE'
    if (factCheck) {
      switch (factCheck.verification) {
        case 'supported': status = 'VERIFIED'; break
        case 'partially_supported': status = 'LIKELY_TRUE'; break
        case 'not_supported': status = 'LIKELY_FALSE'; break
        case 'refuted': status = 'FALSE'; break
        case 'inconclusive': status = 'DISPUTED'; break
        default: status = 'UNVERIFIABLE'
      }
    } else if (claim.verifiability === 'untestable') {
      status = 'UNVERIFIABLE'
    }

    // Calculate average source credibility for claims
    const avgSourceCredibility = sourceCredibility.length > 0
      ? sourceCredibility.reduce((sum, s) => sum + s.overallScore, 0) / sourceCredibility.length
      : 5

    // Build supporting and contradicting evidence
    const supportingEvidence: string[] = []
    const contradictingEvidence: string[] = []

    if (factCheck) {
      factCheck.sources.forEach(src => {
        if (src.relevantFindings) {
          if (factCheck.verification === 'supported' || factCheck.verification === 'partially_supported') {
            supportingEvidence.push(`${src.title}: ${src.relevantFindings}`)
          } else if (factCheck.verification === 'refuted' || factCheck.verification === 'not_supported') {
            contradictingEvidence.push(`${src.title}: ${src.relevantFindings}`)
          }
        }
      })
    }

    // Generate reader note
    let readerNote: string | undefined
    if (status === 'DISPUTED') {
      readerNote = 'This claim is contested by available evidence. Consider seeking additional sources.'
    } else if (status === 'LIKELY_FALSE' || status === 'FALSE') {
      readerNote = 'Available evidence does not support this claim. Exercise caution.'
    } else if (status === 'UNVERIFIABLE') {
      readerNote = 'This claim cannot be independently verified with available sources.'
    }

    return {
      id: claim.id,
      text: claim.text,
      type: claim.type.toUpperCase() as 'FACTUAL' | 'OPINION' | 'NORMATIVE' | 'CAUSAL' | 'STATISTICAL',
      verifiability: claim.verifiability === 'testable' ? 'OBJECTIVE' as const : 'SUBJECTIVE' as const,
      source: claim.section || 'Article',
      sourceCredibility: avgSourceCredibility,
      verification: {
        status,
        confidence: factCheck?.confidence ? factCheck.confidence / 100 : 0.5,
        supportingEvidence,
        contradictingEvidence,
        verificationMethod: factCheck?.reasoning ? 'External source verification' : undefined,
      },
      readerNote,
    }
  })
}

// ============================================================================
// Phase 2: Dynamic Confidence Interval Calculation
// ============================================================================

/**
 * Calculate confidence interval based on data quality factors
 */
function calculateConfidenceInterval(
  factCheckResults: { confidence: number; searchAvailable?: boolean }[],
  sources: any[],
  claims: { verifiability: string }[]
): { confidence: number; marginOfError: number } {
  // Base factors for confidence
  let confidenceFactors: number[] = []

  // Check if search was unavailable
  const searchUnavailableResults = factCheckResults.filter(r => r.searchAvailable === false)
  const allSearchesUnavailable = factCheckResults.length > 0 && searchUnavailableResults.length === factCheckResults.length
  const someSearchesUnavailable = searchUnavailableResults.length > 0

  // Factor 1: Fact-check consistency (if multiple fact-checks)
  if (factCheckResults.length > 0) {
    // Only consider results where search was available
    const validResults = factCheckResults.filter(r => r.searchAvailable !== false)
    if (validResults.length > 0) {
      const avgFactCheckConfidence = validResults.reduce((sum, fc) => sum + fc.confidence, 0) / validResults.length / 100
      confidenceFactors.push(avgFactCheckConfidence)
    } else {
      // All searches failed - use low confidence factor
      confidenceFactors.push(0.3)
    }
  }

  // Factor 2: Source diversity and quality
  const sourceQuality = sources.length >= 5 ? 0.8 :
                        sources.length >= 3 ? 0.7 :
                        sources.length >= 1 ? 0.6 : 0.4
  confidenceFactors.push(sourceQuality)

  // Factor 3: Claim verifiability ratio
  const testableClaims = claims.filter(c => c.verifiability === 'testable').length
  const verifiabilityRatio = claims.length > 0 ? testableClaims / claims.length : 0.5
  confidenceFactors.push(Math.max(0.4, verifiabilityRatio))

  // Factor 4: Source verification (URLs available)
  const sourcesWithUrls = sources.filter(s => s.url !== null).length
  const urlRatio = sources.length > 0 ? sourcesWithUrls / sources.length : 0.3
  confidenceFactors.push(0.5 + urlRatio * 0.4)

  // Factor 5: Search availability penalty (NEW)
  if (allSearchesUnavailable) {
    // Severe penalty - external verification was impossible
    confidenceFactors.push(0.2)
  } else if (someSearchesUnavailable) {
    // Moderate penalty - partial verification possible
    const searchSuccessRatio = 1 - (searchUnavailableResults.length / factCheckResults.length)
    confidenceFactors.push(0.4 + searchSuccessRatio * 0.4)
  }

  // Calculate weighted average confidence
  const avgConfidence = confidenceFactors.length > 0
    ? confidenceFactors.reduce((sum, f) => sum + f, 0) / confidenceFactors.length
    : 0.5

  // Margin of error inversely related to confidence
  // Increase margin of error if search was unavailable
  let marginOfError = Math.round((1 - avgConfidence) * 15) // 0-15% margin
  if (allSearchesUnavailable) {
    marginOfError = Math.min(25, marginOfError + 10) // Increase by 10%, cap at 25%
  } else if (someSearchesUnavailable) {
    marginOfError = Math.min(20, marginOfError + 5) // Increase by 5%, cap at 20%
  }

  return {
    confidence: Math.round(avgConfidence * 100) / 100,
    marginOfError,
  }
}

// ============================================================================
// Phase 1 & 2: Dual Score Computation
// ============================================================================

/**
 * Compute Factual Reliability Score (0-100)
 * Based on: claim verification rate, source documentation, contested fact resolution, statistical validity
 */
function computeFactualReliabilityScore(
  synthesis: { truthScore: number; breakdown: { evidenceQuality: number; methodologyRigor: number } },
  factCheckResults: { verification: string; confidence: number; searchAvailable?: boolean }[],
  statistics: { isBaselineProvided: boolean }[]
): FactualReliabilityScore {
  // Check if search was unavailable for any fact-checks
  const searchUnavailableResults = factCheckResults.filter(r => r.searchAvailable === false)
  const searchWasUnavailable = searchUnavailableResults.length > 0
  const allSearchesUnavailable = factCheckResults.length > 0 && searchUnavailableResults.length === factCheckResults.length

  // Claim verification rate (40 points max)
  const verifiedClaims = factCheckResults.filter(r => r.verification === 'supported' || r.verification === 'partially_supported')
  let claimVerificationRate: number
  let claimVerificationDetails: string

  if (allSearchesUnavailable) {
    // All searches failed - give neutral score, not penalize
    claimVerificationRate = 20 // neutral
    claimVerificationDetails = `0/${factCheckResults.length} claims verifiable (search unavailable)`
  } else if (searchWasUnavailable) {
    // Some searches failed - calculate based on successful searches only
    const successfulSearches = factCheckResults.filter(r => r.searchAvailable !== false)
    const verifiedFromSuccessful = successfulSearches.filter(r => r.verification === 'supported' || r.verification === 'partially_supported')
    claimVerificationRate = successfulSearches.length > 0
      ? Math.round((verifiedFromSuccessful.length / successfulSearches.length) * 40)
      : 20
    claimVerificationDetails = `${verifiedFromSuccessful.length}/${successfulSearches.length} claims verified (${searchUnavailableResults.length} search failures)`
  } else {
    // Normal case - all searches successful
    claimVerificationRate = factCheckResults.length > 0
      ? Math.round((verifiedClaims.length / factCheckResults.length) * 40)
      : 20 // neutral if no claims to verify
    claimVerificationDetails = `${verifiedClaims.length}/${factCheckResults.length} claims verified`
  }

  // Source documentation (25 points max) - derived from evidence quality
  const sourceDocumentation = Math.round((synthesis.breakdown.evidenceQuality / 40) * 25)

  // Contested fact resolution (20 points max) - derived from methodology rigor
  const contestedFactResolution = Math.round((synthesis.breakdown.methodologyRigor / 25) * 20)

  // Statistical validity (15 points max)
  const statsWithBaseline = statistics.filter(s => s.isBaselineProvided).length
  const statisticalValidity = statistics.length > 0
    ? Math.round((statsWithBaseline / statistics.length) * 15)
    : 10 // neutral if no statistics

  const totalScore = Math.min(100, claimVerificationRate + sourceDocumentation + contestedFactResolution + statisticalValidity)

  return {
    score: totalScore,
    max: 100,
    confidence: 0.7, // Will be updated by dynamic calculation in main function
    label: getFactualReliabilityLabel(totalScore),
    breakdown: [
      { component: 'Claim Verification Rate', score: claimVerificationRate, max: 40, details: claimVerificationDetails },
      { component: 'Source Documentation', score: sourceDocumentation, max: 25, details: 'Based on evidence quality assessment' },
      { component: 'Contested Fact Resolution', score: contestedFactResolution, max: 20, details: 'Based on methodology rigor' },
      { component: 'Statistical Validity', score: statisticalValidity, max: 15, details: `${statsWithBaseline}/${statistics.length} stats with baseline` },
    ],
  }
}

/**
 * Enhanced version that includes dynamic confidence calculation
 */
function computeFactualReliabilityWithConfidence(
  synthesis: { truthScore: number; breakdown: { evidenceQuality: number; methodologyRigor: number } },
  factCheckResults: { verification: string; confidence: number }[],
  statistics: { isBaselineProvided: boolean }[],
  sources: any[],
  claims: { verifiability: string }[]
): FactualReliabilityScore {
  const baseScore = computeFactualReliabilityScore(synthesis, factCheckResults, statistics)
  const { confidence, marginOfError } = calculateConfidenceInterval(factCheckResults, sources, claims)

  return {
    ...baseScore,
    confidence,
    breakdown: baseScore.breakdown.map(b => ({
      ...b,
      details: b.component === 'Claim Verification Rate'
        ? `${b.details} (±${marginOfError}%)`
        : b.details
    }))
  }
}

/**
 * Compute Rhetorical Neutrality Score (0-100)
 * Based on: language neutrality, framing balance, omission absence, logical validity
 */
function computeRhetoricalNeutralityScore(
  deceptionResult: { instances: { category: string; severity: string }[]; score: number },
  fallacies: { severity: string }[],
  contextAudit: { omissions: unknown[]; framing: unknown[]; overallScore: number },
  emotionalLanguageDensity: number
): RhetoricalNeutralityScore {
  // Language neutrality (35 points max) - inverse of emotional language + emotional deception
  const emotionalDeceptions = deceptionResult.instances.filter(i => i.category === 'emotional')
  const languageNeutrality = Math.max(0, 35 - Math.round(emotionalLanguageDensity * 20) - (emotionalDeceptions.length * 5))

  // Framing balance (25 points max) - inverse of framing techniques detected
  const framingTechniques = deceptionResult.instances.filter(i => i.category === 'framing')
  const framingBalance = Math.max(0, 25 - (framingTechniques.length * 5) - (contextAudit.framing?.length || 0) * 3)

  // Omission absence (25 points max) - inverse of omissions detected
  const omissionAbsence = Math.max(0, 25 - (contextAudit.omissions?.length || 0) * 4)

  // Logical validity (15 points max) - inverse of fallacies
  const highSeverityFallacies = fallacies.filter(f => f.severity === 'high').length
  const mediumSeverityFallacies = fallacies.filter(f => f.severity === 'medium').length
  const logicalValidity = Math.max(0, 15 - (highSeverityFallacies * 5) - (mediumSeverityFallacies * 3))

  const totalScore = Math.min(100, languageNeutrality + framingBalance + omissionAbsence + logicalValidity)

  return {
    score: totalScore,
    max: 100,
    confidence: 0.75,
    label: getRhetoricalNeutralityLabel(totalScore),
    breakdown: [
      { component: 'Language Neutrality', score: languageNeutrality, max: 35, details: `${emotionalDeceptions.length} emotional manipulation instances` },
      { component: 'Framing Balance', score: framingBalance, max: 25, details: `${framingTechniques.length} framing techniques detected` },
      { component: 'Omission Absence', score: omissionAbsence, max: 25, details: `${contextAudit.omissions?.length || 0} omissions detected` },
      { component: 'Logical Validity', score: logicalValidity, max: 15, details: `${fallacies.length} fallacies detected` },
    ],
  }
}

/**
 * Generate reader guidance based on analysis results
 */
function generateReaderGuidance(
  synthesis: { truthScore: number; credibility: string },
  breakingNews: BreakingNewsContext,
  factCheckResults: { claim: string; verification: string }[]
): ReaderGuidance {
  const unverifiedClaims = factCheckResults.filter(r => r.verification === 'inconclusive' || r.verification === 'not_supported')

  const keyQuestions = unverifiedClaims.slice(0, 5).map(c => `Is "${c.claim.slice(0, 50)}..." accurate?`)

  const confidenceLevel = synthesis.truthScore >= 60 ? 'HIGH' as const :
    synthesis.truthScore >= 40 ? 'MODERATE' as const : 'LOW' as const

  return {
    summary: synthesis.truthScore >= 60
      ? 'This article has moderate to high factual reliability. Key claims are supported by evidence.'
      : synthesis.truthScore >= 40
        ? 'This article has mixed reliability. Some claims are supported but others require verification.'
        : 'This article has significant reliability concerns. Many claims lack proper sourcing or are disputed.',
    additionalSourcesRecommended: [
      'AP or Reuters wire coverage for neutral comparison',
      'Local news outlet coverage for additional perspective',
      'Primary source documents cited in the article',
    ],
    keyQuestionsToResearch: keyQuestions.length > 0 ? keyQuestions : ['What primary sources are available to verify key claims?'],
    waitForInformation: breakingNews.isBreakingNews
      ? ['Investigation findings', 'Official reports', 'Witness interviews', 'Documentary evidence']
      : [],
    confidenceLevel,
    confidenceReasoning: breakingNews.isBreakingNews
      ? 'Breaking news analysis has inherent uncertainty. Facts may change as more information emerges.'
      : confidenceLevel === 'HIGH'
        ? 'Analysis based on well-documented sources with verifiable claims.'
        : confidenceLevel === 'MODERATE'
          ? 'Some claims could be verified but key facts remain uncertain.'
          : 'Significant gaps in evidence make definitive assessment difficult.',
  }
}

/**
 * Validate extraction results to detect failed/empty extractions
 */
function validateExtraction(article: any): { valid: boolean; error?: string } {
  // Check for missing or empty title
  if (!article.title || article.title === 'Untitled Article' || article.title.trim() === '') {
    return { valid: false, error: 'Failed to extract article title' }
  }

  // Check for missing or empty content
  const hasContent = article.content?.body && article.content.body.trim().length > 100
  if (!hasContent) {
    return { valid: false, error: 'Failed to extract article content (empty or too short)' }
  }

  // Check for unknown publication (might indicate extraction failure)
  if (article.publication === 'Unknown Publication' && (!article.claims || article.claims.length === 0)) {
    return { valid: false, error: 'Extraction failed: unknown publication with no claims extracted' }
  }

  // Minimum content threshold: at least 100 characters of actual text
  const textLength = article.content?.body?.length || 0
  if (textLength < 100) {
    return { valid: false, error: `Article content too short (${textLength} chars). Minimum 100 required.` }
  }

  return { valid: true }
}

/**
 * Run full analysis on an article (MVP: in-memory only, no database)
 */
export async function runFullAnalysis(articleUrl: string, userId: string): Promise<ParseAnalysis> {
  const startTime = Date.now()
  const articleId = crypto.randomUUID()

  try {
    // Step 1: Extract article
    const article = await extractArticle({ url: articleUrl })

    // Step 1.5: Validate extraction - abort if content is empty/failed
    const extractionValidation = validateExtraction(article)
    if (!extractionValidation.valid) {
      throw new Error(`Extraction failed: ${extractionValidation.error}. Cannot proceed with analysis.`)
    }

    // Step 2: Run all 6 agents in parallel (for speed)
    const [
      steelMannedPerspectives,
      deceptionResult,
      factCheckResults,
      fallacies,
      contextAudit,
      persuasionIntent,
    ] = await Promise.all([
      steelManArticle({ article }),
      detectDeception({ article }),
      factCheckArticle({ article }),
      detectFallacies({ article }),
      auditContext({ article }),
      analyzePersuasionIntent({ article }),
    ])

    // Step 3: Synthesize results
    const synthesis = await synthesizeAnalysis({
      article,
      steelMannedPerspectives,
      deceptionDetected: deceptionResult.instances,
      factCheckResults,
      fallacies,
      contextAudit,
    })

    // Step 4: Generate comprehensive AI assessment (runs after synthesis has all context)
    const aiAssessment = await generateAIAssessment({
      article,
      truthScore: synthesis.truthScore,
      credibility: synthesis.credibility,
      scoreBreakdown: synthesis.breakdown,
      steelMannedPerspectives,
      deceptionDetected: deceptionResult.instances,
      fallacies,
      factCheckResults,
      contextAudit,
    })

    // Calculate manipulation breakdown from deception instances
    const manipulationBreakdown = {
      emotional: deceptionResult.instances.filter(i => i.category === 'emotional').length * 20,
      framing: deceptionResult.instances.filter(i => i.category === 'framing').length * 20,
      omission: contextAudit.overallScore,
      source: deceptionResult.instances.filter(i => i.category === 'source').length * 20,
      propaganda: deceptionResult.instances.filter(i => i.category === 'propaganda').length * 20,
    }

    // Calculate evidence assessment
    const primarySources = article.sources?.filter(s => s.type === 'study' || s.type === 'data') || []
    const secondarySources = article.sources?.filter(s => s.type === 'expert' || s.type === 'organization') || []
    const tertiarySources = article.sources?.filter(s => s.type === 'document') || []
    const statsWithBaseline = article.statistics?.filter(s => s.isBaselineProvided) || []

    const evidenceAssessment = {
      overallScore: synthesis.breakdown.evidenceQuality,
      primarySourceCount: primarySources.length,
      secondarySourceCount: secondarySources.length,
      tertiarySourceCount: tertiarySources.length,
      hasStatisticsWithBaseline: statsWithBaseline.length > 0,
      hasDirectQuotesInContext: article.sources?.some(s => s.url !== null) || false,
      sourceDiversity: (article.sources?.length || 0) >= 5 ? 'high' as const :
                      (article.sources?.length || 0) >= 2 ? 'medium' as const : 'low' as const,
      dataReproducibility: primarySources.some(s => s.url !== null),
      assessment: synthesis.breakdown.evidenceQuality >= 30
        ? 'Strong evidence base with multiple primary sources and well-documented statistics.'
        : synthesis.breakdown.evidenceQuality >= 20
        ? 'Moderate evidence with some primary sources, but additional verification recommended.'
        : synthesis.breakdown.evidenceQuality >= 10
        ? 'Limited evidence base. Claims should be independently verified.'
        : 'Weak evidence. Most claims lack proper sourcing or documentation.',
    }

    // Phase 1: Detect breaking news
    const breakingNewsContext = detectBreakingNews(article.publishDate)

    // Phase 2: Compute source credibility scores
    const sourceCredibility = computeSourceCredibility(
      article.sources || [],
      article.claims || []
    )

    // Phase 2: Compute enhanced claims with verification status
    const enhancedClaims = computeEnhancedClaims(
      article.claims || [],
      factCheckResults,
      sourceCredibility
    )

    // Phase 1: Compute dual scores with dynamic confidence
    const factualReliability = computeFactualReliabilityWithConfidence(
      synthesis,
      factCheckResults,
      article.statistics || [],
      article.sources || [],
      article.claims || []
    )
    const rhetoricalNeutrality = computeRhetoricalNeutralityScore(
      deceptionResult,
      fallacies,
      contextAudit,
      article.emotionalLanguageDensity
    )

    const dualScores: DualScores = {
      factualReliability,
      rhetoricalNeutrality,
      overallConfidence: (factualReliability.confidence + rhetoricalNeutrality.confidence) / 2,
    }

    // Phase 2: Generate reader guidance
    const readerGuidance = generateReaderGuidance(synthesis, breakingNewsContext, factCheckResults)

    // Step 5: Build final analysis
    const analysis: ParseAnalysis = {
      id: crypto.randomUUID(),
      articleId,
      analyzedAt: new Date().toISOString(),
      url: articleUrl,

      // Include article metadata from extraction
      articleMetadata: {
        title: article.title,
        authors: article.authors,
        publication: article.publication,
        publishDate: article.publishDate,
        articleType: article.articleType,
        headline: article.content.headline,
        subhead: article.content.subhead,
        lede: article.content.lede,
        emotionalLanguageDensity: article.emotionalLanguageDensity,
      },

      // ========================================================================
      // Phase 1: Dual-Score System (NEW)
      // ========================================================================
      dualScores,

      // ========================================================================
      // Phase 1: Breaking News Context (NEW)
      // ========================================================================
      breakingNewsContext,

      // Include extracted claims
      extractedClaims: article.claims,

      // ========================================================================
      // Phase 2: Enhanced Claims with Verification (NEW)
      // ========================================================================
      enhancedClaims,

      // Include sources cited
      sourcesCited: article.sources,

      // ========================================================================
      // Phase 2: Source Credibility Assessment (NEW)
      // ========================================================================
      sourceCredibility,

      // Include statistics
      statistics: article.statistics,

      // ========================================================================
      // Phase 2: Reader Guidance (NEW)
      // ========================================================================
      readerGuidance,

      truthScore: synthesis.truthScore,
      credibility: synthesis.credibility,
      scoreBreakdown: synthesis.breakdown,

      // Include evidence assessment
      evidenceAssessment,

      steelMannedPerspectives,
      manipulationRisk: {
        overallRisk: deceptionResult.overallRisk,
        score: deceptionResult.score,
        breakdown: manipulationBreakdown,
        severityDistribution: {
          high: deceptionResult.instances.filter(i => i.severity === 'high').length,
          medium: deceptionResult.instances.filter(i => i.severity === 'medium').length,
          low: deceptionResult.instances.filter(i => i.severity === 'low').length,
        },
      },
      deceptionDetected: deceptionResult.instances,
      fallacies,
      factCheckResults,
      whatAiThinks: synthesis.whatAiThinks,
      aiAssessment,
      persuasionIntent,
      analysisDuration: (Date.now() - startTime) / 1000,
      agentsUsed: [
        'ExtractionAgent',
        'SteelManningAgent',
        'DeceptionDetectionAgent',
        'CriticalFactCheckAgent',
        'FallacyAgent',
        'ContextAuditAgent',
        'PersuasionIntentAgent',
        'SynthesisAgent',
        'AIAssessmentAgent',
      ],
      modelVersion: 'glm-4.7',
    }

    return analysis
  } catch (error) {
    console.error('Analysis failed:', error)
    throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Run quick analysis (MVP: fits within 10s Vercel Hobby timeout)
 * Only runs extraction + deception detection + synthesis
 */
export async function runQuickAnalysis(articleUrl: string, userId: string): Promise<ParseAnalysis> {
  const startTime = Date.now()
  const articleId = crypto.randomUUID()

  try {
    // Step 1: Extract article
    const article = await extractArticle({ url: articleUrl })

    // Step 1.5: Validate extraction - abort if content is empty/failed
    const extractionValidation = validateExtraction(article)
    if (!extractionValidation.valid) {
      throw new Error(`Extraction failed: ${extractionValidation.error}. Cannot proceed with analysis.`)
    }

    // Step 2: Run only deception detection (most important agent)
    const deceptionResult = await detectDeception({ article })

    // Step 3: Quick synthesis based on extraction + deception only
    const synthesis = await synthesizeAnalysis({
      article,
      steelMannedPerspectives: [],
      deceptionDetected: deceptionResult.instances,
      factCheckResults: [],
      fallacies: [],
      contextAudit: {
        omissions: [],
        framing: [],
        narrativeStructure: 'Quick analysis - not evaluated',
        overallScore: 0,
      },
    })

    // Step 4: Build analysis result
    const analysis: ParseAnalysis = {
      id: crypto.randomUUID(),
      articleId,
      analyzedAt: new Date().toISOString(),
      url: articleUrl,
      truthScore: synthesis.truthScore,
      credibility: synthesis.credibility,
      scoreBreakdown: synthesis.breakdown,
      steelMannedPerspectives: [],
      manipulationRisk: {
        overallRisk: deceptionResult.overallRisk,
        score: deceptionResult.score,
        breakdown: {
          emotional: 0,
          framing: 0,
          omission: 0,
          source: 0,
          propaganda: 0,
        },
        severityDistribution: {
          high: deceptionResult.instances.filter(i => i.severity === 'high').length,
          medium: deceptionResult.instances.filter(i => i.severity === 'medium').length,
          low: deceptionResult.instances.filter(i => i.severity === 'low').length,
        },
      },
      deceptionDetected: deceptionResult.instances,
      fallacies: [],
      factCheckResults: [],
      whatAiThinks: synthesis.whatAiThinks,
      analysisDuration: (Date.now() - startTime) / 1000,
      agentsUsed: [
        'ExtractionAgent',
        'DeceptionDetectionAgent',
        'SynthesisAgent',
      ],
      modelVersion: 'glm-4.7',
    }

    return analysis
  } catch (error) {
    console.error('Quick analysis failed:', error)
    throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Run free analysis (limited version)
 */
export async function runFreeAnalysis(articleUrl: string, userId: string): Promise<ParseAnalysis> {
  // Use quick analysis for free tier (fits in Hobby timeout)
  return runQuickAnalysis(articleUrl, userId)
}
