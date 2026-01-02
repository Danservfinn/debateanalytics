'use client'

import { useMemo } from 'react'
import type { ThreadVerdict } from '@/types/debate'

interface HeroVerdictCardProps {
  verdict: ThreadVerdict
  debateCount: number
  commentCount: number
  title: string
}

/**
 * HeroVerdictCard - Premium verdict display with animated gradient border
 *
 * Features:
 * - Animated gradient border cycling through brand colors
 * - SVG score ring with fill animation
 * - Quick verdict badges
 * - Key metrics display
 */
export function HeroVerdictCard({
  verdict,
  debateCount,
  commentCount,
  title
}: HeroVerdictCardProps) {
  // Calculate ring offset based on score (0-10 scale)
  const ringOffset = useMemo(() => {
    const circumference = 282.7 // 2 * PI * 45
    const percentage = verdict.overallScore / 10
    return circumference * (1 - percentage)
  }, [verdict.overallScore])

  // Determine score color
  const scoreColor = useMemo(() => {
    if (verdict.overallScore >= 7) return '#22c55e' // green
    if (verdict.overallScore >= 5) return '#f59e0b' // amber
    return '#ef4444' // red
  }, [verdict.overallScore])

  // Generate verdict badges
  const badges = useMemo(() => {
    const result: Array<{ label: string; type: 'strong' | 'weak' | 'fallacy' | 'evidence' | 'neutral' }> = []

    if (verdict.evidenceQualityPct >= 60) {
      result.push({ label: 'Evidence-Rich', type: 'evidence' })
    } else if (verdict.evidenceQualityPct < 30) {
      result.push({ label: 'Low Evidence', type: 'weak' })
    }

    if (verdict.civilityScore >= 8) {
      result.push({ label: 'Civil Discourse', type: 'strong' })
    } else if (verdict.civilityScore < 5) {
      result.push({ label: 'Heated', type: 'fallacy' })
    }

    if (verdict.worthReading) {
      result.push({ label: 'Worth Reading', type: 'strong' })
    }

    if (debateCount > 0) {
      result.push({ label: `${debateCount} Debate${debateCount > 1 ? 's' : ''}`, type: 'neutral' })
    }

    return result
  }, [verdict, debateCount])

  return (
    <div className="animated-gradient-border rounded-xl p-[2px]">
      <div className="bg-card rounded-xl p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Score Ring */}
          <div className="flex-shrink-0 flex justify-center lg:justify-start">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full score-ring" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle
                  className="score-ring-bg"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                />
                {/* Animated fill ring */}
                <circle
                  className="score-ring-fill"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                  stroke={scoreColor}
                  strokeLinecap="round"
                  style={{ '--ring-offset': ringOffset } as React.CSSProperties}
                />
              </svg>
              {/* Score text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-3xl font-bold font-heading"
                  style={{ color: scoreColor }}
                >
                  {verdict.overallScore.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  Score
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-xl md:text-2xl font-heading font-semibold text-foreground mb-3 line-clamp-2">
              {title}
            </h1>

            {/* Summary */}
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-4">
              {verdict.summary}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {badges.map((badge, idx) => (
                <span
                  key={idx}
                  className={`badge-${badge.type} px-3 py-1 rounded-full text-xs font-medium`}
                >
                  {badge.label}
                </span>
              ))}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              <MetricItem
                label="Evidence"
                value={`${verdict.evidenceQualityPct}%`}
                indicator={verdict.evidenceQualityPct >= 50 ? 'good' : 'poor'}
              />
              <MetricItem
                label="Civility"
                value={`${verdict.civilityScore}/10`}
                indicator={verdict.civilityScore >= 6 ? 'good' : 'poor'}
              />
              <MetricItem
                label="Comments"
                value={commentCount.toLocaleString()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MetricItemProps {
  label: string
  value: string
  indicator?: 'good' | 'poor'
}

function MetricItem({ label, value, indicator }: MetricItemProps) {
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold ${
        indicator === 'good' ? 'text-success' :
        indicator === 'poor' ? 'text-danger' :
        'text-foreground'
      }`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  )
}

export default HeroVerdictCard
