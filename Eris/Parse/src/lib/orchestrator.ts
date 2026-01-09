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

      // Include extracted claims
      extractedClaims: article.claims,

      // Include sources cited
      sourcesCited: article.sources,

      // Include statistics
      statistics: article.statistics,

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
