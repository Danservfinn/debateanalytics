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
  Loader2
} from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { FallacyPie } from "@/components/charts/FallacyPie"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { SkeletonMetricCard } from "@/components/ui/skeleton"
import { fetchThreadAnalysis, loadThread } from "@/lib/data"
import { staggerContainer, fadeIn } from "@/lib/animations"
import { formatNumber, formatRelativeTime } from "@/lib/utils"
import type { ThreadAnalysis, ParticipantSummary } from "@/types/debate"

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

export default function ThreadDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const threadId = params.threadId as string
  const originalUrl = searchParams.get('url')

  const [thread, setThread] = useState<ThreadAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        // First try to load from cache
        let data = await loadThread(threadId)

        // If not cached and we have a URL, fetch from API
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

        {/* Tabs Section */}
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

        {/* Footer */}
        <footer className="text-center py-8 text-sm text-muted-foreground">
          <p>Debate Analytics - AI-Powered Reddit Analysis</p>
        </footer>
      </main>
    </div>
  )
}
