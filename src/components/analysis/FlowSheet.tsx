'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Info
} from 'lucide-react'
import type {
  FlowArgument,
  DebateIssue,
  ClashEvaluation,
  ArgumentStatus
} from '@/types/debate-scoring'

interface FlowSheetProps {
  issues: DebateIssue[]
  arguments: FlowArgument[]
  clashes: ClashEvaluation[]
  onJumpToComment?: (commentId: string) => void
}

/**
 * FlowSheet - Visual display of argument flow in traditional debate format
 *
 * Shows each issue with PRO and CON arguments side by side,
 * indicating which arguments were dropped, refuted, extended, or turned.
 */
export function FlowSheet({ issues, arguments: args, clashes, onJumpToComment }: FlowSheetProps) {
  const [expanded, setExpanded] = useState(true)

  if (issues.length === 0) {
    return null
  }

  return (
    <div className="card-premium overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 border-b border-border bg-secondary/30 flex items-center justify-between"
      >
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          Argument Flow Sheet
        </h2>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border">
              {issues.map((issue, idx) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  index={idx + 1}
                  clashes={clashes.filter(c =>
                    issue.proArguments.some(a => a.id === c.attackerId || a.id === c.defenderId) ||
                    issue.conArguments.some(a => a.id === c.attackerId || a.id === c.defenderId)
                  )}
                  onJumpToComment={onJumpToComment}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="p-3 bg-secondary/20 border-t border-border">
              <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  <span>Extended (unanswered)</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-danger" />
                  <span>Dropped (not addressed)</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-warning" />
                  <span>Refuted</span>
                </div>
                <div className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-info" />
                  <span>Turned (used against maker)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function IssueRow({
  issue,
  index,
  clashes,
  onJumpToComment
}: {
  issue: DebateIssue
  index: number
  clashes: ClashEvaluation[]
  onJumpToComment?: (commentId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  const winnerBadge = {
    pro: { text: 'PRO WINS', color: 'bg-success/20 text-success border-success/30' },
    con: { text: 'CON WINS', color: 'bg-danger/20 text-danger border-danger/30' },
    draw: { text: 'DRAW', color: 'bg-muted/20 text-muted-foreground border-border' }
  }[issue.issueWinner]

  return (
    <div className="p-4">
      {/* Issue header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Issue {index}
          </span>
          <h3 className="text-sm font-semibold text-foreground">{issue.topic}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${winnerBadge.color}`}>
            {winnerBadge.text}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Weight: {issue.issueWeight}/10
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Two-column layout */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* PRO column */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-medium text-success">PRO Arguments</span>
                  <span className="text-[10px] text-muted-foreground">({issue.proArguments.length})</span>
                </div>
                {issue.proArguments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2 bg-secondary/30 rounded">
                    No PRO arguments on this issue
                  </p>
                ) : (
                  issue.proArguments.map(arg => (
                    <ArgumentFlowCard
                      key={arg.id}
                      argument={arg}
                      side="pro"
                      clashes={clashes}
                      onJumpToComment={onJumpToComment}
                    />
                  ))
                )}
              </div>

              {/* CON column */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-danger" />
                  <span className="text-xs font-medium text-danger">CON Arguments</span>
                  <span className="text-[10px] text-muted-foreground">({issue.conArguments.length})</span>
                </div>
                {issue.conArguments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2 bg-secondary/30 rounded">
                    No CON arguments on this issue
                  </p>
                ) : (
                  issue.conArguments.map(arg => (
                    <ArgumentFlowCard
                      key={arg.id}
                      argument={arg}
                      side="con"
                      clashes={clashes}
                      onJumpToComment={onJumpToComment}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Issue reasoning */}
            {issue.reasoning && (
              <div className="mt-3 p-2.5 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{issue.reasoning}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ArgumentFlowCard({
  argument,
  side,
  clashes,
  onJumpToComment
}: {
  argument: FlowArgument
  side: 'pro' | 'con'
  clashes: ClashEvaluation[]
  onJumpToComment?: (commentId: string) => void
}) {
  const statusConfig = getStatusConfig(argument.status)
  const strength = argument.finalEvaluation?.overallStrength || 0

  // Find if this argument was involved in a clash
  const involvedClash = clashes.find(
    c => c.attackerId === argument.id || c.defenderId === argument.id
  )

  const borderColor = side === 'pro'
    ? 'border-success/30 hover:border-success/50'
    : 'border-danger/30 hover:border-danger/50'

  const bgColor = side === 'pro'
    ? 'bg-success/5'
    : 'bg-danger/5'

  return (
    <div
      className={`p-2.5 rounded-lg border ${borderColor} ${bgColor} transition-colors cursor-pointer`}
      onClick={() => onJumpToComment?.(argument.commentId)}
    >
      {/* Status indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {statusConfig.icon}
          <span className={`text-[10px] font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {strength.toFixed(1)}/10
        </span>
      </div>

      {/* Claim */}
      <p className="text-xs text-foreground leading-relaxed mb-1.5">
        "{argument.claim.length > 100 ? argument.claim.substring(0, 100) + '...' : argument.claim}"
      </p>

      {/* Author */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>u/{argument.author}</span>
        {involvedClash && (
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            <span>
              {involvedClash.winner === 'attacker' && involvedClash.attackerId === argument.id
                ? 'Won clash'
                : involvedClash.winner === 'defender' && involvedClash.defenderId === argument.id
                  ? 'Defended'
                  : involvedClash.winner === 'draw'
                    ? 'Draw'
                    : 'Lost clash'}
            </span>
          </div>
        )}
      </div>

      {/* Warrant preview if available */}
      {argument.warrant && (
        <p className="text-[10px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50 line-clamp-2">
          Warrant: {argument.warrant}
        </p>
      )}
    </div>
  )
}

function getStatusConfig(status: ArgumentStatus): {
  icon: React.ReactNode
  label: string
  color: string
} {
  switch (status) {
    case 'extended':
      return {
        icon: <CheckCircle2 className="w-3 h-3 text-success" />,
        label: 'Extended',
        color: 'text-success'
      }
    case 'dropped':
      return {
        icon: <XCircle className="w-3 h-3 text-danger" />,
        label: 'Dropped',
        color: 'text-danger'
      }
    case 'refuted':
      return {
        icon: <AlertTriangle className="w-3 h-3 text-warning" />,
        label: 'Refuted',
        color: 'text-warning'
      }
    case 'turned':
      return {
        icon: <RotateCcw className="w-3 h-3 text-info" />,
        label: 'Turned',
        color: 'text-info'
      }
    case 'conceded':
      return {
        icon: <CheckCircle2 className="w-3 h-3 text-muted-foreground" />,
        label: 'Conceded',
        color: 'text-muted-foreground'
      }
    case 'contested':
    default:
      return {
        icon: <ArrowRight className="w-3 h-3 text-foreground" />,
        label: 'Contested',
        color: 'text-foreground'
      }
  }
}

export default FlowSheet
