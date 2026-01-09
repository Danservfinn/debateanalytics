'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SourceStats, SourceStatsResponse } from '@/types/sources'

export default function SourcesDashboard() {
  const [sources, setSources] = useState<SourceStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globalMean, setGlobalMean] = useState<number>(50)
  const [filters, setFilters] = useState({
    minArticles: 1,
    timeRange: 'all' as 'all' | '30d' | '90d' | '1y',
    sortBy: 'grade' as 'grade' | 'articles' | 'recent'
  })

  useEffect(() => {
    fetchSources()
  }, [filters])

  async function fetchSources() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        minArticles: filters.minArticles.toString(),
        timeRange: filters.timeRange,
        sortBy: filters.sortBy,
        sortOrder: 'desc'
      })

      const res = await fetch(`/api/sources/stats?${params}`)
      const json: SourceStatsResponse = await res.json()

      if (json.success) {
        setSources(json.data)
        setGlobalMean(json.meta.globalMean)
      } else {
        setError('Failed to load sources')
      }
    } catch (e) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold text-stone-900 mb-2">
            Source Intelligence
          </h1>
          <p className="text-stone-600 text-lg">
            Media credibility ratings based on empirical analysis
          </p>
        </header>

        {/* Methodology Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 text-sm">
            <strong>Note:</strong> Ratings are based on user-submitted articles,
            not random samples. Grades emphasize <strong>logical structure (30%)</strong> and
            <strong> methodology rigor (20%)</strong> as primary factors.{' '}
            <Link href="/sources/methodology" className="underline hover:text-amber-900">
              View full methodology
            </Link>
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-stone-200 p-4 text-center">
            <div className="text-3xl font-bold text-stone-900">{sources.length}</div>
            <div className="text-sm text-stone-500">Sources Tracked</div>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4 text-center">
            <div className="text-3xl font-bold text-stone-900">
              {sources.reduce((sum, s) => sum + s.articleCount, 0)}
            </div>
            <div className="text-sm text-stone-500">Articles Analyzed</div>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4 text-center">
            <div className="text-3xl font-bold text-stone-900">{globalMean.toFixed(1)}</div>
            <div className="text-sm text-stone-500">Global Mean Score</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters(f => ({ ...f, timeRange: e.target.value as typeof filters.timeRange }))}
            className="px-3 py-2 border border-stone-300 rounded-lg bg-white text-stone-700"
          >
            <option value="all">All Time</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          <select
            value={filters.minArticles}
            onChange={(e) => setFilters(f => ({ ...f, minArticles: parseInt(e.target.value) }))}
            className="px-3 py-2 border border-stone-300 rounded-lg bg-white text-stone-700"
          >
            <option value="1">All Sources</option>
            <option value="5">Min 5 Articles</option>
            <option value="10">Min 10 Articles</option>
            <option value="20">Min 20 Articles</option>
            <option value="50">Min 50 Articles</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as typeof filters.sortBy }))}
            className="px-3 py-2 border border-stone-300 rounded-lg bg-white text-stone-700"
          >
            <option value="grade">Sort by Grade</option>
            <option value="articles">Sort by Articles</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full mx-auto" />
            <p className="text-stone-500 mt-4">Loading source data...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            {error}
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-stone-500">No sources found matching criteria.</p>
            <p className="text-stone-400 text-sm mt-2">Try adjusting your filters or analyze more articles.</p>
          </div>
        ) : (
          <SourceLeaderboard sources={sources} />
        )}
      </div>
    </div>
  )
}

function SourceLeaderboard({ sources }: { sources: SourceStats[] }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-stone-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Source
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Grade
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Score
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
              90% CI
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Articles
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Confidence
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Trend
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {sources.map((source, index) => (
            <tr key={source.id} className="hover:bg-stone-50">
              <td className="px-4 py-4 text-stone-500 text-sm">
                {index + 1}
              </td>
              <td className="px-4 py-4">
                <Link
                  href={`/sources/${encodeURIComponent(source.publication)}`}
                  className="font-medium text-stone-900 hover:text-blue-600"
                >
                  {source.publication}
                </Link>
              </td>
              <td className="px-4 py-4 text-center">
                <GradeBadge
                  grade={source.gradeDisplay}
                  confidence={source.bayesianScore.gradeConfidence}
                />
              </td>
              <td className="px-4 py-4 text-center text-stone-700 font-mono">
                {source.numericScore.toFixed(1)}
              </td>
              <td className="px-4 py-4 text-center text-stone-500 text-sm font-mono">
                {source.bayesianScore.credibleInterval.lower.toFixed(0)}-
                {source.bayesianScore.credibleInterval.upper.toFixed(0)}
              </td>
              <td className="px-4 py-4 text-center text-stone-600">
                {source.articleCount}
              </td>
              <td className="px-4 py-4 text-center">
                <ConfidenceBadge confidence={source.bayesianScore.gradeConfidence} />
              </td>
              <td className="px-4 py-4 text-center">
                <TrendIndicator trend={source.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GradeBadge({
  grade,
  confidence
}: {
  grade: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
}) {
  const bgColor = confidence === 'INSUFFICIENT' ? 'bg-stone-200 text-stone-600' :
    grade.startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
    grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
    grade.startsWith('C') ? 'bg-amber-100 text-amber-800' :
    grade.startsWith('D') ? 'bg-orange-100 text-orange-800' :
    'bg-red-100 text-red-800'

  return (
    <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${bgColor}`}>
      {grade}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-emerald-100 text-emerald-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-orange-100 text-orange-700',
    INSUFFICIENT: 'bg-stone-100 text-stone-500'
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[confidence] || styles.INSUFFICIENT}`}>
      {confidence}
    </span>
  )
}

function TrendIndicator({ trend }: { trend: SourceStats['trend'] }) {
  if (trend.change30Days === null) {
    return <span className="text-stone-400">—</span>
  }

  const arrow = trend.direction === 'improving' ? '↑' :
                trend.direction === 'declining' ? '↓' : '→'
  const color = trend.direction === 'improving' ? 'text-emerald-600' :
                trend.direction === 'declining' ? 'text-red-600' : 'text-stone-500'

  return (
    <span className={`font-medium ${color}`}>
      {arrow} {Math.abs(trend.change30Days).toFixed(1)}
    </span>
  )
}
