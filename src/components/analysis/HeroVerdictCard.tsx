'use client'

import { useMemo } from 'react'
import type { ThreadVerdict, DebateThread } from '@/types/debate'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Trophy, Lightbulb, FileText } from 'lucide-react'

interface HeroVerdictCardProps {
  verdict: ThreadVerdict
  debateCount: number
  commentCount: number
  title: string
  debates?: DebateThread[]  // Optional: pass debates to derive executive summary
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
  title,
  debates = []
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

  // Derive executive summary from debates
  const executiveSummary = useMemo(() => {
    // Use verdict's fields if available, otherwise derive from debates
    const keyTakeaways = verdict.keyTakeaways || []
    const conclusion = verdict.conclusion
    const winningPosition = verdict.winningPosition

    // If no verdict fields, derive from debates
    if (!conclusion && debates.length > 0) {
      const proWins = debates.filter(d => d.winner === 'pro').length
      const conWins = debates.filter(d => d.winner === 'con').length
      const draws = debates.filter(d => d.winner === 'draw').length

      let derivedConclusion: string
      let derivedPosition: 'pro' | 'con' | 'draw' | 'unresolved'

      if (proWins > conWins) {
        derivedConclusion = `PRO side generally prevails (${proWins} vs ${conWins} debates won)`
        derivedPosition = 'pro'
      } else if (conWins > proWins) {
        derivedConclusion = `CON side generally prevails (${conWins} vs ${proWins} debates won)`
        derivedPosition = 'con'
      } else if (draws > 0 || (proWins === conWins && proWins > 0)) {
        derivedConclusion = `Evenly matched debate (${proWins} PRO vs ${conWins} CON wins, ${draws} draws)`
        derivedPosition = 'draw'
      } else {
        derivedConclusion = 'No clear winner emerged from the debates'
        derivedPosition = 'unresolved'
      }

      // Derive key takeaways from debate win reasons
      const derivedTakeaways = debates
        .filter(d => d.winnerReason)
        .slice(0, 3)
        .map(d => d.winnerReason)

      return {
        keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : derivedTakeaways,
        conclusion: derivedConclusion,
        winningPosition: winningPosition || derivedPosition
      }
    }

    return {
      keyTakeaways,
      conclusion: conclusion || verdict.summary,
      winningPosition: winningPosition || 'unresolved'
    }
  }, [verdict, debates])

  // Position color helper
  const getPositionColor = (position?: string) => {
    switch (position) {
      case 'pro': return 'text-success'
      case 'con': return 'text-danger'
      case 'draw': return 'text-warning'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="animated-gradient-border rounded-xl p-[2px]">
        <div className="bg-card rounded-xl p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Score Ring */}
            <div className="flex-shrink-0 flex justify-center lg:justify-start">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative w-32 h-32 cursor-help">
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
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p className="font-medium mb-1">Overall Thread Quality</p>
                  <p className="text-muted-foreground">
                    Combined score (0-10) based on argument quality, evidence use, logical soundness, and discourse civility
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-xl md:text-2xl font-heading font-semibold text-foreground mb-3">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <MetricItem
                      label="Evidence"
                      value={`${verdict.evidenceQualityPct}%`}
                      indicator={verdict.evidenceQualityPct >= 50 ? 'good' : 'poor'}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p className="font-medium mb-1">Evidence Quality</p>
                  <p className="text-muted-foreground">
                    Percentage of arguments backed by citations, data, studies, or verifiable sources
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <MetricItem
                      label="Civility"
                      value={`${verdict.civilityScore}/10`}
                      indicator={verdict.civilityScore >= 6 ? 'good' : 'poor'}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p className="font-medium mb-1">Discourse Civility</p>
                  <p className="text-muted-foreground">
                    Rating of respectful engagement, absence of personal attacks, and good faith argumentation
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <MetricItem
                      label="Comments"
                      value={commentCount.toLocaleString()}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p className="font-medium mb-1">Total Comments</p>
                  <p className="text-muted-foreground">
                    Number of comments in this thread, including replies
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Executive Summary Section */}
        {(executiveSummary.conclusion || executiveSummary.keyTakeaways.length > 0) && (
          <div className="mt-6 pt-6 border-t border-border space-y-4">
            {/* Conclusion */}
            {executiveSummary.conclusion && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Trophy className={`w-5 h-5 ${getPositionColor(executiveSummary.winningPosition)}`} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Conclusion
                  </h3>
                  <p className={`text-base font-medium ${getPositionColor(executiveSummary.winningPosition)}`}>
                    {executiveSummary.conclusion}
                  </p>
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            {executiveSummary.keyTakeaways.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-info/10 shrink-0">
                  <Lightbulb className="w-5 h-5 text-info" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Key Takeaways
                  </h3>
                  <ul className="space-y-2">
                    {executiveSummary.keyTakeaways.map((takeaway, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-foreground flex items-start gap-2"
                      >
                        <span className="text-primary font-bold shrink-0">•</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Summary (if different from conclusion) */}
            {verdict.summary && verdict.summary !== executiveSummary.conclusion && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary/50 shrink-0">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Analysis Summary
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {verdict.summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </TooltipProvider>
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
