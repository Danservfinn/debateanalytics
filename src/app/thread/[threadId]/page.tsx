"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Award,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Sparkles,
  Swords,
  TrendingUp,
  CheckCircle,
  Zap,
  RefreshCw
} from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  HeroVerdictCard,
  DebateThreadCard,
  BattleCard,
  MomentumTimeline,
  ParticipantList,
  ClickableClaimCard,
  DebateDetailModal,
  ExecutiveSummary,
  deriveExecutiveSummary,
  AIThinkSection,
  ThreadNarrative,
  type PositionDefinitions
} from "@/components/analysis"
import { staggerContainer, fadeIn } from "@/lib/animations"
import { formatRelativeTime } from "@/lib/utils"
import { saveThread, getStoredThread, removeThread } from "@/lib/storage"
import type { ThreadAnalysisResult, DebateThread } from "@/types/debate"

export default function ThreadDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const threadId = params.threadId as string
  const originalUrl = searchParams.get('url')
  const fromJson = searchParams.get('fromJson') === 'true'

  const [analysis, setAnalysis] = useState<ThreadAnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDebate, setSelectedDebate] = useState<DebateThread | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Derive position definitions from executive summary
  const positionDefinitions = useMemo((): PositionDefinitions | undefined => {
    if (!analysis || analysis.debates.length === 0) return undefined
    const summary = deriveExecutiveSummary(analysis.debates, analysis.title)
    return {
      proDefinition: summary.centralQuestion.proDefinition,
      conDefinition: summary.centralQuestion.conDefinition,
      question: summary.centralQuestion.question
    }
  }, [analysis])

  const handleOpenDebateModal = useCallback((debate: DebateThread) => {
    setSelectedDebate(debate)
    setIsModalOpen(true)
  }, [])

  const handleCloseDebateModal = useCallback(() => {
    setIsModalOpen(false)
    // Delay clearing debate to allow exit animation
    setTimeout(() => setSelectedDebate(null), 300)
  }, [])

  // Refresh analysis - re-analyzes using stored raw data or fetches fresh
  const refreshAnalysis = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      // Get current analysis to check for raw data
      const currentAnalysis = analysis

      // Build URL for analysis
      const urlParam = originalUrl || `https://reddit.com/r/changemyview/comments/${threadId}`

      let response: Response
      let result: { success: boolean; data?: ThreadAnalysisResult; error?: string }

      // If we have raw thread data, use it for re-analysis
      if (currentAnalysis?.rawThreadData) {
        response = await fetch('/api/analyze-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlParam,
            threadData: currentAnalysis.rawThreadData
          })
        })
        result = await response.json()

        // Preserve the raw data in the new analysis
        if (result.success && result.data) {
          result.data.rawThreadData = currentAnalysis.rawThreadData
        }
      } else {
        // No raw data - try fetching from Reddit (may fail with 403)
        response = await fetch(`/api/analyze-thread?url=${encodeURIComponent(urlParam)}`)
        result = await response.json()
      }

      if (result.success && result.data) {
        // Remove old entry and save new one
        removeThread(threadId)
        setAnalysis(result.data)
        saveThread(result.data)
      } else {
        setError(result.error || "Could not refresh analysis. Please try again.")
      }
    } catch (err) {
      console.error('Failed to refresh analysis:', err)
      setError("Failed to refresh analysis. Please try again.")
    }

    setIsRefreshing(false)
  }, [threadId, originalUrl, analysis])

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        // Check sessionStorage first if coming from JSON paste
        if (fromJson) {
          const cacheKey = `thread-analysis-${threadId}`
          const cachedData = sessionStorage.getItem(cacheKey)
          if (cachedData) {
            const parsed = JSON.parse(cachedData) as ThreadAnalysisResult
            setAnalysis(parsed)
            saveThread(parsed) // Persist to localStorage
            setIsLoading(false)
            // Clear from sessionStorage after use
            sessionStorage.removeItem(cacheKey)
            return
          }
        }

        // Check localStorage for previously analyzed thread (PRIORITY)
        const storedThread = getStoredThread(threadId)
        if (storedThread) {
          console.log('Using cached thread from localStorage:', threadId)
          setAnalysis(storedThread)
          setIsLoading(false)
          return
        }

        // Only fetch from API if not cached
        // Build URL for analysis
        const urlParam = originalUrl || `https://reddit.com/r/changemyview/comments/${threadId}`

        const response = await fetch(`/api/analyze-thread?url=${encodeURIComponent(urlParam)}`)
        const result = await response.json()

        if (result.success && result.data) {
          setAnalysis(result.data)
          saveThread(result.data) // Persist to localStorage
        } else {
          setError(result.error || "Could not analyze thread. Please try again.")
        }
      } catch (err) {
        console.error('Failed to load thread:', err)
        setError("Failed to analyze thread. Please try again.")
      }

      setIsLoading(false)
    }

    loadData()
  }, [threadId, originalUrl, fromJson])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <FloatingShapes />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing thread...</p>
            <p className="text-sm text-muted-foreground/60">Detecting debates and scoring arguments</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen">
        <FloatingShapes />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-12 h-12 text-warning" />
            <p className="text-lg font-medium">{error || "Thread not found"}</p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <FloatingShapes />
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </motion.div>

        {/* Thread Metadata */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default">r/{analysis.subreddit}</Badge>
              <span className="text-sm text-muted-foreground">
                Posted by u/{analysis.author}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatRelativeTime(new Date(analysis.createdAt).getTime() / 1000)}
              </span>
              {analysis.topics && analysis.topics.length > 0 && (
                <>
                  <span className="text-muted-foreground">•</span>
                  {analysis.topics.slice(0, 3).map(topic => (
                    <Badge key={topic} variant="neutral" className="text-xs">
                      {topic.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAnalysis}
              disabled={isRefreshing}
              title="Re-analyze this thread"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <a
              href={analysis.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Reddit
              </Button>
            </a>
          </div>
        </motion.section>

        {/* Hero Verdict Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <HeroVerdictCard
            verdict={analysis.verdict}
            debateCount={analysis.debates.length}
            commentCount={analysis.commentCount}
            title={analysis.title}
            debates={analysis.debates}
            centralQuestion={positionDefinitions?.question}
            positionDefinitions={positionDefinitions}
          />
        </motion.section>

        {/* Main Content Tabs */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4 mx-auto">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 mr-1 hidden sm:inline" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="debates" className="text-xs sm:text-sm">
                <Swords className="w-4 h-4 mr-1 hidden sm:inline" />
                Debates ({analysis.debates.length})
              </TabsTrigger>
              <TabsTrigger value="participants" className="text-xs sm:text-sm">
                <Users className="w-4 h-4 mr-1 hidden sm:inline" />
                Participants
              </TabsTrigger>
              <TabsTrigger value="factcheck" className="text-xs sm:text-sm">
                <CheckCircle className="w-4 h-4 mr-1 hidden sm:inline" />
                Fact-Check
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Thread Narrative - Story of the Debate */}
              {analysis.debates.length > 0 && (
                <ThreadNarrative
                  title={analysis.title}
                  verdict={analysis.verdict}
                  debates={analysis.debates}
                  participants={analysis.participants}
                  createdAt={analysis.createdAt}
                  threadUrl={analysis.url}
                />
              )}

              {/* Executive Summary - Primary Analysis */}
              {analysis.debates.length > 0 && (
                <ExecutiveSummary
                  data={deriveExecutiveSummary(analysis.debates, analysis.title)}
                />
              )}

              {/* AI Analysis - What Does AI Think? */}
              {analysis.aiAnalysis && (
                <AIThinkSection analysis={analysis.aiAnalysis} positionDefinitions={positionDefinitions} />
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickStat
                  icon={Swords}
                  label="Debates"
                  value={analysis.debates.length}
                  color="primary"
                />
                <QuickStat
                  icon={MessageSquare}
                  label="Comments"
                  value={analysis.commentCount}
                  color="info"
                />
                <QuickStat
                  icon={Users}
                  label="Participants"
                  value={analysis.participants.length}
                  color="success"
                />
                <QuickStat
                  icon={AlertTriangle}
                  label="Fallacies"
                  value={analysis.fallacies.length}
                  color="warning"
                />
              </div>

              {/* Featured Battle (if debates exist) */}
              {analysis.debates.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Featured Debate
                  </h3>
                  <BattleCard debate={analysis.debates[0]} threadUrl={analysis.url} positionDefinitions={positionDefinitions} />
                </div>
              )}

              {/* Momentum Timeline (if debate has shifts) */}
              {analysis.debates.length > 0 && analysis.debates[0].momentumShifts && analysis.debates[0].momentumShifts.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Debate Momentum
                  </h3>
                  <MomentumTimeline debate={analysis.debates[0]} />
                </div>
              )}

              {/* Top claims preview - clickable for AI verification */}
              {analysis.claims.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    Key Claims
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      Click to verify with AI
                    </span>
                  </h3>
                  <div className="grid gap-3">
                    {analysis.claims.slice(0, 5).map((claim, idx) => (
                      <ClickableClaimCard
                        key={claim.id}
                        claim={claim}
                        index={idx}
                        threadContext={analysis.title}
                        threadId={threadId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Debates Tab */}
            <TabsContent value="debates" className="space-y-6">
              {analysis.debates.length > 0 ? (
                <>
                  {/* Info banner */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      Click any debate card to open full conversation with advanced AI analysis
                    </span>
                  </div>

                  {/* Debate Grid */}
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 md:grid-cols-2"
                  >
                    {analysis.debates.map((debate, idx) => (
                      <DebateThreadCard
                        key={debate.id}
                        debate={debate}
                        index={idx}
                        onClick={() => handleOpenDebateModal(debate)}
                      />
                    ))}
                  </motion.div>
                </>
              ) : (
                <EmptyState
                  icon={Swords}
                  title="No debates detected"
                  description="This thread doesn't contain clear opposing viewpoints"
                />
              )}
            </TabsContent>

            {/* Participants Tab */}
            <TabsContent value="participants" className="space-y-6">
              {analysis.participants.length > 0 ? (
                <ParticipantList
                  participants={analysis.participants}
                  maxDisplay={20}
                  allReplies={analysis.debates.flatMap(d => d.replies)}
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title="No participants found"
                  description="Participant analysis not available for this thread"
                />
              )}
            </TabsContent>

            {/* Fact-Check Tab */}
            <TabsContent value="factcheck" className="space-y-6">
              {/* Claims - with AI verification */}
              {analysis.claims.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Claims ({analysis.claims.length})
                    </h3>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Click any claim to verify with AI
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {analysis.claims.map((claim, idx) => (
                      <ClickableClaimCard
                        key={claim.id}
                        claim={claim}
                        index={idx}
                        threadContext={analysis.title}
                        threadId={threadId}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle}
                  title="No claims detected"
                  description="No verifiable claims were identified in this thread"
                />
              )}

              {/* Fallacies */}
              {analysis.fallacies.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Logical Fallacies ({analysis.fallacies.length})
                  </h3>
                  <div className="grid gap-3">
                    {analysis.fallacies.map((fallacy, idx) => (
                      <FallacyCard key={fallacy.id} fallacy={fallacy} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* AI Verification info */}
              <div className="card-featured p-6 text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary" />
                <h4 className="text-lg font-semibold mb-2">AI-Powered Fact Checking</h4>
                <p className="text-sm text-muted-foreground">
                  Click any claim above to get instant AI verification with sources and evidence analysis.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </motion.section>

        {/* Footer */}
        <footer className="text-center py-8 text-sm text-muted-foreground">
          <p>Debate Analytics - AI-Powered Reddit Analysis</p>
        </footer>
      </main>

      {/* Debate Detail Modal */}
      <DebateDetailModal
        debate={selectedDebate}
        isOpen={isModalOpen}
        onClose={handleCloseDebateModal}
        threadContext={analysis.title}
      />
    </div>
  )
}

// Helper Components

interface QuickStatProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: 'primary' | 'success' | 'warning' | 'info'
}

function QuickStat({ icon: Icon, label, value, color }: QuickStatProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10'
  }

  return (
    <div className="card-premium p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

interface ClaimPreviewCardProps {
  claim: {
    id: string
    text: string
    author: string
    verdict: string
    confidence: number
  }
  index: number
}

function ClaimPreviewCard({ claim, index }: ClaimPreviewCardProps) {
  const verdictConfig: Record<string, { label: string; color: string }> = {
    verified: { label: 'Verified', color: 'badge-strong' },
    disputed: { label: 'Disputed', color: 'badge-fallacy' },
    unverified: { label: 'Unverified', color: 'badge-neutral' }
  }

  const config = verdictConfig[claim.verdict] || verdictConfig.unverified

  return (
    <motion.div
      variants={fadeIn}
      className="card-premium p-4"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{claim.text}</p>
          <p className="text-xs text-muted-foreground mt-1">— u/{claim.author}</p>
        </div>
        <span className={`${config.color} px-2 py-1 rounded-full text-xs font-medium shrink-0`}>
          {config.label}
        </span>
      </div>
    </motion.div>
  )
}

interface FallacyCardProps {
  fallacy: {
    id: string
    type: string
    author: string
    quote: string
    severity: 'low' | 'medium' | 'high'
  }
  index: number
}

function FallacyCard({ fallacy, index }: FallacyCardProps) {
  const severityConfig = {
    low: 'badge-neutral',
    medium: 'badge-fallacy',
    high: 'badge-weak'
  }

  return (
    <motion.div
      variants={fadeIn}
      className="card-premium p-4"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <Badge className="badge-fallacy capitalize">
          {fallacy.type.replace(/_/g, ' ')}
        </Badge>
        <span className={`${severityConfig[fallacy.severity]} px-2 py-0.5 rounded text-xs`}>
          {fallacy.severity} severity
        </span>
      </div>
      <p className="text-sm text-muted-foreground italic">
        &ldquo;{fallacy.quote.slice(0, 200)}
        {fallacy.quote.length > 200 ? '...' : ''}&rdquo;
      </p>
      <p className="text-xs text-muted-foreground mt-2">— u/{fallacy.author}</p>
    </motion.div>
  )
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="card-premium p-12 text-center">
      <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
      <h4 className="text-lg font-medium text-foreground mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
