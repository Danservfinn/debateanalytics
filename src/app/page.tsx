"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { MessageSquare, Users, Award, AlertTriangle, Link2, User } from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { UserSearch } from "@/components/dashboard/UserSearch"
import { ThreadSearch } from "@/components/dashboard/ThreadSearch"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { ThreadCard } from "@/components/dashboard/ThreadCard"
import { SkeletonMetricCard, SkeletonThreadCard } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loadManifest, loadAllThreads } from "@/lib/data"
import { getStoredThreads, getStoredStats } from "@/lib/storage"
import { staggerContainer } from "@/lib/animations"
import type { ThreadAnalysis, GlobalStats, ThreadAnalysisResult } from "@/types/debate"

export default function Dashboard() {
  const [threads, setThreads] = useState<ThreadAnalysisResult[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        // Load from localStorage first (persisted analyses)
        const storedThreads = getStoredThreads()
        const storedStats = getStoredStats()

        // Also try to load from remote manifest (if configured)
        const manifest = await loadManifest()
        const remoteThreads = await loadAllThreads()

        // Combine: stored threads take priority, then remote
        const allThreads = [...storedThreads]
        remoteThreads.forEach(rt => {
          if (!allThreads.find(t => t.threadId === rt.metadata?.id)) {
            // Convert ThreadAnalysis to ThreadAnalysisResult format if needed
            allThreads.push({
              threadId: rt.metadata.id,
              subreddit: rt.metadata.subreddit,
              title: rt.metadata.title,
              author: rt.metadata.author,
              commentCount: rt.metadata.numComments,
              createdAt: new Date(rt.metadata.createdUtc * 1000).toISOString(),
              url: rt.metadata.url,
              verdict: {
                overallScore: rt.statistics.avgArgumentQuality || 5,
                summary: '',
                evidenceQualityPct: 50,
                civilityScore: 7,
                worthReading: true
              },
              debates: [],
              participants: [],
              claims: [],
              fallacies: []
            })
          }
        })

        setThreads(allThreads)

        // Merge stats
        setStats({
          totalThreads: storedStats.totalThreads + (manifest?.globalStats?.totalThreads || 0),
          totalUsers: storedStats.totalUsers + (manifest?.globalStats?.totalUsers || 0),
          avgQualityScore: manifest?.globalStats?.avgQualityScore || 5,
          totalArguments: storedStats.totalArguments + (manifest?.globalStats?.totalArguments || 0),
          totalFallacies: storedStats.totalFallacies + (manifest?.globalStats?.totalFallacies || 0)
        })
      } catch (error) {
        console.error('Failed to load data:', error)
        // Fall back to localStorage only
        const storedThreads = getStoredThreads()
        const storedStats = getStoredStats()
        setThreads(storedThreads)
        setStats({
          totalThreads: storedStats.totalThreads,
          totalUsers: storedStats.totalUsers,
          avgQualityScore: 5,
          totalArguments: storedStats.totalArguments,
          totalFallacies: storedStats.totalFallacies
        })
      }
      setIsLoading(false)
    }
    loadData()
  }, [])

  return (
    <div className="min-h-screen">
      <FloatingShapes />
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-12 space-y-4"
        >
          <h1 className="text-4xl md:text-5xl font-heading font-bold">
            Reddit{" "}
            <span className="text-primary text-glow">Debate Analytics</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI-powered analysis of Reddit debates. Track argument quality,
            detect logical fallacies, and compare debaters across threads.
          </p>
        </motion.section>

        {/* Search Section with Tabs */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="py-4"
        >
          <Tabs defaultValue="thread" className="w-full max-w-2xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="thread" className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Analyze Thread
              </TabsTrigger>
              <TabsTrigger value="user" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Analyze User
              </TabsTrigger>
            </TabsList>
            <TabsContent value="thread">
              <ThreadSearch />
            </TabsContent>
            <TabsContent value="user">
              <UserSearch />
            </TabsContent>
          </Tabs>
        </motion.section>

        {/* Stats Overview */}
        <section className="space-y-4">
          <h2 className="text-xl font-heading font-semibold">Overview</h2>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {isLoading ? (
              <>
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
              </>
            ) : (
              <>
                <MetricCard
                  title="Threads Analyzed"
                  value={stats?.totalThreads || threads.length || 0}
                  icon={MessageSquare}
                  variant="primary"
                  delay={0}
                />
                <MetricCard
                  title="Unique Debaters"
                  value={stats?.totalUsers || 0}
                  icon={Users}
                  variant="default"
                  delay={0.1}
                />
                <MetricCard
                  title="Strong Arguments"
                  value={stats?.totalArguments || 0}
                  icon={Award}
                  variant="success"
                  delay={0.2}
                />
                <MetricCard
                  title="Fallacies Detected"
                  value={stats?.totalFallacies || 0}
                  icon={AlertTriangle}
                  variant="warning"
                  delay={0.3}
                />
              </>
            )}
          </motion.div>
        </section>

        {/* Threads Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-heading font-semibold">Recent Threads</h2>
            <span className="text-sm text-muted-foreground">
              {threads.length} threads
            </span>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {isLoading ? (
              <>
                <SkeletonThreadCard />
                <SkeletonThreadCard />
                <SkeletonThreadCard />
                <SkeletonThreadCard />
                <SkeletonThreadCard />
                <SkeletonThreadCard />
              </>
            ) : threads.length > 0 ? (
              threads.map((thread, i) => (
                <ThreadCard key={thread.threadId} thread={thread} index={i} />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No threads analyzed yet.</p>
                <p className="text-sm mt-2">
                  Paste a Reddit thread URL above to get started!
                </p>
              </div>
            )}
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 text-sm text-muted-foreground">
          <p>Debate Analytics - AI-Powered Reddit Analysis</p>
        </footer>
      </main>
    </div>
  )
}
