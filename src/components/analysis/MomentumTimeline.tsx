'use client'

import { useMemo } from 'react'
import type { DebateThread, MomentumShift, DebateComment } from '@/types/debate'

interface MomentumTimelineProps {
  debate: DebateThread
}

/**
 * MomentumTimeline - Visual debate progression over time
 *
 * Features:
 * - Horizontal timeline with nodes
 * - Momentum shift indicators
 * - PRO/CON position coloring
 * - Interactive hover states
 */
export function MomentumTimeline({ debate }: MomentumTimelineProps) {
  // Build timeline data from replies sorted by createdAt
  const timelineData = useMemo(() => {
    const sortedReplies = [...debate.replies].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // Track running momentum
    let proMomentum = 0
    let conMomentum = 0

    return sortedReplies.map((reply, index) => {
      // Update momentum based on position and quality
      if (reply.position === 'pro') {
        proMomentum += reply.qualityScore
      } else if (reply.position === 'con') {
        conMomentum += reply.qualityScore
      }

      // Calculate relative momentum (-1 to 1, where positive = PRO leading)
      const totalMomentum = proMomentum + conMomentum
      const relativeMomentum = totalMomentum > 0
        ? (proMomentum - conMomentum) / totalMomentum
        : 0

      // Check if this is a momentum shift (using reply number, 1-indexed)
      const shift = debate.momentumShifts?.find(s => s.replyNumber === index + 1)

      return {
        reply,
        index,
        relativeMomentum,
        shift,
        proMomentum,
        conMomentum,
        timestamp: new Date(reply.createdAt).getTime()
      }
    })
  }, [debate.replies, debate.momentumShifts])

  // Get time range for display
  const timeRange = useMemo(() => {
    if (timelineData.length === 0) return { start: 0, end: 0, duration: 0 }
    const start = timelineData[0].timestamp
    const end = timelineData[timelineData.length - 1].timestamp
    return { start, end, duration: end - start }
  }, [timelineData])

  if (timelineData.length === 0) {
    return (
      <div className="card-premium p-6 text-center text-muted-foreground">
        No timeline data available
      </div>
    )
  }

  return (
    <div className="card-premium p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Debate Momentum</h3>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span className="text-muted-foreground">PRO</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-danger" />
          <span className="text-muted-foreground">CON</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <span className="text-muted-foreground">Momentum Shift</span>
        </div>
      </div>

      {/* Timeline container */}
      <div className="relative">
        {/* Central line */}
        <div className="absolute left-0 right-0 top-1/2 h-0.5 momentum-line -translate-y-1/2" />

        {/* PRO zone indicator */}
        <div className="absolute left-0 right-0 top-0 h-[45%] bg-success/5 rounded-t-lg border-b border-success/20">
          <span className="absolute top-2 left-2 text-[10px] text-success/60 uppercase tracking-wider">
            PRO Leading
          </span>
        </div>

        {/* CON zone indicator */}
        <div className="absolute left-0 right-0 bottom-0 h-[45%] bg-danger/5 rounded-b-lg border-t border-danger/20">
          <span className="absolute bottom-2 left-2 text-[10px] text-danger/60 uppercase tracking-wider">
            CON Leading
          </span>
        </div>

        {/* Timeline nodes */}
        <div className="relative h-48 flex items-center">
          {timelineData.map((data, i) => {
            // Position along timeline - use index-based for even distribution
            // (timestamp-based clusters nodes when comments come in bursts)
            const xPercent = timelineData.length > 1
              ? (i / (timelineData.length - 1)) * 100
              : 50

            // Vertical position based on momentum (-1 to 1 mapped to 10% to 90%)
            const yPercent = 50 - (data.relativeMomentum * 40)

            // Node color
            const nodeColor = data.reply.position === 'pro' ? 'bg-success' :
              data.reply.position === 'con' ? 'bg-danger' : 'bg-zinc-500'

            // Size based on quality
            const size = 8 + (data.reply.qualityScore / 10) * 8

            return (
              <TimelineNode
                key={data.reply.id}
                data={data}
                xPercent={xPercent}
                yPercent={yPercent}
                nodeColor={nodeColor}
                size={size}
              />
            )
          })}
        </div>
      </div>

      {/* Momentum summary */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-xl font-bold text-success">
            {timelineData[timelineData.length - 1]?.proMomentum.toFixed(0) || 0}
          </div>
          <div className="text-xs text-muted-foreground">PRO Total Score</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-danger">
            {timelineData[timelineData.length - 1]?.conMomentum.toFixed(0) || 0}
          </div>
          <div className="text-xs text-muted-foreground">CON Total Score</div>
        </div>
      </div>

      {/* Momentum shifts */}
      {debate.momentumShifts && debate.momentumShifts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Key Momentum Shifts
          </h4>
          <div className="space-y-2">
            {debate.momentumShifts.map((shift, i) => (
              <MomentumShiftItem key={i} shift={shift} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface TimelineNodeProps {
  data: {
    reply: DebateComment
    index: number
    relativeMomentum: number
    shift?: MomentumShift
    proMomentum: number
    conMomentum: number
    timestamp: number
  }
  xPercent: number
  yPercent: number
  nodeColor: string
  size: number
}

function TimelineNode({ data, xPercent, yPercent, nodeColor, size }: TimelineNodeProps) {
  const hasShift = !!data.shift

  return (
    <div
      className="absolute group"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Shift indicator ring */}
      {hasShift && (
        <div
          className="absolute inset-0 rounded-full bg-warning animate-pulse-glow"
          style={{
            width: size + 8,
            height: size + 8,
            left: -4,
            top: -4
          }}
        />
      )}

      {/* Node */}
      <div
        className={`momentum-node rounded-full ${nodeColor} cursor-pointer`}
        style={{ width: size, height: size }}
      />

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="glass-strong rounded-lg p-3 text-xs min-w-[180px]">
          <div className="font-medium text-foreground mb-1">u/{data.reply.author}</div>
          <div className="text-muted-foreground mb-2 line-clamp-2">
            {data.reply.text.substring(0, 100)}...
          </div>
          <div className="flex justify-between text-[10px]">
            <span className={data.reply.position === 'pro' ? 'text-success' : data.reply.position === 'con' ? 'text-danger' : 'text-zinc-400'}>
              {data.reply.position.toUpperCase()}
            </span>
            <span className="text-muted-foreground">
              Quality: {data.reply.qualityScore.toFixed(1)}
            </span>
          </div>
          {hasShift && data.shift && (
            <div className="mt-2 pt-2 border-t border-border text-warning">
              <span className="font-medium">Momentum Shift:</span> {data.shift.trigger}
            </div>
          )}
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-secondary" />
      </div>
    </div>
  )
}

interface MomentumShiftItemProps {
  shift: MomentumShift
}

function MomentumShiftItem({ shift }: MomentumShiftItemProps) {
  // toPosition is the new position after the shift
  const isPro = shift.toPosition === 'pro'
  const directionColor = isPro ? 'text-success' : 'text-danger'
  const directionBg = isPro ? 'bg-success/10' : 'bg-danger/10'

  return (
    <div className={`${directionBg} rounded-lg p-3 flex items-start gap-3`}>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isPro ? 'bg-success/20' : 'bg-danger/20'}`}>
        <svg
          className={`w-4 h-4 ${directionColor}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isPro ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          )}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${directionColor}`}>
          Shifted to {shift.toPosition.toUpperCase()}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {shift.trigger}
        </div>
      </div>
      <div className="flex-shrink-0 text-xs text-muted-foreground">
        {shift.qualityDelta > 0 ? '+' : ''}{shift.qualityDelta.toFixed(0)} pts
      </div>
    </div>
  )
}

export default MomentumTimeline
