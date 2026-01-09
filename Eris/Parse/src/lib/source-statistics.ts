import { prisma } from './prisma'
import { calculateBayesianScore, BayesianSourceScore } from './statistics/bayesian'
import { calculateEffectiveSampleSizeWithDates } from './statistics/effective-sample-size'
import { calculateLogicScore } from './statistics/logic-score'
import { calculateMethodologyScore } from './statistics/methodology-score'
import { mean, variance } from './statistics/utils'

// ============================================================================
// Types
// ============================================================================

export interface SourceStats {
  id: string
  publication: string
  articleCount: number

  // Bayesian estimates
  bayesianScore: BayesianSourceScore

  // Grade
  grade: string
  gradeDisplay: string
  numericScore: number

  // Component scores (new weights: logic 30%, methodology 20%)
  components: {
    logicalStructure: number      // 30%
    methodologyRigor: number      // 20%
    factualReliability: number    // 25%
    manipulationAbsence: number   // 15%
    consistency: number           // 10%
  }

  // Penalty applied
  penalty: number
  penaltyReason: string | null

  // Distributions
  credibilityDistribution: Record<string, number>
  articleTypeDistribution: Record<string, number>

  // Patterns
  manipulationBreakdown: Record<string, number>
  topDeceptionTypes: Array<{ type: string; count: number }>
  topFallacies: Array<{ type: string; count: number }>
  factCheckPerformance: {
    supported: number
    partiallySupported: number
    refuted: number
    successRate: number
  }

  // Trend
  trend: {
    direction: 'improving' | 'stable' | 'declining'
    change30Days: number | null
    change90Days: number | null
    sparklineData: number[]
  }

  // Metadata
  firstAnalysis: string
  lastAnalysis: string
  timeSpanDays: number
}

