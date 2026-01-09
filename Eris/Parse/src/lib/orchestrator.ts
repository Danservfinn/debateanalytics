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
} from "@/types"
import {
  getFactualReliabilityLabel,
  getRhetoricalNeutralityLabel,
  detectBreakingNews,
} from "@/types"

// ============================================================================
// Phase 1 & 2: Dual Score Computation
// ============================================================================

/**
 * Compute Factual Reliability Score (0-100)
 * Based on: claim verification rate, source documentation, contested fact resolution, statistical validity
 */
function computeFactualReliabilityScore(
  synthesis: { truthScore: number; breakdown: { evidenceQuality: number; methodologyRigor: number } },
  factCheckResults: { verification: string; confidence: number }[],
  statistics: { isBaselineProvided: boolean }[]
): FactualReliabilityScore {
  // Claim verification rate (40 points max)
  const verifiedClaims = factCheckResults.filter(r => r.verification === 'supported' || r.verification === 'partially_supported')
  const claimVerificationRate = factCheckResults.length > 0
    ? Math.round((verifiedClaims.length / factCheckResults.length) * 40)
    : 20 // neutral if no claims to verify

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
    confidence: 0.7, // Default confidence
    label: getFactualReliabilityLabel(totalScore),
    breakdown: [
      { component: 'Claim Verification Rate', score: claimVerificationRate, max: 40, details: `${verifiedClaims.length}/${factCheckResults.length} claims verified` },
      { component: 'Source Documentation', score: sourceDocumentation, max: 25, details: 'Based on evidence quality assessment' },
      { component: 'Contested Fact Resolution', score: contestedFactResolution, max: 20, details: 'Based on methodology rigor' },
      { component: 'Statistical Validity', score: statisticalValidity, max: 15, details: `${statsWithBaseline}/${statistics.length} stats with baseline` },
    ],
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
 * Run full analysis on an article (MVP: in-memory only, no database)
 */
export async function runFullAnalysis(articleUrl: string, userId: string): Promise<ParseAnalysis> {
  const startTime = Date.now()
  const articleId = crypto.randomUUID()

  try {
    // Step 1: Extract article
    const article = await extractArticle({ url: articleUrl })

    // Step 2: Run all 5 agents in parallel (for speed)
    const [
      steelMannedPerspectives,
      deceptionResult,
      factCheckResults,
      fallacies,
      contextAudit,
    ] = await Promise.all([
      steelManArticle({ article }),
      detectDeception({ article }),
      factCheckArticle({ article }),
      detectFallacies({ article }),
      auditContext({ article }),
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

    // Phase 1: Compute dual scores
    const factualReliability = computeFactualReliabilityScore(
      synthesis,
      factCheckResults,
      article.statistics || []
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

      // Include sources cited
      sourcesCited: article.sources,

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
      analysisDuration: (Date.now() - startTime) / 1000,
      agentsUsed: [
        'ExtractionAgent',
        'SteelManningAgent',
        'DeceptionDetectionAgent',
        'CriticalFactCheckAgent',
        'FallacyAgent',
        'ContextAuditAgent',
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
