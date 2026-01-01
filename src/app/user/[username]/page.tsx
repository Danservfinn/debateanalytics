"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, RefreshCw } from "lucide-react"
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
import { loadUserMetrics, fetchUserMetrics, addRecentSearch } from "@/lib/data"
import { hasPaid, clearExpired } from "@/lib/payment-cache"
import { fadeInUp } from "@/lib/animations"
import type { UserMetrics, FallacyBreakdown, SkillDimension } from "@/types/debate"

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [user, setUser] = useState<UserMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

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

  // Load user data function
  const loadUser = useCallback(async () => {
    if (!username) return

    setIsLoading(true)
    setError(null)

    try {
      // Try cached data first
      let userData = await loadUserMetrics(username)

      // If no cached data, fetch from API
      if (!userData) {
        setIsFetching(true)
        userData = await fetchUserMetrics(username)
        setIsFetching(false)
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

    setIsLoading(false)
  }, [username])

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
    try {
      const userData = await fetchUserMetrics(username)
      if (userData) {
        setUser(userData)
      }
    } catch (err) {
      console.error(err)
    }
    setIsFetching(false)
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
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SkeletonUserCard />
            </div>
            <div>
              <SkeletonUserCard />
            </div>
          </div>
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
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="skills">Skills Profile</TabsTrigger>
                  <TabsTrigger value="fallacies">Fallacy Analysis</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="skills">
                  <SkillRadar data={radarData} username={user.username} />
                </TabsContent>

                <TabsContent value="fallacies">
                  <FallacyPie data={fallacyData} title="Fallacy Distribution" />
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
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