export interface SourceStatsQuery {
  minArticles?: number
  timeRange?: 'all' | '30d' | '90d' | '1y'
  articleType?: string
  sortBy?: 'grade' | 'articles' | 'recent'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// ============================================================================
// Global Statistics (for Bayesian shrinkage)
// ============================================================================

let globalStats: { mean: number; variance: number } | null = null
let globalStatsExpiry: number = 0

async function getGlobalStats(): Promise<{ mean: number; variance: number }> {
  const now = Date.now()

  // Cache for 1 hour
  if (globalStats && now < globalStatsExpiry) {
    return globalStats
  }

  const allAnalyses = await prisma.analysis.findMany({
    select: { truthScore: true }
  })

  const scores = allAnalyses.map(a => a.truthScore)

  globalStats = {
    mean: scores.length > 0 ? mean(scores) : 50,
    variance: scores.length > 1 ? variance(scores) : 225 // Default variance ~15 std dev
  }
  globalStatsExpiry = now + (60 * 60 * 1000) // 1 hour

  return globalStats
}

// ============================================================================
// Main Query Function
// ============================================================================

export async function getSourceStats(query: SourceStatsQuery = {}): Promise<{
  sources: SourceStats[]
  total: number
  globalMean: number
}> {
  const {
    minArticles = 1,
    timeRange = 'all',
    articleType,
    sortBy = 'grade',
    sortOrder = 'desc',
    limit = 50,
    offset = 0
  } = query

  // Build date filter
  let dateFilter: Date | undefined
  if (timeRange !== 'all') {
    const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    dateFilter = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  }

  // Get global stats for Bayesian shrinkage
  const global = await getGlobalStats()

  // Get all articles grouped by publication
  const articles = await prisma.article.findMany({
    where: {
      ...(articleType && { articleType }),
      analyses: {
        some: {
          ...(dateFilter && { createdAt: { gte: dateFilter } })
        }
      }
    },
    include: {
      analyses: {
        where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  // Group by publication
  const byPublication = new Map<string, typeof articles>()
  for (const article of articles) {
    const pub = article.publication
    if (!byPublication.has(pub)) {
      byPublication.set(pub, [])
    }
    byPublication.get(pub)!.push(article)
  }

  // Calculate stats for each publication
  const sourceStats: SourceStats[] = []

  for (const [publication, pubArticles] of byPublication) {
    const allAnalyses = pubArticles.flatMap(a => a.analyses)

    if (allAnalyses.length < minArticles) continue

    const stats = calculateSourceStatistics(
      publication,
      pubArticles,
      allAnalyses,
      global
    )

    sourceStats.push(stats)
  }

  // Sort
  sourceStats.sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'grade':
        comparison = a.numericScore - b.numericScore
        break
      case 'articles':
        comparison = a.articleCount - b.articleCount
        break
      case 'recent':
        comparison = new Date(a.lastAnalysis).getTime() - new Date(b.lastAnalysis).getTime()
        break
    }
    return sortOrder === 'desc' ? -comparison : comparison
  })

  // Paginate
  const total = sourceStats.length
  const paginated = sourceStats.slice(offset, offset + limit)

  return {
    sources: paginated,
    total,
    globalMean: global.mean
  }
}

// ============================================================================
// Statistics Calculator
// ============================================================================

interface AnalysisData {
  id: string
  truthScore: number
  credibility: string
  scoreBreakdown: unknown
  deceptionDetected: unknown[]
  fallacies: unknown[]
  factCheckResults: unknown[]
  createdAt: Date
}

interface ArticleData {
  id: string
  publication: string
  articleType: string
  analyses: AnalysisData[]
}

function calculateSourceStatistics(
  publication: string,
  articles: ArticleData[],
  analyses: AnalysisData[],
  global: { mean: number; variance: number }
): SourceStats {
  // Extract truth scores
  const truthScores = analyses.map(a => a.truthScore)

  // Calculate Bayesian score
  const bayesianScore = calculateBayesianScore(truthScores, global.mean, global.variance)

  // Extract all fallacies and deceptions
  const allFallacies = analyses.flatMap(a =>
    Array.isArray(a.fallacies) ? a.fallacies : []
  ) as Array<{ type: string; severity: 'low' | 'medium' | 'high' }>

  const allDeceptions = analyses.flatMap(a =>
    Array.isArray(a.deceptionDetected) ? a.deceptionDetected : []
  ) as Array<{ type: string; category: string }>

  // Extract score breakdowns
  const scoreBreakdowns = analyses
    .map(a => a.scoreBreakdown as { evidenceQuality?: number; methodologyRigor?: number } | null)
    .filter((s): s is { evidenceQuality?: number; methodologyRigor?: number } => s !== null)

  const avgEvidenceQuality = scoreBreakdowns.length > 0
    ? mean(scoreBreakdowns.map(s => s.evidenceQuality || 0))
    : 20
  const avgMethodologyRigor = scoreBreakdowns.length > 0
    ? mean(scoreBreakdowns.map(s => s.methodologyRigor || 0))
    : 12.5

  // Calculate component scores with NEW WEIGHTS
  const components = {
    // LOGIC: 30% weight - based on fallacy frequency/severity
    logicalStructure: calculateLogicScore({
      fallacies: allFallacies,
      totalArticles: articles.length
    }),

    // METHODOLOGY: 20% weight - based on evidence and sourcing
    methodologyRigor: calculateMethodologyScore({
      avgEvidenceQuality,
      avgMethodologyRigor,
      primarySourceRate: 0.5, // Default estimate
      verifiedClaimRate: 0.5  // Default estimate
    }),

    // FACTUAL RELIABILITY: 25% weight
    factualReliability: bayesianScore.shrunkScore,

    // MANIPULATION ABSENCE: 15% weight
    manipulationAbsence: Math.max(0, 100 - (allDeceptions.length / articles.length) * 20),

    // CONSISTENCY: 10% weight
    consistency: Math.max(0, 100 - Math.sqrt(bayesianScore.rawVariance) * 4)
  }

  // Calculate weighted score with NEW WEIGHTS
  const weights = {
    logicalStructure: 0.30,      // 30% - HIGHEST
    methodologyRigor: 0.20,      // 20% - SECOND HIGHEST
    factualReliability: 0.25,    // 25%
    manipulationAbsence: 0.15,   // 15%
    consistency: 0.10            // 10%
  }

  let baseScore = 0
  for (const [key, weight] of Object.entries(weights)) {
    baseScore += components[key as keyof typeof components] * weight
  }

  // Apply sample size penalty only
  let penalty = 0
  let penaltyReason: string | null = null
  if (analyses.length < 20) {
    penalty = 10 * (1 - analyses.length / 20)
    penaltyReason = `Low sample size (${analyses.length} articles)`
  }

  const finalScore = Math.max(0, baseScore - penalty)
  const grade = scoreToGrade(finalScore)

  // Calculate distributions
  const credibilityDistribution = analyses.reduce((acc, a) => {
    acc[a.credibility] = (acc[a.credibility] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const articleTypeDistribution = articles.reduce((acc, a) => {
    acc[a.articleType] = (acc[a.articleType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Manipulation breakdown
  const manipulationBreakdown = allDeceptions.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Top deception types
  const deceptionCounts = new Map<string, number>()
  allDeceptions.forEach(d => {
    deceptionCounts.set(d.type, (deceptionCounts.get(d.type) || 0) + 1)
  })
  const topDeceptionTypes = Array.from(deceptionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }))

  // Top fallacies
  const fallacyCounts = new Map<string, number>()
  allFallacies.forEach(f => {
    fallacyCounts.set(f.type, (fallacyCounts.get(f.type) || 0) + 1)
  })
  const topFallacies = Array.from(fallacyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }))

  // Fact-check performance
  const allFactChecks = analyses.flatMap(a =>
    Array.isArray(a.factCheckResults) ? a.factCheckResults : []
  ) as Array<{ verification: string }>

  const factCheckPerformance = {
    supported: allFactChecks.filter(f => f.verification === 'supported').length,
    partiallySupported: allFactChecks.filter(f => f.verification === 'partially_supported').length,
    refuted: allFactChecks.filter(f => f.verification === 'refuted').length,
    successRate: allFactChecks.length > 0
      ? (allFactChecks.filter(f =>
          f.verification === 'supported' || f.verification === 'partially_supported'
        ).length / allFactChecks.length) * 100
      : 0
  }

  // Calculate trend
  const trend = calculateTrend(analyses)

  // Timestamps
  const sortedByDate = [...analyses].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const firstAnalysis = sortedByDate[0]?.createdAt.toISOString() || new Date().toISOString()
  const lastAnalysis = sortedByDate[sortedByDate.length - 1]?.createdAt.toISOString() || new Date().toISOString()
  const timeSpanDays = Math.ceil(
    (new Date(lastAnalysis).getTime() - new Date(firstAnalysis).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Update effective sample size with temporal weighting
  const analysesWithDates = analyses.map(a => ({
    createdAt: a.createdAt,
    truthScore: a.truthScore
  }))
  bayesianScore.effectiveSampleSize = calculateEffectiveSampleSizeWithDates(analysesWithDates)

  return {
    id: publication.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    publication,
    articleCount: articles.length,
    bayesianScore,
    grade,
    gradeDisplay: formatGradeDisplay(grade, bayesianScore.gradeConfidence),
    numericScore: Math.round(finalScore * 10) / 10,
    components,
    penalty: Math.round(penalty * 10) / 10,
    penaltyReason,
    credibilityDistribution,
    articleTypeDistribution,
    manipulationBreakdown,
    topDeceptionTypes,
    topFallacies,
    factCheckPerformance,
    trend,
    firstAnalysis,
    lastAnalysis,
    timeSpanDays
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function scoreToGrade(score: number): string {
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 67) return 'D+'
  if (score >= 63) return 'D'
  if (score >= 60) return 'D-'
  return 'F'
}

function formatGradeDisplay(
  grade: string,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
): string {
  switch (confidence) {
    case 'HIGH': return grade
    case 'MEDIUM': return `${grade} ±`
    case 'LOW': return `~${grade}`
    case 'INSUFFICIENT': return 'N/R'
  }
}

function calculateTrend(analyses: AnalysisData[]): SourceStats['trend'] {
  if (analyses.length < 5) {
    return {
      direction: 'stable',
      change30Days: null,
      change90Days: null,
      sparklineData: analyses.map(a => a.truthScore)
    }
  }

  const sorted = [...analyses].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000

  const recent = sorted.filter(a => new Date(a.createdAt).getTime() > thirtyDaysAgo)
  const older30 = sorted.filter(a => new Date(a.createdAt).getTime() <= thirtyDaysAgo)
  const older90 = sorted.filter(a =>
    new Date(a.createdAt).getTime() <= ninetyDaysAgo
  )

  const recentAvg = recent.length > 0 ? mean(recent.map(a => a.truthScore)) : null
  const older30Avg = older30.length > 0 ? mean(older30.map(a => a.truthScore)) : null
  const older90Avg = older90.length > 0 ? mean(older90.map(a => a.truthScore)) : null

  const change30Days = recentAvg !== null && older30Avg !== null
    ? Math.round((recentAvg - older30Avg) * 10) / 10
    : null

  const change90Days = recentAvg !== null && older90Avg !== null
    ? Math.round((recentAvg - older90Avg) * 10) / 10
    : null

  let direction: 'improving' | 'stable' | 'declining' = 'stable'
  if (change30Days !== null) {
    if (change30Days > 3) direction = 'improving'
    else if (change30Days < -3) direction = 'declining'
  }

  // Generate sparkline data (last 20 analyses)
  const sparklineData = sorted.slice(-20).map(a => a.truthScore)

  return {
    direction,
    change30Days,
    change90Days,
    sparklineData
  }
}

// ============================================================================
// Single Source Query
// ============================================================================

export async function getSourceStatsById(
  publication: string
): Promise<SourceStats | null> {
  const global = await getGlobalStats()

  const articles = await prisma.article.findMany({
    where: { publication },
    include: {
      analyses: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (articles.length === 0) return null

  const allAnalyses = articles.flatMap(a => a.analyses)

  if (allAnalyses.length === 0) return null

  return calculateSourceStatistics(publication, articles, allAnalyses, global)
}
