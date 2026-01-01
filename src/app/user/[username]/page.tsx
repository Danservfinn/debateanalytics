"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, RefreshCw, Trophy, AlertTriangle, BookOpen, Sparkles, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { UserScorecard } from "@/components/user/UserScorecard"
import { SkillRadar } from "@/components/charts/SkillRadar"
import { FallacyPie } from "@/components/charts/FallacyPie"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SkeletonUserCard } from "@/components/ui/skeleton"
import { PaymentGate } from "@/components/payment/PaymentGate"
import {
  loadUserMetrics,
  fetchUserMetrics,
  addRecentSearch,
  triggerUserAnalysis,
  checkAnalysisStatus,
  fetchUserProfileFromBackend
} from "@/lib/data"
import { hasPaid, clearExpired } from "@/lib/payment-cache"
import { fadeInUp } from "@/lib/animations"
import type { UserMetrics, FallacyBreakdown, SkillDimension } from "@/types/debate"
import type { BackendUserProfile, AnalysisJobStatus, TopArgument } from "@/types/backend"

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [user, setUser] = useState<UserMetrics | null>(null)
  const [backendProfile, setBackendProfile] = useState<BackendUserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisJobStatus | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Payment gate state
  const [isPaid, setIsPaid] = useState(false)
  const [showPaymentGate, setShowPaymentGate] = useState(true)

  // Check payment status on mount
  useEffect(() => {
    clearExpired()  // Clean up expired payments
    if (username && hasPaid('user', username)) {
      setIsPaid(true)
      setShowPaymentGate(false)
    }
  }, [username])

  // Poll for analysis status
  const pollAnalysisStatus = useCallback(async (): Promise<boolean> => {
    const status = await checkAnalysisStatus(username)
    if (!status) return false

    setAnalysisStatus(status)

    if (status.status === 'completed') {
      setIsAnalyzing(false)
      return true
    } else if (status.status === 'failed') {
      setIsAnalyzing(false)
      setError(status.error || 'Analysis failed. Please try again.')
      return false
    }

    return false
  }, [username])

  // Load user data function
  const loadUser = useCallback(async () => {
    if (!username) return

    setIsLoading(true)
    setError(null)
    setAnalysisStatus(null)

    try {
      // First, try to get profile from Railway backend
      const profile = await fetchUserProfileFromBackend(username)
      setBackendProfile(profile)

      if (profile && profile.analysis_available) {
        // Have cached analysis - transform to frontend format
        const userData = await fetchUserMetrics(username)
        if (userData) {
          setUser(userData)
          addRecentSearch(username)
        }
        setIsLoading(false)
        return
      }

      // No analysis available - trigger one
      setIsAnalyzing(true)
      setIsFetching(true)

      const jobStatus = await triggerUserAnalysis(username)
      setAnalysisStatus(jobStatus)

      if (jobStatus?.status === 'pending' || jobStatus?.status === 'in_progress') {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          const completed = await pollAnalysisStatus()
          if (completed) {
            clearInterval(pollInterval)
            // Fetch the completed profile
            const userData = await fetchUserMetrics(username)
            if (userData) {
              setUser(userData)
              addRecentSearch(username)
            }
            setIsFetching(false)
            setIsLoading(false)
          }
        }, 3000) // Poll every 3 seconds

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval)
          if (isAnalyzing) {
            setError('Analysis is taking longer than expected. Please try again later.')
            setIsAnalyzing(false)
            setIsFetching(false)
            setIsLoading(false)
          }
        }, 300000)

        return
      }

      // Try local cached data as fallback
      let userData = await loadUserMetrics(username)
      if (!userData) {
        userData = await fetchUserMetrics(username)
      }

      if (userData) {
        setUser(userData)
        addRecentSearch(username)
      } else {
        setError('User not found or no comment history available.')
      }
    } catch (err) {
      setError('Failed to load user data. Please try again.')
      console.error(err)
    }

    setIsFetching(false)
    setIsLoading(false)
    setIsAnalyzing(false)
  }, [username, pollAnalysisStatus])

  // Only load user data after payment is confirmed
  useEffect(() => {
    if (isPaid && !showPaymentGate) {
      loadUser()
    }
  }, [isPaid, showPaymentGate, loadUser])

  // Handle successful payment
  const handlePaymentComplete = useCallback(() => {
    setIsPaid(true)
    setShowPaymentGate(false)
  }, [])

  // Handle payment cancel
  const handlePaymentCancel = useCallback(() => {
    router.push('/')
  }, [router])

  const handleRefresh = async () => {
    setIsFetching(true)
    setIsAnalyzing(true)
    setAnalysisStatus(null)
    try {
      // Trigger fresh analysis
      const jobStatus = await triggerUserAnalysis(username, true)
      setAnalysisStatus(jobStatus)

      if (jobStatus?.status === 'pending' || jobStatus?.status === 'in_progress') {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          const completed = await pollAnalysisStatus()
          if (completed) {
            clearInterval(pollInterval)
            const userData = await fetchUserMetrics(username)
            if (userData) {
              setUser(userData)
            }
            setIsFetching(false)
            setIsAnalyzing(false)
          }
        }, 3000)

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval)
          setIsFetching(false)
          setIsAnalyzing(false)
        }, 300000)
      } else {
        const userData = await fetchUserMetrics(username)
        if (userData) {
          setUser(userData)
        }
        setIsFetching(false)
        setIsAnalyzing(false)
      }
    } catch (err) {
      console.error(err)
      setIsFetching(false)
      setIsAnalyzing(false)
    }
  }

  // Generate radar data from user metrics
  const radarData: SkillDimension[] = user ? [
    { skill: 'Evidence', value: Math.min(100, (user.argumentMetrics.evidenceCited / user.totalComments) * 200), fullMark: 100 },
    { skill: 'Quality', value: user.qualityScore * 10, fullMark: 100 },
    { skill: 'Logic', value: Math.min(100, (user.argumentMetrics.strongArguments / Math.max(1, user.argumentMetrics.strongArguments + user.argumentMetrics.weakArguments)) * 100), fullMark: 100 },
    { skill: 'Fallacy Avoidance', value: Math.max(0, 100 - user.fallacyProfile.fallacyRate * 5), fullMark: 100 },
    { skill: 'Engagement', value: Math.min(100, user.avgKarma * 10), fullMark: 100 },
    { skill: 'Depth', value: Math.min(100, (user.argumentMetrics.avgArgumentLength / 300) * 100), fullMark: 100 },
  ] : []

  // Convert fallacy profile to chart data
  const fallacyData: FallacyBreakdown[] = user?.fallacyProfile.fallacyTypes.map(f => ({
    type: f.type,
    count: f.count,
    percentage: (f.count / Math.max(1, user.fallacyProfile.totalFallacies)) * 100
  })) || []

  // Show payment gate if not paid
  if (showPaymentGate && !isPaid) {
    return (
      <PaymentGate
        analysisType="user"
        targetId={username}
        isModal={false}
        onPaymentComplete={handlePaymentComplete}
        onCancel={handlePaymentCancel}
      />
    )
  }

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
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-heading font-bold">
              u/{username}
            </h1>
            <p className="text-muted-foreground mt-1">
              Reddit debate analysis and statistics
            </p>
          </div>
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            {isAnalyzing && analysisStatus ? (
              <Card variant="premium" className="text-center py-12">
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Analyzing u/{username}</h3>
                    <p className="text-muted-foreground">
                      {analysisStatus.progress?.stage === 'fetching_data' && 'Fetching Reddit comment history...'}
                      {analysisStatus.progress?.stage === 'building_threads' && 'Building debate threads...'}
                      {analysisStatus.progress?.stage === 'identifying_debates' && 'Identifying debates with AI...'}
                      {analysisStatus.progress?.stage === 'analyzing_arguments' && 'Analyzing argument quality...'}
                      {analysisStatus.progress?.stage === 'synthesizing_profile' && 'Synthesizing comprehensive profile...'}
                      {analysisStatus.progress?.stage === 'caching_results' && 'Saving results...'}
                      {analysisStatus.progress?.stage === 'queued' && 'Analysis queued, starting soon...'}
                      {!analysisStatus.progress?.stage && 'Processing...'}
                    </p>
                  </div>
                  {analysisStatus.progress?.percent !== undefined && (
                    <div className="w-full max-w-md mx-auto">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${analysisStatus.progress.percent}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {analysisStatus.progress.percent}% complete
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <SkeletonUserCard />
                </div>
                <div>
                  <SkeletonUserCard />
                </div>
              </div>
            )}
          </motion.div>
        ) : error ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <Card variant="premium" className="text-center py-12">
              <CardContent>
                <p className="text-lg text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : user ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <UserScorecard user={user} />

              <Tabs defaultValue="skills" className="w-full">
                <TabsList className="w-full justify-start flex-wrap">
                  <TabsTrigger value="skills">Skills Profile</TabsTrigger>
                  {backendProfile?.top_arguments?.length ? <TabsTrigger value="top-arguments">Top Arguments</TabsTrigger> : null}
                  <TabsTrigger value="fallacies">Fallacy Analysis</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  {backendProfile?.archetype && <TabsTrigger value="personality">Personality</TabsTrigger>}
                </TabsList>

                <TabsContent value="skills">
                  <SkillRadar data={radarData} username={user.username} />
                </TabsContent>

                {/* Top Arguments Tab */}
                {backendProfile?.top_arguments?.length ? (
                  <TabsContent value="top-arguments">
                    <Card variant="premium">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          Top Arguments
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {backendProfile.top_arguments.map((arg, index) => (
                          <TopArgumentCard key={index} argument={arg} rank={index + 1} />
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ) : null}

                <TabsContent value="fallacies">
                  <div className="space-y-4">
                    <FallacyPie data={fallacyData} title="Fallacy Distribution" />

                    {/* Detailed Fallacy Instances */}
                    {backendProfile?.fallacy_profile?.ranked_fallacies?.length ? (
                      <Card variant="premium">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            Fallacy Instances
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {backendProfile.fallacy_profile.ranked_fallacies.slice(0, 5).map((fallacy, index) => (
                            <div key={index} className="border-b border-border pb-4 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="warning">{fallacy.type}</Badge>
                                  <span className="text-sm text-muted-foreground">{fallacy.count} occurrences</span>
                                </div>
                              </div>
                              {fallacy.instances?.slice(0, 2).map((instance, i) => (
                                <div key={i} className="pl-4 mt-2 border-l-2 border-muted">
                                  <p className="text-sm italic text-muted-foreground mb-1">"{instance.quote}"</p>
                                  <p className="text-xs text-muted-foreground">{instance.explanation}</p>
                                  <Badge
                                    variant={instance.severity === 'major' ? 'danger' : instance.severity === 'moderate' ? 'warning' : 'neutral'}
                                    className="mt-1"
                                  >
                                    {instance.severity}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ))}

                          {backendProfile.fallacy_profile.patterns?.length > 0 && (
                            <div className="pt-4 border-t border-border">
                              <p className="text-sm text-muted-foreground mb-2">Common Patterns</p>
                              <div className="flex flex-wrap gap-2">
                                {backendProfile.fallacy_profile.patterns.map((pattern, i) => (
                                  <Badge key={i} variant="neutral">{pattern}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="activity">
                  <Card variant="premium">
                    <CardHeader>
                      <CardTitle className="text-lg">Activity Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-secondary/50">
                          <p className="text-sm text-muted-foreground">Most Active Day</p>
                          <p className="text-xl font-semibold">{user.activityPatterns.mostActiveDay}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/50">
                          <p className="text-sm text-muted-foreground">Peak Hour</p>
                          <p className="text-xl font-semibold">{user.activityPatterns.mostActiveHour}:00</p>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/50">
                          <p className="text-sm text-muted-foreground">Avg Comments/Day</p>
                          <p className="text-xl font-semibold">{user.activityPatterns.avgCommentsPerDay.toFixed(1)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/50">
                          <p className="text-sm text-muted-foreground">Account Activity</p>
                          <p className="text-xl font-semibold">{user.activityPatterns.accountAgeDays} days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {backendProfile?.archetype && (
                  <TabsContent value="personality">
                    <div className="space-y-4">
                      {/* Archetype Card */}
                      <Card variant="premium">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            Debate Archetype
                            <Badge variant="success">{backendProfile.archetype.primary}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {backendProfile.archetype.secondary && (
                            <div>
                              <p className="text-sm text-muted-foreground">Secondary Archetype</p>
                              <p className="font-medium">{backendProfile.archetype.secondary}</p>
                            </div>
                          )}
                          {backendProfile.archetype.blend && (
                            <div>
                              <p className="text-sm text-muted-foreground">Blend Style</p>
                              <p className="font-medium">{backendProfile.archetype.blend}</p>
                            </div>
                          )}
                          {backendProfile.archetype.signature_moves?.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Signature Moves</p>
                              <div className="flex flex-wrap gap-2">
                                {backendProfile.archetype.signature_moves.map((move, i) => (
                                  <Badge key={i} variant="neutral">{move}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {backendProfile.archetype.blindspots?.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Blindspots</p>
                              <div className="flex flex-wrap gap-2">
                                {backendProfile.archetype.blindspots.map((spot, i) => (
                                  <Badge key={i} variant="warning">{spot}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* MBTI Card */}
                      {backendProfile.mbti && (
                        <Card variant="premium">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              MBTI Profile
                              <Badge variant="success" className="text-lg px-3">{backendProfile.mbti.type}</Badge>
                              <span className="text-sm text-muted-foreground">
                                ({Math.round(backendProfile.mbti.confidence * 100)}% confidence)
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {backendProfile.mbti.debate_implications?.length > 0 && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Debate Implications</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {backendProfile.mbti.debate_implications.map((impl, i) => (
                                    <li key={i} className="text-sm">{impl}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Good Faith Card */}
                      {backendProfile.good_faith && (
                        <Card variant="premium">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              Good Faith Assessment
                              <Badge
                                variant={backendProfile.good_faith.score >= 70 ? 'success' : backendProfile.good_faith.score >= 40 ? 'warning' : 'danger'}
                              >
                                {backendProfile.good_faith.score}/100
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm">{backendProfile.good_faith.assessment}</p>
                            {backendProfile.good_faith.positive_indicators?.length > 0 && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Positive Indicators</p>
                                <div className="flex flex-wrap gap-2">
                                  {backendProfile.good_faith.positive_indicators.map((ind, i) => (
                                    <Badge key={i} variant="success">{ind}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {backendProfile.good_faith.negative_indicators?.length > 0 && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Areas for Improvement</p>
                                <div className="flex flex-wrap gap-2">
                                  {backendProfile.good_faith.negative_indicators.map((ind, i) => (
                                    <Badge key={i} variant="warning">{ind}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card variant="premium">
                <CardHeader>
                  <CardTitle className="text-lg">Top Subreddits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {user.topSubreddits.slice(0, 7).map((sub, i) => (
                    <motion.div
                      key={sub.subreddit}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">r/{sub.subreddit}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.commentCount} comments
                        </p>
                      </div>
                      <Badge variant={sub.avgKarma >= 5 ? 'success' : 'neutral'}>
                        {sub.avgKarma.toFixed(1)} avg
                      </Badge>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              <Card variant="premium">
                <CardHeader>
                  <CardTitle className="text-lg">Argument Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Strong</span>
                      <span className="text-sm font-medium text-success">
                        {user.argumentMetrics.strongArguments}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all"
                        style={{
                          width: `${(user.argumentMetrics.strongArguments / Math.max(1, user.totalComments)) * 100}%`
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Moderate</span>
                      <span className="text-sm font-medium text-warning">
                        {user.argumentMetrics.moderateArguments}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warning transition-all"
                        style={{
                          width: `${(user.argumentMetrics.moderateArguments / Math.max(1, user.totalComments)) * 100}%`
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Weak</span>
                      <span className="text-sm font-medium text-danger">
                        {user.argumentMetrics.weakArguments}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-danger transition-all"
                        style={{
                          width: `${(user.argumentMetrics.weakArguments / Math.max(1, user.totalComments)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Topic Expertise */}
              {backendProfile?.topic_expertise?.length ? (
                <Card variant="premium">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Topic Expertise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {backendProfile.topic_expertise.slice(0, 5).map((topic, i) => (
                      <motion.div
                        key={topic.topic}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{topic.topic}</p>
                          <Badge variant={topic.expertise_level >= 75 ? 'success' : topic.expertise_level >= 50 ? 'neutral' : 'warning'}>
                            {topic.expertise_level}%
                          </Badge>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${topic.expertise_level}%` }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {topic.evidence_count} evidence points • {Math.round(topic.confidence * 100)}% confidence
                        </p>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              {/* Signature Techniques */}
              {backendProfile?.signature_techniques?.length ? (
                <Card variant="premium">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Signature Techniques
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {backendProfile.signature_techniques.slice(0, 5).map((tech, i) => (
                      <motion.div
                        key={tech.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-3 rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{tech.name}</p>
                          <Badge
                            variant={tech.frequency === 'high' ? 'success' : tech.frequency === 'moderate' ? 'neutral' : 'warning'}
                          >
                            {tech.frequency}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{tech.category}</p>
                        <p className="text-xs">{tech.effectiveness}</p>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

// Top Argument Card Component
function TopArgumentCard({ argument, rank }: { argument: TopArgument; rank: number }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      className="border border-border rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">#{rank}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="neutral">{argument.category}</Badge>
              {argument.context?.subreddit && (
                <span className="text-xs text-muted-foreground">r/{argument.context.subreddit}</span>
              )}
            </div>
            <h4 className="font-medium text-sm line-clamp-2">{argument.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{argument.snippet}</p>
          </div>
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 space-y-4 border-t border-border"
        >
          {/* Quality Breakdown */}
          {argument.quality_breakdown && (
            <div className="pt-4">
              <p className="text-sm font-medium mb-2">Quality Scores</p>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(argument.quality_breakdown).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="text-lg font-bold text-primary">{value}</div>
                    <div className="text-xs text-muted-foreground capitalize">{key}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Why Exceptional */}
          {argument.why_exceptional && (
            <div>
              <p className="text-sm font-medium mb-1">Why This Stands Out</p>
              <p className="text-sm text-muted-foreground">{argument.why_exceptional}</p>
            </div>
          )}

          {/* Techniques Used */}
          {argument.techniques_used?.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Techniques Used</p>
              <div className="flex flex-wrap gap-1">
                {argument.techniques_used.map((tech, i) => (
                  <Badge key={i} variant="success">{tech}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Context */}
          {argument.context && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Thread:</span> {argument.context.thread_title}
              </p>
              {argument.context.opponent_position && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Opposing:</span> {argument.context.opponent_position}
                </p>
              )}
              {argument.context.outcome && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Outcome:</span> {argument.context.outcome}
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
