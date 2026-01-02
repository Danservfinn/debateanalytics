'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, ExternalLink, ChevronDown } from 'lucide-react'
import type { DebateThread, MomentumShift, DebateComment, DebatePosition } from '@/types/debate'

interface MomentumTimelineProps {
  debate: DebateThread
  onJumpToComment?: (commentId: string) => void
}

/**
 * MomentumTimeline - Visual debate progression with clear axes
 *
 * Redesigned for clarity:
 * - X-axis: Comment # (1, 2, 3...)
 * - Y-axis: Score differential (PRO - CON) with numeric scale
 * - Connected line showing momentum flow
 * - Clickable nodes to view comment text
 */
export function MomentumTimeline({ debate, onJumpToComment }: MomentumTimelineProps) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  // Build timeline data with running differential
  const timelineData = useMemo(() => {
    const sortedReplies = [...debate.replies].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    let runningPro = 0
    let runningCon = 0

    return sortedReplies.map((reply, index) => {
      // Add to running totals
      if (reply.position === 'pro') {
        runningPro += reply.qualityScore
      } else if (reply.position === 'con') {
        runningCon += reply.qualityScore
      }

      // Running differential: positive = PRO leading, negative = CON leading
      const differential = runningPro - runningCon

      // Check for momentum shift
      const shift = debate.momentumShifts?.find(s => s.replyNumber === index + 1)

      return {
        reply,
        commentNumber: index + 1,
        differential,
        runningPro,
        runningCon,
        shift,
      }
    })
  }, [debate.replies, debate.momentumShifts])

  // Calculate Y-axis bounds
  const yBounds = useMemo(() => {
    if (timelineData.length === 0) return { min: -10, max: 10 }

    const diffs = timelineData.map(d => d.differential)
    const maxAbs = Math.max(Math.abs(Math.min(...diffs)), Math.abs(Math.max(...diffs)), 5)
    // Round up to nice number
    const bound = Math.ceil(maxAbs / 5) * 5
    return { min: -bound, max: bound }
  }, [timelineData])

  // Map differential to Y position (0-100%, inverted because Y=0 is top)
  const getYPosition = (differential: number) => {
    const range = yBounds.max - yBounds.min
    return ((yBounds.max - differential) / range) * 100
  }

  // Generate Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks = []
    const step = Math.ceil((yBounds.max - yBounds.min) / 4)
    for (let i = yBounds.max; i >= yBounds.min; i -= step) {
      ticks.push(i)
    }
    return ticks
  }, [yBounds])

  if (timelineData.length === 0) {
    return (
      <div className="card-premium p-6 text-center text-muted-foreground">
        No timeline data available
      </div>
    )
  }

  const selectedData = selectedNode !== null ? timelineData[selectedNode] : null

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Debate Momentum
        </h3>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-muted-foreground">PRO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-danger" />
            <span className="text-muted-foreground">CON</span>
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="relative pl-12 pr-4">
        {/* Y-axis */}
        <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between items-end pr-2">
          {yTicks.map(tick => (
            <div key={tick} className="text-[10px] text-muted-foreground leading-none">
              {tick > 0 ? `+${tick}` : tick}
            </div>
          ))}
        </div>

        {/* Y-axis label */}
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-muted-foreground whitespace-nowrap">
          Score Differential (PRO − CON)
        </div>

        {/* Chart area */}
        <div className="relative h-48 border-l border-b border-border">
          {/* PRO zone (above center) */}
          <div
            className="absolute left-0 right-0 bg-success/5"
            style={{
              top: 0,
              height: `${getYPosition(0)}%`
            }}
          >
            <span className="absolute top-1 left-1 text-[9px] text-success/50 uppercase tracking-wider">
              PRO Leading
            </span>
          </div>

          {/* CON zone (below center) */}
          <div
            className="absolute left-0 right-0 bg-danger/5"
            style={{
              top: `${getYPosition(0)}%`,
              bottom: 0
            }}
          >
            <span className="absolute bottom-1 left-1 text-[9px] text-danger/50 uppercase tracking-wider">
              CON Leading
            </span>
          </div>

          {/* Zero line */}
          <div
            className="absolute left-0 right-0 h-px bg-border"
            style={{ top: `${getYPosition(0)}%` }}
          />

          {/* Horizontal grid lines */}
          {yTicks.filter(t => t !== 0).map(tick => (
            <div
              key={tick}
              className="absolute left-0 right-0 h-px bg-border/30"
              style={{ top: `${getYPosition(tick)}%` }}
            />
          ))}

          {/* SVG for connecting line */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            {/* Path connecting all points */}
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              d={timelineData.map((data, i) => {
                const x = timelineData.length > 1
                  ? (i / (timelineData.length - 1)) * 100
                  : 50
                const y = getYPosition(data.differential)
                return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`
              }).join(' ')}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--success))" />
                <stop offset="50%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--danger))" />
              </linearGradient>
            </defs>
          </svg>

          {/* Data nodes */}
          {timelineData.map((data, i) => {
            const xPercent = timelineData.length > 1
              ? (i / (timelineData.length - 1)) * 100
              : 50
            const yPercent = getYPosition(data.differential)

            const isSelected = selectedNode === i
            const isHovered = hoveredNode === i
            const hasShift = !!data.shift

            // Node color based on the comment's position
            const nodeColor = data.reply.position === 'pro'
              ? 'bg-success'
              : data.reply.position === 'con'
                ? 'bg-danger'
                : 'bg-zinc-500'

            // Size based on quality (8-16px)
            const baseSize = 8 + (data.reply.qualityScore / 10) * 8

            return (
              <button
                key={data.reply.id}
                onClick={() => setSelectedNode(isSelected ? null : i)}
                onMouseEnter={() => setHoveredNode(i)}
                onMouseLeave={() => setHoveredNode(null)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-full"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                }}
                title={`Comment #${data.commentNumber} by u/${data.reply.author}`}
              >
                {/* Shift indicator ring */}
                {hasShift && (
                  <div
                    className="absolute inset-0 rounded-full bg-warning/50 animate-pulse"
                    style={{
                      width: baseSize + 8,
                      height: baseSize + 8,
                      left: -4,
                      top: -4,
                    }}
                  />
                )}

                {/* Node */}
                <div
                  className={`rounded-full ${nodeColor} ${isSelected || isHovered ? 'ring-2 ring-white shadow-lg' : ''}`}
                  style={{ width: baseSize, height: baseSize }}
                />
              </button>
            )
          })}

          {/* Hover tooltip */}
          <AnimatePresence>
            {hoveredNode !== null && !selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-20 pointer-events-none"
                style={{
                  left: `${timelineData.length > 1 ? (hoveredNode / (timelineData.length - 1)) * 100 : 50}%`,
                  top: `${getYPosition(timelineData[hoveredNode].differential)}%`,
                  transform: 'translate(-50%, -100%) translateY(-12px)'
                }}
              >
                <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs min-w-[150px]">
                  <div className="font-medium text-foreground">
                    #{timelineData[hoveredNode].commentNumber} u/{timelineData[hoveredNode].reply.author}
                  </div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-2">
                    {timelineData[hoveredNode].reply.text.substring(0, 80)}...
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Click to expand
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          {timelineData.length <= 10
            ? timelineData.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))
            : [0, Math.floor(timelineData.length / 2), timelineData.length - 1].map(i => (
              <span key={i} style={{ position: 'absolute', left: `${(i / (timelineData.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}>
                {i + 1}
              </span>
            ))
          }
        </div>

        {/* X-axis label */}
        <div className="text-center text-[10px] text-muted-foreground mt-2">
          Comment #
        </div>
      </div>

      {/* Selected comment detail */}
      <AnimatePresence>
        {selectedData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedData.reply.position === 'pro'
                      ? 'bg-success/20 text-success'
                      : selectedData.reply.position === 'con'
                        ? 'bg-danger/20 text-danger'
                        : 'bg-secondary text-muted-foreground'
                  }`}>
                    {selectedData.reply.position.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    Comment #{selectedData.commentNumber}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    by u/{selectedData.reply.author}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                </button>
              </div>

              {/* Comment text */}
              <div className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {selectedData.reply.text.length > 500
                  ? selectedData.reply.text.substring(0, 500) + '...'
                  : selectedData.reply.text}
              </div>

              {/* Meta info */}
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
                <span>Quality: {selectedData.reply.qualityScore.toFixed(1)}/10</span>
                <span>Score: {selectedData.differential > 0 ? '+' : ''}{selectedData.differential.toFixed(1)}</span>
                {selectedData.shift && (
                  <span className="text-warning">⚡ Momentum Shift: {selectedData.shift.trigger}</span>
                )}
                {onJumpToComment && (
                  <button
                    onClick={() => onJumpToComment(selectedData.reply.id)}
                    className="text-primary hover:underline flex items-center gap-1 ml-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Jump to comment
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score summary */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="text-center p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="text-2xl font-bold text-success">
            {timelineData[timelineData.length - 1]?.runningPro.toFixed(0) || 0}
          </div>
          <div className="text-xs text-muted-foreground">PRO Total Score</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-danger/10 border border-danger/20">
          <div className="text-2xl font-bold text-danger">
            {timelineData[timelineData.length - 1]?.runningCon.toFixed(0) || 0}
          </div>
          <div className="text-xs text-muted-foreground">CON Total Score</div>
        </div>
      </div>

      {/* Momentum shifts list */}
      {debate.momentumShifts && debate.momentumShifts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
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

      {/* Size legend */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span>Node size = Argument quality</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-zinc-500" />
            <span>Weak</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-zinc-500" />
            <span>Strong</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MomentumShiftItemProps {
  shift: MomentumShift
}

function MomentumShiftItem({ shift }: MomentumShiftItemProps) {
  const isPro = shift.toPosition === 'pro'
  const directionColor = isPro ? 'text-success' : 'text-danger'
  const directionBg = isPro ? 'bg-success/10' : 'bg-danger/10'

  return (
    <div className={`${directionBg} rounded-lg p-3 flex items-start gap-3`}>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isPro ? 'bg-success/20' : 'bg-danger/20'}`}>
        {isPro ? (
          <TrendingUp className={`w-3.5 h-3.5 ${directionColor}`} />
        ) : (
          <TrendingDown className={`w-3.5 h-3.5 ${directionColor}`} />
        )}
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
