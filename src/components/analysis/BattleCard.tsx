'use client'

import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import type { DebateThread, DebateComment } from '@/types/debate'

interface BattleCardProps {
  debate: DebateThread
  threadUrl?: string
}

/**
 * BattleCard - Side-by-side PRO vs CON comparison
 *
 * Features:
 * - Split view with position colors
 * - Best argument from each side
 * - Quality comparison bars
 * - Winner highlight with glow
 */
export function BattleCard({ debate, threadUrl }: BattleCardProps) {
  // Get best arguments from each side
  const { bestPro, bestCon, proStats, conStats } = useMemo(() => {
    const proReplies = debate.replies.filter(r => r.position === 'pro')
    const conReplies = debate.replies.filter(r => r.position === 'con')

    const bestPro = proReplies.length > 0
      ? proReplies.reduce((best, r) => r.qualityScore > best.qualityScore ? r : best)
      : null

    const bestCon = conReplies.length > 0
      ? conReplies.reduce((best, r) => r.qualityScore > best.qualityScore ? r : best)
      : null

    const proAvg = proReplies.length > 0
      ? proReplies.reduce((sum, r) => sum + r.qualityScore, 0) / proReplies.length
      : 0

    const conAvg = conReplies.length > 0
      ? conReplies.reduce((sum, r) => sum + r.qualityScore, 0) / conReplies.length
      : 0

    return {
      bestPro,
      bestCon,
      proStats: {
        count: proReplies.length,
        avgQuality: proAvg,
        totalClaims: proReplies.reduce((sum, r) => sum + (r.claims?.length || 0), 0)
      },
      conStats: {
        count: conReplies.length,
        avgQuality: conAvg,
        totalClaims: conReplies.reduce((sum, r) => sum + (r.claims?.length || 0), 0)
      }
    }
  }, [debate.replies])

  const isProWinner = debate.winner === 'pro'
  const isConWinner = debate.winner === 'con'
  const isDraw = debate.winner === 'draw'

  return (
    <div className="card-premium overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground text-center">
          {debate.title}
        </h3>
        {isDraw && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            This debate ended in a draw
          </p>
        )}
      </div>

      {/* Battle Grid */}
      <div className="grid grid-cols-2">
        {/* PRO Side */}
        <div className={`p-4 ${isProWinner ? 'bg-success/10' : 'bg-card'} border-r border-border`}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full bg-success ${isProWinner ? 'winner-glow' : ''}`} />
            <span className={`text-sm font-bold ${isProWinner ? 'text-success' : 'text-muted-foreground'}`}>
              PRO
            </span>
            {isProWinner && (
              <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <StatBox label="Args" value={proStats.count} />
            <StatBox label="Quality" value={proStats.avgQuality.toFixed(1)} />
            <StatBox label="Claims" value={proStats.totalClaims} />
          </div>

          {/* Best argument */}
          {bestPro && (
            <ArgumentPreview
              argument={bestPro}
              position="pro"
              isBest={true}
              threadUrl={threadUrl}
            />
          )}
        </div>

        {/* CON Side */}
        <div className={`p-4 ${isConWinner ? 'bg-danger/10' : 'bg-card'}`}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full bg-danger ${isConWinner ? 'winner-glow' : ''}`} />
            <span className={`text-sm font-bold ${isConWinner ? 'text-danger' : 'text-muted-foreground'}`}>
              CON
            </span>
            {isConWinner && (
              <svg className="w-4 h-4 text-danger" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <StatBox label="Args" value={conStats.count} />
            <StatBox label="Quality" value={conStats.avgQuality.toFixed(1)} />
            <StatBox label="Claims" value={conStats.totalClaims} />
          </div>

          {/* Best argument */}
          {bestCon && (
            <ArgumentPreview
              argument={bestCon}
              position="con"
              isBest={true}
              threadUrl={threadUrl}
            />
          )}
        </div>
      </div>

      {/* Quality comparison bar */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center mb-2">
          Quality Distribution
        </div>
        <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
          {/* PRO bar from left */}
          <div
            className="absolute left-0 top-0 h-full bg-success transition-all duration-700"
            style={{
              width: `${(proStats.avgQuality / (proStats.avgQuality + conStats.avgQuality || 1)) * 100}%`
            }}
          />
          {/* CON bar from right */}
          <div
            className="absolute right-0 top-0 h-full bg-danger transition-all duration-700"
            style={{
              width: `${(conStats.avgQuality / (proStats.avgQuality + conStats.avgQuality || 1)) * 100}%`
            }}
          />
          {/* Center marker */}
          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-background -translate-x-1/2" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{proStats.avgQuality.toFixed(1)}</span>
          <span>{conStats.avgQuality.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}

interface StatBoxProps {
  label: string
  value: string | number
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  )
}

interface ArgumentPreviewProps {
  argument: DebateComment
  position: 'pro' | 'con'
  isBest?: boolean
  threadUrl?: string
}

function ArgumentPreview({ argument, position, isBest, threadUrl }: ArgumentPreviewProps) {
  const borderColor = position === 'pro' ? 'border-success' : 'border-danger'
  const bgColor = position === 'pro' ? 'bg-success/5' : 'bg-danger/5'

  // Construct Reddit comment permalink
  const getRedditCommentUrl = () => {
    if (!threadUrl) return null
    // Clean the URL and append comment ID
    const baseUrl = threadUrl.replace(/\/$/, '') // Remove trailing slash
    return `${baseUrl}/${argument.id}/?context=3`
  }

  const commentUrl = getRedditCommentUrl()

  const content = (
    <>
      {isBest && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-warning" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-[10px] text-warning font-medium uppercase">Best Argument</span>
          </div>
          {commentUrl && (
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}
      <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
        {argument.text.substring(0, 150)}
        {argument.text.length > 150 ? '...' : ''}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">u/{argument.author}</span>
        <span className={`text-[10px] ${position === 'pro' ? 'text-success' : 'text-danger'}`}>
          {argument.qualityScore.toFixed(1)}/10
        </span>
      </div>
    </>
  )

  if (commentUrl) {
    return (
      <a
        href={commentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${bgColor} rounded-lg p-3 border-l-2 ${borderColor} block group hover:bg-opacity-20 transition-colors cursor-pointer`}
      >
        {content}
      </a>
    )
  }

  return (
    <div className={`${bgColor} rounded-lg p-3 border-l-2 ${borderColor}`}>
      {content}
    </div>
  )
}

export default BattleCard
