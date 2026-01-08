/**
 * User Dashboard
 * Shows credits balance, analysis history, subscription status
 */

'use client'

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface DashboardData {
  credits: {
    balance: number
    lifetimeCredits: number
    lifetimeSpent: number
  }
  subscription: {
    status: string
    tierId: string
    analysesPerMonth: number
    analysesUsedThisMonth: number
  } | null
  recentAnalyses: Array<{
    id: string
    truthScore: number
    credibility: string
    articleTitle: string
    analyzedAt: string
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    } else if (status === "authenticated") {
      fetchDashboardData()
    }
  }, [status, router])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/dashboard")
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome back, {session?.user?.name}
            </h1>
            <p className="text-muted-foreground text-lg mt-2">
              Manage your analyses and credits
            </p>
          </div>
          <Button onClick={() => router.push("/analyze")}>
            New Analysis
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Credits Card */}
          <Card>
            <CardHeader>
              <CardTitle>Credits Balance</CardTitle>
              <CardDescription>Available for full analyses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{data.credits.balance}</div>
              <p className="text-sm text-muted-foreground mt-2">
                {data.credits.lifetimeSpent} spent lifetime
              </p>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Your current plan</CardDescription>
            </CardHeader>
            <CardContent>
              {data.subscription ? (
                <>
                  <Badge className="mb-2">{data.subscription.tierId}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {data.subscription.analysesUsedThisMonth} / {data.subscription.analysesPerMonth} analyses this month
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="mb-2">Free Tier</Badge>
                  <p className="text-sm text-muted-foreground">
                    1 free analysis per day
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Analyses Card */}
          <Card>
            <CardHeader>
              <CardTitle>Total Analyses</CardTitle>
              <CardDescription>Your usage statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{data.recentAnalyses.length}</div>
              <p className="text-sm text-muted-foreground mt-2">
                Articles analyzed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Truth Score Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Truth Score Trends</CardTitle>
              <CardDescription>Your recent analysis scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentAnalyses.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.recentAnalyses.slice(0, 10).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="analyzedAt"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [`${value}/100`, 'Truth Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="truthScore"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credibility Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Credibility Distribution</CardTitle>
              <CardDescription>Breakdown of your analysis results</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentAnalyses.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={
                    [
                      {
                        name: 'High',
                        count: data.recentAnalyses.filter(a => a.credibility === 'high').length
                      },
                      {
                        name: 'Moderate',
                        count: data.recentAnalyses.filter(a => a.credibility === 'moderate').length
                      },
                      {
                        name: 'Low',
                        count: data.recentAnalyses.filter(a => a.credibility === 'low').length
                      }
                    ]
                  }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [value, 'Articles']} />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Analyses */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>Your latest article analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentAnalyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No analyses yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/analyze")}
                >
                  Analyze your first article
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                    onClick={() => router.push(`/analyze/result/${analysis.id}`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{analysis.articleTitle}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.analyzedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{analysis.truthScore}</div>
                      <Badge
                        variant={
                          analysis.credibility === "high" ? "default" :
                          analysis.credibility === "moderate" ? "secondary" :
                          "destructive"
                        }
                      >
                        {analysis.credibility}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade CTA */}
        {!data.subscription && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Upgrade to Pro</CardTitle>
              <CardDescription>Get unlimited analyses and priority processing</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/pricing")}>
                View Pricing
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
