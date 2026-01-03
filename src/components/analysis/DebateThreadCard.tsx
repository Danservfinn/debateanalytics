'use client'

import { useMemo, useState } from 'react'
import type { DebateThread, DebateWinner, DebateComment } from '@/types/debate'
import type { FlowAnalysisResult } from '@/types/debate-scoring'
import { Gavel, CheckCircle2, XCircle } from 'lucide-react'

interface DebateThreadCardProps {
  debate: DebateThread
  index: number
  onClick?: () => void
  isExpanded?: boolean  // Controlled expansion from parent
  onCollapse?: () => void  // Callback to collapse
  flowAnalysis?: FlowAnalysisResult // Optional flow analysis for this debate
}

/**
 * DebateThreadCard - Collapsible debate summary card
 *
 * Features:
 * - Animated expand/collapse to full width
 * - Position indicators (PRO/CON bars)
 * - Winner badge with glow effect
 * - Argument preview with quality scores
 * - Full argument list when expanded
 */
export function DebateThreadCard({ debate, index, onClick, isExpanded: controlledExpanded, onCollapse }: DebateThreadCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)

  // Use controlled or internal state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded

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

  const handleClick = (e: React.MouseEvent) => {
    // If clicking collapse button, don't propagate
    if ((e.target as HTMLElement).closest('.collapse-btn')) {
      return
    }

    if (onClick) {
      onClick()
    } else {
      setInternalExpanded(!internalExpanded)
    }
  }

  const handleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCollapse) {
      onCollapse()
    } else {
      setInternalExpanded(false)
    }
  }

  return (
    <div
      className={`card-premium cursor-pointer animate-slide-up transition-all duration-300 ${
        isExpanded ? 'md:col-span-2 ring-2 ring-primary/50' : ''
      }`}
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
        {!isExpanded && (
          <div className="flex items-center justify-center mt-4 text-muted-foreground">
            <span className="text-xs">Click to expand full debate</span>
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      {/* Expanded content - full debate thread */}
      {isExpanded && (
        <div className="border-t border-border px-5 py-4 animate-fade-in">
          {/* Collapse button */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-foreground">
              Full Debate Thread ({debate.replies.length} arguments)
            </h4>
            <button
              className="collapse-btn flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary"
              onClick={handleCollapse}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Collapse
            </button>
          </div>

          {/* Two-column layout for PRO vs CON when expanded */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* PRO Arguments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm font-medium text-success">PRO Arguments ({stats.proCount})</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {debate.replies
                  .filter(r => r.position === 'pro')
                  .sort((a, b) => b.qualityScore - a.qualityScore)
                  .map((reply) => (
                    <ArgumentCard key={reply.id} reply={reply} />
                  ))}
                {stats.proCount === 0 && (
                  <p className="text-xs text-muted-foreground italic">No PRO arguments</p>
                )}
              </div>
            </div>

            {/* CON Arguments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-danger" />
                <span className="text-sm font-medium text-danger">CON Arguments ({stats.conCount})</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {debate.replies
                  .filter(r => r.position === 'con')
                  .sort((a, b) => b.qualityScore - a.qualityScore)
                  .map((reply) => (
                    <ArgumentCard key={reply.id} reply={reply} />
                  ))}
                {stats.conCount === 0 && (
                  <p className="text-xs text-muted-foreground italic">No CON arguments</p>
                )}
              </div>
            </div>
          </div>

          {/* Neutral arguments if any */}
          {stats.neutralCount > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-zinc-500" />
                <span className="text-sm font-medium text-zinc-400">Neutral ({stats.neutralCount})</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {debate.replies
                  .filter(r => r.position === 'neutral')
                  .map((reply) => (
                    <ArgumentCard key={reply.id} reply={reply} />
                  ))}
              </div>
            </div>
          )}
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

interface ArgumentCardProps {
  reply: DebateComment
}

function ArgumentCard({ reply }: ArgumentCardProps) {
  const positionColors = {
    pro: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success' },
    con: { bg: 'bg-danger/10', border: 'border-danger/30', text: 'text-danger' },
    neutral: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400' }
  }

  const colors = positionColors[reply.position] || positionColors.neutral

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg p-3`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">u/{reply.author}</span>
        <span className={`text-xs font-medium ${colors.text}`}>
          {reply.qualityScore.toFixed(1)}/10
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed line-clamp-4">
        {reply.text}
      </p>
      {reply.claims && reply.claims.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {reply.claims.length} claim{reply.claims.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default DebateThreadCard
