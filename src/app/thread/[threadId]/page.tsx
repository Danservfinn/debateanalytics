"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Award,
  AlertTriangle,
  Clock,
  ExternalLink,
  ThumbsUp,
  Loader2,
  Sparkles,
  Brain,
  CheckCircle,
  Gem,
  Shield
} from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { FallacyPie } from "@/components/charts/FallacyPie"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  VerdictCard,
  ClaimMatrix,
  RhetoricalRadar,
  HiddenGems,
  ManipulationAlerts
} from "@/components/analysis"
import { fetchThreadAnalysis, loadThread } from "@/lib/data"
import { staggerContainer, fadeIn } from "@/lib/animations"
import { formatNumber, formatRelativeTime } from "@/lib/utils"
import type { ThreadAnalysis, ParticipantSummary } from "@/types/debate"
import type { DeepAnalysis } from "@/types/analysis"

function ParticipantCard({ participant, rank }: { participant: ParticipantSummary; rank: number }) {
  return (
    <motion.div
      variants={fadeIn}
      className="p-4 rounded-lg bg-card/50 border border-border/50 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-muted-foreground">#{rank}</span>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/user/${participant.username}`}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                u/{participant.username}
              </Link>
              {participant.isOp && (
                <Badge variant="info" className="text-xs">OP</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {participant.commentCount} comment{participant.commentCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-success font-medium">{participant.strongArguments}</p>
            <p className="text-xs text-muted-foreground">Strong</p>
          </div>
          <div className="text-center">
            <p className="text-danger font-medium">{participant.weakArguments}</p>
            <p className="text-xs text-muted-foreground">Weak</p>
          </div>
          <div className="text-center">
            <p className="text-warning font-medium">{participant.fallacies}</p>
            <p className="text-xs text-muted-foreground">Fallacies</p>
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">+{participant.totalScore}</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const ANALYSIS_STAGES = [
  { label: "Extracting claims", icon: CheckCircle },
  { label: "Mapping arguments", icon: MessageSquare },
  { label: "Detecting fallacies", icon: AlertTriangle },
  { label: "Profiling rhetoric", icon: Brain },
  { label: "Finding hidden gems", icon: Gem },
  { label: "Checking manipulation", icon: Shield },
  { label: "Synthesizing verdict", icon: Sparkles }
]

export default function ThreadDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const threadId = params.threadId as string
  const originalUrl = searchParams.get('url')

  const [thread, setThread] = useState<ThreadAnalysis | null>(null)
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeepLoading, setIsDeepLoading] = useState(false)
  const [deepProgress, setDeepProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        let data = await loadThread(threadId)
        if (!data && originalUrl) {
          data = await fetchThreadAnalysis(originalUrl)
        }

        if (data) {
          setThread(data)
        } else {
          setError("Could not load thread data. Please try again.")
        }
      } catch (err) {
        console.error('Failed to load thread:', err)
        setError("Failed to analyze thread. Please try again.")
      }

      setIsLoading(false)
    }

    loadData()
  }, [threadId, originalUrl])

  const runDeepAnalysis = async () => {
    if (!originalUrl) return

    setIsDeepLoading(true)
    setDeepProgress(0)
    setCurrentStage(0)

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setDeepProgress(prev => {
        const next = prev + Math.random() * 8
        return next > 90 ? 90 : next
      })
      setCurrentStage(prev => {
        const next = prev + 1
        return next >= ANALYSIS_STAGES.length ? ANALYSIS_STAGES.length - 1 : next
      })
    }, 3000)

    try {
      const response = await fetch('/api/analyze-thread-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalUrl })
      })

      const result = await response.json()

      if (result.success && result.data) {
        setDeepAnalysis(result.data)
        setDeepProgress(100)
      } else {
        console.error('Deep analysis failed:', result.error)
      }
    } catch (err) {
      console.error('Deep analysis error:', err)
    } finally {
      clearInterval(progressInterval)
      setIsDeepLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <FloatingShapes />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing thread...</p>
            <p className="text-sm text-muted-foreground/60">This may take a moment</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !thread) {
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

  const { metadata, statistics, fallacyBreakdown, participants } = thread

  return (
    <div className="min-h-screen">
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

        {/* Thread Header */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default">r/{metadata.subreddit}</Badge>
                <span className="text-sm text-muted-foreground">
                  Posted by u/{metadata.author}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(metadata.createdUtc)}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                {metadata.title}
              </h1>
              {metadata.selftext && (
                <p className="text-muted-foreground line-clamp-3 max-w-3xl">
                  {metadata.selftext.slice(0, 300)}
                  {metadata.selftext.length > 300 && '...'}
                </p>
              )}
            </div>
            <a
              href={metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Reddit
              </Button>
            </a>
          </div>
        </motion.section>

        {/* Stats Overview */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <MetricCard
            title="Comments"
            value={statistics.totalComments}
            icon={MessageSquare}
            variant="primary"
            delay={0}
          />
          <MetricCard
            title="Participants"
            value={statistics.uniqueAuthors}
            icon={Users}
            variant="default"
            delay={0.1}
          />
          <MetricCard
            title="Strong Arguments"
            value={statistics.strongArguments}
            icon={Award}
            variant="success"
            delay={0.2}
          />
          <MetricCard
            title="Fallacies"
            value={statistics.totalFallacies}
            icon={AlertTriangle}
            variant="warning"
            delay={0.3}
          />
        </motion.section>

        {/* Deep Analysis Section */}
        {!deepAnalysis && !isDeepLoading && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card variant="premium" className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30">
              <CardContent className="py-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/20">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Run Deep Analysis</h3>
                      <p className="text-muted-foreground text-sm">
                        Use AI to extract claims, detect manipulation, profile debaters, and find hidden gems
                      </p>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    onClick={runDeepAnalysis}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze with GLM-4
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* Deep Analysis Loading */}
        {isDeepLoading && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card variant="premium">
              <CardContent className="py-8">
                <div className="text-center space-y-6">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Deep Analysis in Progress</h3>
                  </div>

                  <Progress value={deepProgress} className="h-3 max-w-md mx-auto" />

                  <div className="flex flex-wrap justify-center gap-2">
                    {ANALYSIS_STAGES.map((stage, i) => {
                      const Icon = stage.icon
                      const isComplete = i < currentStage
                      const isCurrent = i === currentStage
                      return (
                        <div
                          key={stage.label}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                            isComplete
                              ? 'bg-success/20 text-success'
                              : isCurrent
                              ? 'bg-primary/20 text-primary animate-pulse'
                              : 'bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {stage.label}
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    This may take 1-2 minutes for thorough analysis...
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* Deep Analysis Results */}
        {deepAnalysis && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Verdict Card - The "Wow" Factor */}
            <VerdictCard verdict={deepAnalysis.verdict} />

            {/* Tabbed Deep Analysis */}
            <Tabs defaultValue="claims" className="space-y-6">
              <TabsList className="grid w-full max-w-2xl grid-cols-5 mx-auto">
                <TabsTrigger value="claims" className="text-xs sm:text-sm">
                  <CheckCircle className="w-4 h-4 mr-1 hidden sm:inline" />
                  Claims
                </TabsTrigger>
                <TabsTrigger value="rhetoric" className="text-xs sm:text-sm">
                  <Brain className="w-4 h-4 mr-1 hidden sm:inline" />
                  Rhetoric
                </TabsTrigger>
                <TabsTrigger value="fallacies" className="text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 mr-1 hidden sm:inline" />
                  Fallacies
                </TabsTrigger>
                <TabsTrigger value="gems" className="text-xs sm:text-sm">
                  <Gem className="w-4 h-4 mr-1 hidden sm:inline" />
                  Gems
                </TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs sm:text-sm">
                  <Shield className="w-4 h-4 mr-1 hidden sm:inline" />
                  Alerts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="claims">
                <ClaimMatrix claims={deepAnalysis.claims} />
              </TabsContent>

              <TabsContent value="rhetoric">
                <RhetoricalRadar profiles={deepAnalysis.rhetoricalProfiles} />
              </TabsContent>

              <TabsContent value="fallacies">
                <div className="grid md:grid-cols-2 gap-6">
                  <FallacyPie data={fallacyBreakdown} />
                  <Card variant="premium">
                    <CardHeader>
                      <CardTitle className="text-lg">Fallacy Instances</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {deepAnalysis.fallacies.length > 0 ? (
                        <div className="space-y-3 max-h-[350px] overflow-y-auto">
                          {deepAnalysis.fallacies.map((f, i) => (
                            <div
                              key={f.id || i}
                              className="p-3 rounded-lg bg-background/50 border border-border/50"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="warning" className="capitalize">
                                  {f.type.replace(/_/g, ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  u/{f.author}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {f.description}
                              </p>
                              <p className="text-xs italic text-foreground/70">
                                &ldquo;{f.quote.slice(0, 100)}...&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Award className="w-12 h-12 mx-auto mb-4 text-success/50" />
                          <p className="text-muted-foreground">
                            No logical fallacies detected
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="gems">
                <HiddenGems gems={deepAnalysis.hiddenGems} />
              </TabsContent>

              <TabsContent value="alerts">
                <ManipulationAlerts alerts={deepAnalysis.manipulationAlerts} />
              </TabsContent>
            </Tabs>
          </motion.section>
        )}

        {/* Basic Analysis (shown when no deep analysis) */}
        {!deepAnalysis && (
          <>
            {/* Secondary Stats */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <ThumbsUp className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Thread Score</p>
                    <p className="text-xl font-bold">{formatNumber(metadata.score)}</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Upvote Ratio</p>
                    <p className="text-xl font-bold">{Math.round(metadata.upvoteRatio * 100)}%</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-info" />
                  <div>
                    <p className="text-sm text-muted-foreground">OP Replies</p>
                    <p className="text-xl font-bold">{statistics.opReplies}</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Quality</p>
                    <p className="text-xl font-bold">{statistics.avgArgumentQuality.toFixed(1)}/10</p>
                  </div>
                </div>
              </Card>
            </motion.section>

            {/* Basic Tabs Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Tabs defaultValue="participants" className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="participants" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Participants
                  </TabsTrigger>
                  <TabsTrigger value="fallacies" className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Fallacies
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="participants" className="space-y-4">
                  {participants.length > 0 ? (
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      className="space-y-3"
                    >
                      {participants
                        .sort((a, b) => b.strongArguments - a.strongArguments)
                        .slice(0, 10)
                        .map((participant, i) => (
                          <ParticipantCard
                            key={participant.username}
                            participant={participant}
                            rank={i + 1}
                          />
                        ))}
                    </motion.div>
                  ) : (
                    <Card variant="glass" className="p-8 text-center">
                      <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">
                        Participant analysis not yet available
                      </p>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="fallacies" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FallacyPie data={fallacyBreakdown} />
                    <Card variant="premium">
                      <CardHeader>
                        <CardTitle className="text-lg">Fallacy Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {fallacyBreakdown.length > 0 ? (
                          <div className="space-y-3">
                            {fallacyBreakdown.map((fallacy) => (
                              <div
                                key={fallacy.type}
                                className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                              >
                                <span className="font-medium capitalize">
                                  {fallacy.type.replace(/_/g, ' ')}
                                </span>
                                <div className="flex items-center gap-3">
                                  <Badge variant="warning">{fallacy.count}</Badge>
                                  <span className="text-sm text-muted-foreground w-12 text-right">
                                    {fallacy.percentage.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Award className="w-12 h-12 mx-auto mb-4 text-success/50" />
                            <p className="text-muted-foreground">
                              No logical fallacies detected
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.section>
          </>
        )}

        {/* Footer */}
        <footer className="text-center py-8 text-sm text-muted-foreground">
          <p>Debate Analytics - AI-Powered Reddit Analysis</p>
          {deepAnalysis && (
            <p className="text-xs mt-1">
              Deep analysis powered by GLM-4
            </p>
          )}
        </footer>
      </main>
    </div>
  )
}
