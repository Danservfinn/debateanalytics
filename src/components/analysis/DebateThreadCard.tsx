'use client'

import { useMemo, useState } from 'react'
import type { DebateThread, DebateWinner } from '@/types/debate'

interface DebateThreadCardProps {
  debate: DebateThread
  index: number
  onClick?: () => void
}

/**
 * DebateThreadCard - Collapsible debate summary card
 *
 * Features:
 * - Animated expand/collapse
 * - Position indicators (PRO/CON bars)
 * - Winner badge with glow effect
 * - Argument preview with quality scores
 */
export function DebateThreadCard({ debate, index, onClick }: DebateThreadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate position stats
  const stats = useMemo(() => {
    const proReplies = debate.replies.filter(r => r.position === 'pro')
    const conReplies = debate.replies.filter(r => r.position === 'con')
    const neutralReplies = debate.replies.filter(r => r.position === 'neutral')

    const proAvgQuality = proReplies.length > 0
      ? proReplies.reduce((sum, r) => sum + r.qualityScore, 0) / proReplies.length
      : 0

    const conAvgQuality = conReplies.length > 0
      ? conReplies.reduce((sum, r) => sum + r.qualityScore, 0) / conReplies.length
      : 0

    return {
      proCount: proReplies.length,
      conCount: conReplies.length,
      neutralCount: neutralReplies.length,
      proAvgQuality,
      conAvgQuality,
      total: debate.replies.length
    }
  }, [debate.replies])

  // Winner styling
  const winnerConfig = useMemo(() => {
    const configs: Record<DebateWinner, { label: string; color: string; bgColor: string }> = {
      pro: { label: 'PRO Wins', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.2)' },
      con: { label: 'CON Wins', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
      draw: { label: 'Draw', color: '#a1a1aa', bgColor: 'rgba(161, 161, 170, 0.2)' },
      unresolved: { label: 'Ongoing', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.2)' }
    }
    return configs[debate.winner]
  }, [debate.winner])

  // Position bar percentages
  const positionBars = useMemo(() => {
    const total = stats.proCount + stats.conCount + stats.neutralCount
    if (total === 0) return { pro: 0, con: 0, neutral: 0 }
    return {
      pro: (stats.proCount / total) * 100,
      con: (stats.conCount / total) * 100,
      neutral: (stats.neutralCount / total) * 100
    }
  }, [stats])

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div
      className="card-premium cursor-pointer animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={handleClick}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Debate #{index + 1}
              </span>
              {/* Winner Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  debate.winner !== 'unresolved' ? 'winner-glow' : ''
                }`}
                style={{
                  backgroundColor: winnerConfig.bgColor,
                  color: winnerConfig.color
                }}
              >
                {winnerConfig.label}
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground line-clamp-2">
              {debate.title}
            </h3>
          </div>

          {/* Heat indicator */}
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-muted-foreground mb-1">Heat</div>
            <HeatIndicator intensity={debate.heatLevel} />
          </div>
        </div>

        {/* Position distribution bar */}
        <div className="mb-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
            <div
              className="bg-success transition-all duration-500"
              style={{ width: `${positionBars.pro}%` }}
            />
            <div
              className="bg-zinc-500 transition-all duration-500"
              style={{ width: `${positionBars.neutral}%` }}
            />
            <div
              className="bg-danger transition-all duration-500"
              style={{ width: `${positionBars.con}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="text-success">{stats.proCount} PRO</span>
            <span className="text-danger">{stats.conCount} CON</span>
          </div>
        </div>

        {/* Quality comparison */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <QualityMeter
            label="PRO Quality"
            score={stats.proAvgQuality}
            color="success"
          />
          <QualityMeter
            label="CON Quality"
            score={stats.conAvgQuality}
            color="danger"
          />
        </div>

        {/* Key clash preview */}
        <div className="text-sm text-muted-foreground line-clamp-2 italic border-l-2 border-primary pl-3">
          &ldquo;{debate.keyClash.substring(0, 150)}
          {debate.keyClash.length > 150 ? '...' : ''}&rdquo;
        </div>

        {/* Expand indicator */}
        <div className="flex items-center justify-center mt-4 text-muted-foreground">
          <span className="text-xs">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
          <svg
            className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border px-5 py-4 animate-fade-in">
          <h4 className="text-sm font-medium text-foreground mb-3">Top Arguments</h4>
          <div className="space-y-3">
            {debate.replies
              .sort((a, b) => b.qualityScore - a.qualityScore)
              .slice(0, 3)
              .map((reply, idx) => (
                <div
                  key={reply.id}
                  className={`position-${reply.position} rounded-lg p-3`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      u/{reply.author}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      reply.position === 'pro' ? 'bg-success/20 text-success' :
                      reply.position === 'con' ? 'bg-danger/20 text-danger' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {reply.position.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">
                    {reply.text.substring(0, 200)}
                    {reply.text.length > 200 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Quality: {reply.qualityScore.toFixed(1)}/10</span>
                    {reply.claims && reply.claims.length > 0 && (
                      <span className="text-info">{reply.claims.length} claim{reply.claims.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface HeatIndicatorProps {
  intensity: number // 0-10
}

function HeatIndicator({ intensity }: HeatIndicatorProps) {
  const bars = 5
  const filledBars = Math.round((intensity / 10) * bars)

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-colors ${
            i < filledBars
              ? intensity > 7 ? 'bg-danger' :
                intensity > 4 ? 'bg-warning' :
                'bg-success'
              : 'bg-secondary'
          }`}
          style={{ height: `${8 + i * 2}px` }}
        />
      ))}
    </div>
  )
}

interface QualityMeterProps {
  label: string
  score: number
  color: 'success' | 'danger'
}

function QualityMeter({ label, score, color }: QualityMeterProps) {
  const percentage = (score / 10) * 100

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`text-${color}`}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color} transition-all duration-700`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default DebateThreadCard
