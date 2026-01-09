/**
 * Analysis Results Page
 * Displays full analysis results with all sections from design.md
 * Loads from database API, with sessionStorage fallback for fresh analyses
 */

'use client';

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Download, Share2, Copy, CheckCircle, AlertTriangle, XCircle, Info, FileText, Users, Calendar, BookOpen, BarChart3, Shield, Brain, Scale, Search, History } from "lucide-react";
import {
  getCredibilityLabel,
  getCredibilityColor,
  getFactualReliabilityColor,
  getRhetoricalNeutralityColor,
  getConfidenceLevelColor,
  type ParseAnalysis,
  type TruthScoreBreakdown,
  type SteelMannedPerspective,
  type DeceptionInstance,
  type FallacyInstance,
  type FactCheckResult,
  type ManipulationRisk,
  type ExtractedClaim,
  type ArticleSource,
  type StatisticReference,
  type AIAssessment,
  type DualScores,
  type BreakingNewsContext,
  type ReaderGuidance,
} from "@/types";

interface PageProps {
  params: Promise<{ analysisId: string }>;
}

// Helper function for article type labels
function getArticleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    news: 'News Article',
    op_ed: 'Opinion / Editorial',
    blog_post: 'Blog Post',
    analysis: 'Analysis',
  };
  return labels[type] || type;
}

// Helper function for claim type colors
function getClaimTypeColor(type: string): string {
  const colors: Record<string, string> = {
    factual: '#3b82f6',      // blue
    causal: '#8b5cf6',       // purple
    predictive: '#f59e0b',   // amber
    normative: '#10b981',    // emerald
    opinion: '#6b7280',      // gray
  };
  return colors[type] || '#6b7280';
}

// Helper function for verification colors
function getVerificationColor(verification: string): string {
  const colors: Record<string, string> = {
    supported: '#22c55e',
    partially_supported: '#f59e0b',
    not_supported: '#f97316',
    refuted: '#ef4444',
    inconclusive: '#6b7280',
  };
  return colors[verification] || '#6b7280';
}

