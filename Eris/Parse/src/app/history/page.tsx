/**
 * Analysis History Page
 * Shows all analyses performed by the user
 */

'use client'

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  Search,
  ExternalLink,
  Share2,
  Calendar,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check
} from "lucide-react"

interface AnalysisSummary {
  id: string
  articleUrl: string
  articleTitle: string
  publication: string
  publishDate: string
  articleType: string
  truthScore: number
  credibility: string
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function getCredibilityColor(credibility: string): string {
  switch (credibility) {
    case 'high': return 'bg-green-500/10 text-green-600 border-green-500/20'
    case 'moderate': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
    case 'low': return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
    case 'very_low': return 'bg-red-500/10 text-red-600 border-red-500/20'
    default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

function formatArticleType(type: string): string {
  const types: Record<string, string> = {
    news: 'News',
    op_ed: 'Opinion',
    blog_post: 'Blog',
    analysis: 'Analysis',
  }
  return types[type] || type
}

export default function HistoryPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    } else if (status === "authenticated") {
      fetchAnalyses(1)
    }
  }, [status, router])

  const fetchAnalyses = async (page: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/analyses?page=${page}&limit=20`)
      const result = await response.json()

      if (result.success) {
        setAnalyses(result.data.analyses)
        setPagination(result.data.pagination)
      }
    } catch (error) {
      console.error("Failed to fetch analyses:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyShareLink = async (analysisId: string) => {
    const url = `${window.location.origin}/analyze/result/${analysisId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(analysisId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter analyses by search query
  const filteredAnalyses = analyses.filter(a =>
    a.articleTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.publication.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (status === "loading" || (status === "authenticated" && isLoading && analyses.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Analysis History</h1>
            <p className="text-muted-foreground text-lg mt-2">
              {pagination?.total || 0} articles analyzed
            </p>
          </div>
          <Button onClick={() => router.push("/analyze")} size="lg">
            <FileText className="h-5 w-5 mr-2" />
            New Analysis
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by title or publication..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Analysis List */}
        {filteredAnalyses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "No matching analyses" : "No analyses yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : "Analyze your first article to build your history"
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => router.push("/analyze")}>
                  Analyze an Article
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAnalyses.map((analysis) => (
              <Card
                key={analysis.id}
                className="hover:shadow-lg transition-all cursor-pointer group"
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Score Column */}
                    <div className="flex flex-col items-center justify-center min-w-[70px]">
                      <div className={`text-3xl font-bold ${getScoreColor(analysis.truthScore)}`}>
                        {analysis.truthScore}
                      </div>
                      <div className="text-xs text-muted-foreground">/ 100</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/analyze/result/${analysis.id}`}>
                        <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-1">
                          {analysis.articleTitle}
                        </h3>
                      </Link>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{analysis.publication}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatArticleType(analysis.articleType)}
                        </Badge>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-2">
                        <Badge className={getCredibilityColor(analysis.credibility)}>
                          {analysis.credibility.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault()
                          copyShareLink(analysis.id)
                        }}
                        title="Copy share link"
                      >
                        {copiedId === analysis.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault()
                          window.open(analysis.articleUrl, '_blank')
                        }}
                        title="Open original article"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={() => fetchAnalyses(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => fetchAnalyses(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