export default function AnalysisResultPage({ params }: PageProps) {
  // Next.js 15+ requires params to be unwrapped with use()
  const { analysisId } = use(params);
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ParseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isFromDatabase, setIsFromDatabase] = useState(false);
  const parseCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      // First try to load from database API
      try {
        const response = await fetch(`/api/analyses/${analysisId}`);
        const result = await response.json();

        if (result.success && result.data) {
          console.log('Loaded analysis from database');
          // Transform API response to match ParseAnalysis format
          const apiData = result.data;
          const analysisData: ParseAnalysis = {
            id: apiData.id,
            articleId: apiData.id, // Use analysis ID as articleId for shared view
            url: apiData.url,
            truthScore: apiData.truthScore,
            credibility: apiData.credibility,
            scoreBreakdown: apiData.scoreBreakdown,
            steelMannedPerspectives: apiData.steelMannedPerspectives || [],
            manipulationRisk: apiData.manipulationRisk,
            deceptionDetected: apiData.deceptionDetected || [],
            fallacies: apiData.fallacies || [],
            factCheckResults: apiData.factCheckResults || [],
            whatAiThinks: apiData.whatAiThinks,
            aiAssessment: apiData.aiAssessment,
            analysisDuration: apiData.analysisDuration,
            agentsUsed: apiData.agentsUsed || [],
            modelVersion: apiData.modelVersion,
            analyzedAt: apiData.createdAt,
            articleMetadata: apiData.articleMetadata,
            extractedClaims: apiData.extractedClaims || [],
            sourcesCited: apiData.sourcesCited || [],
            statistics: apiData.statistics || [],
            evidenceAssessment: apiData.evidenceAssessment,
            dualScores: apiData.dualScores,
            breakingNewsContext: apiData.breakingNewsContext,
            readerGuidance: apiData.readerGuidance,
          };
          setAnalysis(analysisData);
          setIsFromDatabase(true);
          setLoading(false);
          return;
        }
      } catch (apiError) {
        console.log('API fetch failed, falling back to sessionStorage:', apiError);
      }

      // Fall back to sessionStorage for fresh analyses
      const storageKey = `analysis_${analysisId}`;
      console.log('Looking for sessionStorage key:', storageKey);
      const stored = sessionStorage.getItem(storageKey);
      console.log('Found stored data:', stored ? 'yes' : 'no');

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          console.log('Parsed analysis ID:', parsed.id);
          setAnalysis(parsed);
          setIsFromDatabase(false);
        } catch (e) {
          console.error('Failed to parse stored analysis:', e);
          setDebugInfo(`Parse error: ${e}`);
        }
      } else {
        // Debug: List all sessionStorage keys
        const allKeys = Object.keys(sessionStorage);
        console.log('All sessionStorage keys:', allKeys);
        setDebugInfo(`No data found for ${storageKey}. Available keys: ${allKeys.join(', ') || 'none'}`);
      }
      setLoading(false);
    };

    fetchAnalysis();
  }, [analysisId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-headline text-2xl text-foreground">Analysis Not Found</h1>
          <p className="text-muted-foreground">
            The analysis may have expired or the link is invalid.
          </p>
          {debugInfo && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-w-md">
              Debug: {debugInfo}
            </p>
          )}
          <Button onClick={() => router.push('/analyze')}>
            Analyze New Article
          </Button>
        </div>
      </div>
    );
  }

  const credibilityLabel = getCredibilityLabel(analysis.truthScore);
  const credibilityColor = getCredibilityColor(credibilityLabel);

  // Parse fields with defaults
  const scoreBreakdown: TruthScoreBreakdown = analysis.scoreBreakdown || {
    evidenceQuality: 0,
    methodologyRigor: 0,
    logicalStructure: 0,
    manipulationAbsence: 0,
  };

  const articleMetadata = analysis.articleMetadata;
  const extractedClaims: ExtractedClaim[] = analysis.extractedClaims || [];
  const sourcesCited: ArticleSource[] = analysis.sourcesCited || [];
  const statistics: StatisticReference[] = analysis.statistics || [];
  const evidenceAssessment = analysis.evidenceAssessment;
  const steelMannedPerspectives: SteelMannedPerspective[] = analysis.steelMannedPerspectives || [];
  const deceptions: DeceptionInstance[] = analysis.deceptionDetected || [];
  const fallacies: FallacyInstance[] = analysis.fallacies || [];
  const factChecks: FactCheckResult[] = analysis.factCheckResults || [];
  const manipulationRisk: ManipulationRisk | undefined = analysis.manipulationRisk;

  // Phase 1 & 2 enhanced fields
  const dualScores: DualScores | undefined = analysis.dualScores;
  const breakingNewsContext: BreakingNewsContext | undefined = analysis.breakingNewsContext;
  const readerGuidance: ReaderGuidance | undefined = analysis.readerGuidance;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* ============================================ */}
        {/* ARTICLE HEADER */}
        {/* ============================================ */}
        {articleMetadata && (
          <div className="mb-8">
            {/* Article Type Badge */}
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {getArticleTypeLabel(articleMetadata.articleType)}
              </Badge>
              {articleMetadata.emotionalLanguageDensity > 0.5 && (
                <Badge variant="destructive" className="text-xs">
                  High Emotional Content
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="font-headline text-3xl md:text-4xl text-foreground mb-3 leading-tight">
              {articleMetadata.title || articleMetadata.headline}
            </h1>

            {/* Subhead */}
            {articleMetadata.subhead && (
              <p className="text-lg text-muted-foreground mb-4 font-body">
                {articleMetadata.subhead}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {articleMetadata.publication && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {articleMetadata.publication}
                </span>
              )}
              {articleMetadata.authors?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {articleMetadata.authors.join(', ')}
                </span>
              )}
              {articleMetadata.publishDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(articleMetadata.publishDate).toLocaleDateString()}
                </span>
              )}
              <a
                href={analysis.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View Original
              </a>
            </div>

            {/* Lede */}
            {articleMetadata.lede && (
              <div className="mt-4 p-4 bg-muted/30 border-l-4 border-primary rounded-r">
                <p className="text-foreground font-body italic">
                  {articleMetadata.lede}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* BREAKING NEWS WARNING (Phase 1) */}
        {/* ============================================ */}
        {breakingNewsContext?.isBreakingNews && (
          <Card className="mb-6 border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-headline font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    Breaking News Analysis
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    This article was published {breakingNewsContext.hoursAfterEvent !== undefined ?
                      `${breakingNewsContext.hoursAfterEvent} hours after the event` : 'recently'}.
                    Early reporting often contains errors or relies heavily on official statements.
                  </p>
                  {breakingNewsContext.warnings && breakingNewsContext.warnings.length > 0 && (
                    <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-1">
                      {breakingNewsContext.warnings.map((warning, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                  {breakingNewsContext.recommendReanalysisAfter && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Recommend re-analysis after: {new Date(breakingNewsContext.recommendReanalysisAfter).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* DUAL SCORES (Phase 1) */}
        {/* ============================================ */}
        {dualScores && (
          <Card className="mb-6 border-border">
            <CardHeader className="pb-4">
              <CardTitle className="font-headline flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Dual-Score Analysis
              </CardTitle>
              <CardDescription>
                Separate assessment of factual accuracy and rhetorical techniques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Factual Reliability Score */}
                <div className="p-4 rounded-lg border border-border bg-background">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-foreground">Factual Reliability</h4>
                    <Badge
                      className="text-sm"
                      style={{
                        backgroundColor: getFactualReliabilityColor(dualScores.factualReliability.label),
                        color: 'white'
                      }}
                    >
                      {dualScores.factualReliability.label.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-center mb-4">
                    <div
                      className="text-4xl font-bold font-masthead"
                      style={{ color: getFactualReliabilityColor(dualScores.factualReliability.label) }}
                    >
                      {dualScores.factualReliability.score}
                    </div>
                    <div className="text-sm text-muted-foreground">/ 100</div>
                  </div>
                  {/* Breakdown */}
                  <div className="space-y-2">
                    {dualScores.factualReliability.breakdown.map((item, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">{item.component}</span>
                          <span className="text-foreground font-medium">{item.score}/{item.max}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(item.score / item.max) * 100}%`,
                              backgroundColor: getFactualReliabilityColor(dualScores.factualReliability.label)
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rhetorical Neutrality Score */}
                <div className="p-4 rounded-lg border border-border bg-background">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-foreground">Rhetorical Neutrality</h4>
                    <Badge
                      className="text-sm"
                      style={{
                        backgroundColor: getRhetoricalNeutralityColor(dualScores.rhetoricalNeutrality.label),
                        color: 'white'
                      }}
                    >
                      {dualScores.rhetoricalNeutrality.label.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-center mb-4">
                    <div
                      className="text-4xl font-bold font-masthead"
                      style={{ color: getRhetoricalNeutralityColor(dualScores.rhetoricalNeutrality.label) }}
                    >
                      {dualScores.rhetoricalNeutrality.score}
                    </div>
                    <div className="text-sm text-muted-foreground">/ 100</div>
                  </div>
                  {/* Breakdown */}
                  <div className="space-y-2">
                    {dualScores.rhetoricalNeutrality.breakdown.map((item, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">{item.component}</span>
                          <span className="text-foreground font-medium">{item.score}/{item.max}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(item.score / item.max) * 100}%`,
                              backgroundColor: getRhetoricalNeutralityColor(dualScores.rhetoricalNeutrality.label)
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Overall Confidence */}
              <div className="mt-4 pt-4 border-t border-border text-center">
                <span className="text-sm text-muted-foreground">
                  Analysis Confidence: <strong className="text-foreground">{Math.round(dualScores.overallConfidence * 100)}%</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* PARSE CARD (Shareable Summary) */}
        {/* ============================================ */}
        <Card ref={parseCardRef} className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Score Circle */}
              <div className="text-center">
                <div
                  className="text-6xl md:text-7xl font-bold font-masthead"
                  style={{ color: credibilityColor }}
                >
                  {analysis.truthScore}
                </div>
                <Badge
                  className="text-sm px-4 py-1 mt-2"
                  style={{ backgroundColor: credibilityColor, color: 'white' }}
                >
                  {credibilityLabel.toUpperCase()} CREDIBILITY
                </Badge>
              </div>

              {/* Key Metrics with Rationales */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Evidence Quality</span>
                    <span className="text-xl font-bold text-foreground">{scoreBreakdown.evidenceQuality}<span className="text-sm font-normal text-muted-foreground">/40</span></span>
                  </div>
                  {scoreBreakdown.evidenceRationale && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{scoreBreakdown.evidenceRationale}</p>
                  )}
                </div>
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Methodology Rigor</span>
                    <span className="text-xl font-bold text-foreground">{scoreBreakdown.methodologyRigor}<span className="text-sm font-normal text-muted-foreground">/25</span></span>
                  </div>
                  {scoreBreakdown.methodologyRationale && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{scoreBreakdown.methodologyRationale}</p>
                  )}
                </div>
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Logical Structure</span>
                    <span className="text-xl font-bold text-foreground">{scoreBreakdown.logicalStructure}<span className="text-sm font-normal text-muted-foreground">/20</span></span>
                  </div>
                  {scoreBreakdown.logicalRationale && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{scoreBreakdown.logicalRationale}</p>
                  )}
                </div>
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Manipulation Absence</span>
                    <span className="text-xl font-bold text-foreground">{scoreBreakdown.manipulationAbsence}<span className="text-sm font-normal text-muted-foreground">/15</span></span>
                  </div>
                  {scoreBreakdown.manipulationRationale && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{scoreBreakdown.manipulationRationale}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border justify-center">
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{steelMannedPerspectives.length}</strong> Perspectives
              </span>
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{deceptions.length}</strong> Deceptions
              </span>
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{fallacies.length}</strong> Fallacies
              </span>
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{factChecks.length}</strong> Fact Checks
              </span>
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{extractedClaims.length}</strong> Claims
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* WHAT AI THINKS - COMPREHENSIVE ASSESSMENT */}
        {/* ============================================ */}
        {(analysis.aiAssessment || analysis.whatAiThinks) && (
          <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="font-headline flex items-center gap-3 text-2xl">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                What AI Thinks
              </CardTitle>
              <CardDescription className="text-sm mt-2">
                Comprehensive analysis from an unbiased superintelligence perspective
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {analysis.aiAssessment ? (
                <div className="space-y-6">
                  {/* THE VERDICT */}
                  <div className="p-4 bg-background rounded-lg border-l-4 border-primary">
                    <h4 className="font-headline font-bold text-lg text-primary mb-2 uppercase tracking-wide">
                      The Verdict
                    </h4>
                    <p className="text-foreground leading-relaxed font-body">
                      {analysis.aiAssessment.verdict}
                    </p>
                  </div>

                  {/* THE INTENT */}
                  <div className="p-4 bg-background rounded-lg border-l-4 border-amber-500">
                    <h4 className="font-headline font-bold text-lg text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
                      The Intent
                    </h4>
                    <p className="text-foreground leading-relaxed font-body">
                      {analysis.aiAssessment.intent}
                    </p>
                  </div>

                  {/* THE BLIND SPOTS */}
                  <div className="p-4 bg-background rounded-lg border-l-4 border-purple-500">
                    <h4 className="font-headline font-bold text-lg text-purple-600 dark:text-purple-400 mb-2 uppercase tracking-wide">
                      The Blind Spots
                    </h4>
                    <p className="text-foreground leading-relaxed font-body">
                      {analysis.aiAssessment.blindSpots}
                    </p>
                  </div>

                  {/* THE UNCOMFORTABLE TRUTH */}
                  <div className="p-4 bg-background rounded-lg border-l-4 border-red-500">
                    <h4 className="font-headline font-bold text-lg text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">
                      The Uncomfortable Truth
                    </h4>
                    <p className="text-foreground leading-relaxed font-body">
                      {analysis.aiAssessment.uncomfortableTruth}
                    </p>
                  </div>

                  {/* THE KERNEL OF TRUTH */}
                  <div className="p-4 bg-background rounded-lg border-l-4 border-green-500">
                    <h4 className="font-headline font-bold text-lg text-green-600 dark:text-green-400 mb-2 uppercase tracking-wide">
                      The Kernel of Truth
                    </h4>
                    <p className="text-foreground leading-relaxed font-body">
                      {analysis.aiAssessment.kernelOfTruth}
                    </p>
                  </div>

                  {/* WHAT YOU SHOULD DO */}
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <h4 className="font-headline font-bold text-lg text-primary mb-2 uppercase tracking-wide">
                      What You Should Do
                    </h4>
                    <p className="text-foreground leading-relaxed font-body">
                      {analysis.aiAssessment.whatYouShouldDo}
                    </p>
                  </div>
                </div>
              ) : (
                /* Fallback to legacy whatAiThinks */
                <p className="text-lg leading-relaxed font-body text-foreground">{analysis.whatAiThinks}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* EVIDENCE QUALITY ASSESSMENT */}
        {/* ============================================ */}
        {evidenceAssessment && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Evidence Quality Assessment
              </CardTitle>
              <CardDescription>
                Detailed breakdown of source quality and evidence strength
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{evidenceAssessment.primarySourceCount}</div>
                  <div className="text-xs text-muted-foreground">Primary Sources</div>
                  <div className="text-xs text-blue-600 mt-1">Studies, Data</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{evidenceAssessment.secondarySourceCount}</div>
                  <div className="text-xs text-muted-foreground">Secondary Sources</div>
                  <div className="text-xs text-purple-600 mt-1">Experts, Orgs</div>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">{evidenceAssessment.tertiarySourceCount}</div>
                  <div className="text-xs text-muted-foreground">Tertiary Sources</div>
                  <div className="text-xs text-amber-600 mt-1">Documents</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <div className="text-2xl font-bold" style={{ color: credibilityColor }}>{evidenceAssessment.overallScore}/40</div>
                  <div className="text-xs text-muted-foreground">Evidence Score</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {evidenceAssessment.hasStatisticsWithBaseline ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">Stats with Baseline</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {evidenceAssessment.hasDirectQuotesInContext ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">Linked Sources</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {evidenceAssessment.dataReproducibility ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">Reproducible Data</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={evidenceAssessment.sourceDiversity === 'high' ? 'default' : 'outline'}>
                    {evidenceAssessment.sourceDiversity} diversity
                  </Badge>
                </div>
              </div>

              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                {evidenceAssessment.assessment}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* STEEL-MANNED PERSPECTIVES */}
        {/* ============================================ */}
        {steelMannedPerspectives.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Steel-Manned Perspectives
              </CardTitle>
              <CardDescription>
                Strongest possible versions of each viewpoint, with supporting arguments and evidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {steelMannedPerspectives.map((perspective) => (
                  <div key={perspective.id} className="border border-border p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-foreground">{perspective.label}</h3>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          Original: {perspective.originalStrength}
                        </Badge>
                        <Badge style={{ backgroundColor: perspective.steelMannedVersion.qualityScore >= 80 ? '#22c55e' : perspective.steelMannedVersion.qualityScore >= 60 ? '#f59e0b' : '#ef4444', color: 'white' }}>
                          {perspective.steelMannedVersion.qualityScore}/100
                        </Badge>
                      </div>
                    </div>

                    {/* Core Claim */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Core Claim</h4>
                      <p className="text-foreground">{perspective.steelMannedVersion.coreClaim}</p>
                    </div>

                    {/* Logical Structure */}
                    {perspective.steelMannedVersion.logicalStructure && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Logical Structure</h4>
                        <p className="text-sm text-foreground bg-muted/50 p-2 rounded">{perspective.steelMannedVersion.logicalStructure}</p>
                      </div>
                    )}

                    {/* Strongest Arguments */}
                    {perspective.steelMannedVersion.strongestArguments?.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Strongest Arguments</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {perspective.steelMannedVersion.strongestArguments.map((arg, i) => (
                            <li key={i} className="text-sm text-foreground">{arg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Best Evidence */}
                    {perspective.steelMannedVersion.bestEvidence?.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Best Evidence</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {perspective.steelMannedVersion.bestEvidence.map((evidence, i) => (
                            <li key={i} className="text-sm text-foreground">{evidence}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Anticipated Counterarguments */}
                    {perspective.steelMannedVersion.anticipatedCounterarguments?.length > 0 && (
                      <div className="mb-2">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Anticipated Counterarguments</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {perspective.steelMannedVersion.anticipatedCounterarguments.map((counter, i) => (
                            <li key={i} className="text-sm text-muted-foreground italic">{counter}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Source in Article */}
                    {perspective.sourceInArticle?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Source quotes: {perspective.sourceInArticle.slice(0, 2).map(s => `"${s.substring(0, 50)}..."`).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* DECEPTION DETECTION */}
        {/* ============================================ */}
        {deceptions.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Deception Detected
              </CardTitle>
              <CardDescription>
                Manipulation techniques and propaganda patterns ({deceptions.length} found)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deceptions.map((deception) => (
                  <div key={deception.id} className="border-l-4 border-destructive pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex gap-2 mb-1">
                          <Badge className="bg-destructive/10 text-destructive border-destructive">
                            {deception.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {deception.category}
                          </Badge>
                        </div>
                        <p className="text-sm italic text-foreground">"{deception.quote}"</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {deception.explanation}
                        </p>
                      </div>
                      <Badge
                        variant={
                          deception.severity === "high"
                            ? "destructive"
                            : deception.severity === "medium"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {deception.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* LOGICAL FALLACIES */}
        {/* ============================================ */}
        {fallacies.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <XCircle className="h-5 w-5 text-amber-500" />
                Logical Fallacies Detected
              </CardTitle>
              <CardDescription>
                Errors in reasoning and argumentation ({fallacies.length} found)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {fallacies.map((fallacy) => (
                  <div key={fallacy.id} className="border-l-4 border-amber-500 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex gap-2 mb-1">
                          <Badge variant="outline">{fallacy.name || fallacy.type}</Badge>
                          {fallacy.deduction > 0 && (
                            <Badge variant="secondary">-{fallacy.deduction} pts</Badge>
                          )}
                        </div>
                        <p className="text-sm italic text-foreground">"{fallacy.quote}"</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {fallacy.explanation}
                        </p>
                        {fallacy.context && (
                          <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded">
                            Context: {fallacy.context}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          fallacy.severity === "high"
                            ? "destructive"
                            : fallacy.severity === "medium"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {fallacy.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* FACT CHECK RESULTS */}
        {/* ============================================ */}
        {factChecks.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Fact Check Results
              </CardTitle>
              <CardDescription>
                Independent verification of claims ({factChecks.length} checked)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {factChecks.map((check) => (
                  <div key={check.id} className="border border-border p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-foreground flex-1">"{check.claim}"</p>
                      <Badge
                        style={{
                          backgroundColor: getVerificationColor(check.verification),
                          color: 'white'
                        }}
                      >
                        {check.verification.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="ml-2 text-foreground">{check.confidence}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Evidence Level:</span>
                        <span className="ml-2 text-foreground capitalize">{check.evidenceHierarchy}</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{check.reasoning}</p>

                    {check.sources?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <h5 className="text-xs font-medium text-muted-foreground mb-1">Sources ({check.sources.length})</h5>
                        <ul className="text-xs space-y-1">
                          {check.sources.slice(0, 3).map((source, i) => (
                            <li key={i} className="text-muted-foreground">
                              <span className="font-medium">{source.title}</span>
                              {source.credibility && ` (${source.credibility} credibility)`}
                              {source.methodology && ` - ${source.methodology}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* MANIPULATION RISK ASSESSMENT */}
        {/* ============================================ */}
        {manipulationRisk && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Manipulation Risk Assessment
              </CardTitle>
              <CardDescription>
                Overall risk level and breakdown by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{
                    color: manipulationRisk.overallRisk === 'high' ? '#ef4444' :
                           manipulationRisk.overallRisk === 'medium' ? '#f59e0b' : '#22c55e'
                  }}>
                    {manipulationRisk.score}/100
                  </div>
                  <Badge style={{
                    backgroundColor: manipulationRisk.overallRisk === 'high' ? '#ef4444' :
                                    manipulationRisk.overallRisk === 'medium' ? '#f59e0b' : '#22c55e',
                    color: 'white'
                  }}>
                    {manipulationRisk.overallRisk.toUpperCase()} RISK
                  </Badge>
                </div>

                <div className="flex-1 grid grid-cols-5 gap-2">
                  {Object.entries(manipulationRisk.breakdown).map(([category, score]) => (
                    <div key={category} className="text-center">
                      <div className="text-sm font-medium text-foreground">{score}</div>
                      <div className="text-xs text-muted-foreground capitalize">{category}</div>
                    </div>
                  ))}
                </div>
              </div>

              {manipulationRisk.severityDistribution && (
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Severity: <span className="text-red-500">{manipulationRisk.severityDistribution.high} high</span>,{' '}
                    <span className="text-amber-500">{manipulationRisk.severityDistribution.medium} medium</span>,{' '}
                    <span className="text-green-500">{manipulationRisk.severityDistribution.low} low</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* EXTRACTED CLAIMS */}
        {/* ============================================ */}
        {extractedClaims.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Extracted Claims
              </CardTitle>
              <CardDescription>
                All claims identified in the article ({extractedClaims.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {extractedClaims.slice(0, 10).map((claim) => (
                  <div key={claim.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex flex-col gap-1">
                      <Badge
                        className="text-xs w-fit"
                        style={{ backgroundColor: getClaimTypeColor(claim.type), color: 'white' }}
                      >
                        {claim.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs w-fit">
                        {claim.verifiability}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{claim.text}</p>
                      {claim.section && (
                        <p className="text-xs text-muted-foreground mt-1">Section: {claim.section}</p>
                      )}
                    </div>
                  </div>
                ))}
                {extractedClaims.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    + {extractedClaims.length - 10} more claims
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* SOURCES CITED */}
        {/* ============================================ */}
        {sourcesCited.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Sources Cited
              </CardTitle>
              <CardDescription>
                All sources referenced in the article ({sourcesCited.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {sourcesCited.map((source) => (
                  <div key={source.id} className="border border-border p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-foreground text-sm">{source.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{source.type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {source.credibilityIndicators?.isPeerReviewed && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                          Peer Reviewed
                        </Badge>
                      )}
                      {source.credibilityIndicators?.hasFundingDisclosed && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          Funding Disclosed
                        </Badge>
                      )}
                      {source.credibilityIndicators?.isPreprint && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          Preprint
                        </Badge>
                      )}
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Source
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* STATISTICS */}
        {/* ============================================ */}
        {statistics.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Statistics & Data Points
              </CardTitle>
              <CardDescription>
                Numerical claims and data cited ({statistics.length} found)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statistics.map((stat) => (
                  <div key={stat.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{stat.context}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {stat.source && (
                          <span className="text-xs text-muted-foreground">Source: {stat.source}</span>
                        )}
                        {stat.isBaselineProvided ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Baseline Provided</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">No Baseline</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* READER GUIDANCE (Phase 2) */}
        {/* ============================================ */}
        {readerGuidance && (
          <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-background to-muted/10">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Reader Guidance
              </CardTitle>
              <CardDescription>
                Recommendations for forming an informed opinion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="p-4 bg-background rounded-lg border border-border mb-4">
                <p className="text-foreground leading-relaxed">{readerGuidance.summary}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Additional Sources Recommended */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                    <Search className="h-4 w-4 text-primary" />
                    Recommended Additional Sources
                  </h4>
                  <ul className="space-y-1">
                    {readerGuidance.additionalSourcesRecommended.map((source, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        {source}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Key Questions to Research */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                    <Info className="h-4 w-4 text-amber-500" />
                    Key Questions to Research
                  </h4>
                  <ul className="space-y-1">
                    {readerGuidance.keyQuestionsToResearch.map((question, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Wait for Information (if breaking news) */}
              {readerGuidance.waitForInformation && readerGuidance.waitForInformation.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Information to Wait For
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {readerGuidance.waitForInformation.map((info, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {info}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Level */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Analysis Confidence:</span>
                  <Badge
                    style={{
                      backgroundColor: getConfidenceLevelColor(readerGuidance.confidenceLevel),
                      color: 'white'
                    }}
                  >
                    {readerGuidance.confidenceLevel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {readerGuidance.confidenceReasoning}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* ANALYSIS METADATA */}
        {/* ============================================ */}
        <Card className="mb-8 border-border">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Analysis Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Analyzed:</span>
                <span className="ml-2 text-foreground block md:inline">{new Date(analysis.analyzedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-2 text-foreground">{analysis.analysisDuration.toFixed(1)}s</span>
              </div>
              <div>
                <span className="text-muted-foreground">Model:</span>
                <span className="ml-2 text-foreground">{analysis.modelVersion}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Agents Used:</span>
                <span className="ml-2 text-foreground">{analysis.agentsUsed?.length || 7}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* SHARE & ACTIONS */}
        {/* ============================================ */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share & Actions
            </CardTitle>
            <CardDescription>
              Share this analysis or explore more
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Prominent Share Section */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 mb-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Share This Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    {isFromDatabase
                      ? "This analysis is saved and can be shared with anyone"
                      : "Copy the link to share this analysis"
                    }
                  </p>
                </div>
                <Button
                  onClick={handleCopyLink}
                  className="min-w-[140px]"
                  variant={copied ? "secondary" : "default"}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Share Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Other Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="outline" onClick={() => router.push('/analyze')}>
                <FileText className="h-4 w-4 mr-2" />
                Analyze Another
              </Button>
              <Button variant="outline" onClick={() => router.push('/history')}>
                <History className="h-4 w-4 mr-2" />
                View History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
