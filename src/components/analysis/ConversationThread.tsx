'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  User,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import type { DebateComment, DebatePosition } from '@/types/debate'

interface ConversationThreadProps {
  replies: DebateComment[]
  highlightedCommentId: string | null
  threadContext?: string
  onCommentClick: (commentId: string) => void
}

interface CommentNodeProps {
  comment: DebateComment
  allReplies: DebateComment[]
  depth: number
  isHighlighted: boolean
  onCommentClick: (commentId: string) => void
  onAnalyze: (comment: DebateComment) => void
}

const positionConfig: Record<DebatePosition, { label: string; bg: string; color: string; icon: string }> = {
  pro: { label: 'PRO', bg: 'bg-success/20', color: 'text-success', icon: '🟢' },
  con: { label: 'CON', bg: 'bg-danger/20', color: 'text-danger', icon: '🔴' },
  neutral: { label: 'NEUTRAL', bg: 'bg-secondary', color: 'text-muted-foreground', icon: '⚪' }
}

const logicTypeLabels: Record<string, { label: string; icon: string }> = {
  deductive: { label: 'Deductive', icon: '🧠' },
  inductive: { label: 'Inductive', icon: '📊' },
  analogical: { label: 'Analogical', icon: '🔄' },
  abductive: { label: 'Abductive', icon: '💡' }
}

function CommentNode({ comment, allReplies, depth, isHighlighted, onCommentClick, onAnalyze }: CommentNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(depth >= 3)
  const [showAnalysisButton, setShowAnalysisButton] = useState(false)

  // Find direct children
  const children = allReplies.filter(r => r.parentId === comment.id)
  const hasChildren = children.length > 0

  const position = positionConfig[comment.position]
  const qualityPercent = (comment.qualityScore / 10) * 100
  const fallacyCount = comment.fallacies?.length || 0
  const claimCount = comment.claims?.length || 0

  return (
    <div className="relative">
      {/* Connecting line for nested comments */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px bg-border"
          style={{ left: '-16px' }}
        />
      )}

      {/* Comment card */}
      <motion.div
        id={`comment-${comment.id}`}
        initial={{ opacity: 0, x: -10 }}
        animate={{
          opacity: 1,
          x: 0,
          backgroundColor: isHighlighted ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent'
        }}
        transition={{ duration: 0.3 }}
        className={`relative rounded-lg border transition-all duration-300 ${
          isHighlighted
            ? 'border-primary ring-2 ring-primary/30'
            : 'border-border hover:border-primary/50'
        }`}
        onMouseEnter={() => setShowAnalysisButton(true)}
        onMouseLeave={() => setShowAnalysisButton(false)}
        onClick={() => onCommentClick(comment.id)}
      >
        {/* Horizontal connector for nested */}
        {depth > 0 && (
          <div
            className="absolute w-4 h-px bg-border top-6"
            style={{ left: '-16px' }}
          />
        )}

        <div className="p-3 md:p-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Position badge */}
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${position.bg} ${position.color}`}>
                {position.icon} {position.label}
              </span>

              {/* Author */}
              <span className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                <User className="w-3 h-3 shrink-0" />
                u/{comment.author}
              </span>
            </div>

            {/* Quality score */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${qualityPercent}%`,
                      backgroundColor: comment.qualityScore >= 7 ? '#22c55e'
                        : comment.qualityScore >= 5 ? '#f59e0b'
                        : '#ef4444'
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {comment.qualityScore.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Comment body */}
          <p className="text-sm text-foreground leading-relaxed mb-3">
            {comment.text.length > 300 && !isHighlighted
              ? `${comment.text.slice(0, 300)}...`
              : comment.text}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Claims count */}
            {claimCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/10 text-info">
                📝 {claimCount} claim{claimCount > 1 ? 's' : ''}
              </span>
            )}

            {/* Fallacies count */}
            {fallacyCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                <AlertTriangle className="w-3 h-3" />
                {fallacyCount} fallac{fallacyCount > 1 ? 'ies' : 'y'}
              </span>
            )}

            {/* Concession marker */}
            {comment.isConcession && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                🤝 Concession
              </span>
            )}

            {/* Karma */}
            <span className="flex items-center gap-1 text-muted-foreground ml-auto">
              {comment.karma >= 0 ? (
                <ThumbsUp className="w-3 h-3" />
              ) : (
                <ThumbsDown className="w-3 h-3" />
              )}
              {comment.karma}
            </span>

            {/* AI Analysis button - shows on hover */}
            <AnimatePresence>
              {showAnalysisButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onAnalyze(comment)
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  AI Analysis
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Fallacy details if present */}
          {fallacyCount > 0 && isHighlighted && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <h5 className="text-xs font-semibold text-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Fallacies Detected
              </h5>
              {comment.fallacies?.map((fallacy, i) => (
                <div key={i} className="text-xs p-2 rounded bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-warning capitalize">
                      {fallacy.type.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      fallacy.severity === 'high' ? 'bg-danger/20 text-danger' :
                      fallacy.severity === 'medium' ? 'bg-warning/20 text-warning' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {fallacy.severity}
                    </span>
                  </div>
                  {fallacy.quote && (
                    <p className="text-muted-foreground italic">"{fallacy.quote}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collapse/Expand button for threads with children */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsCollapsed(!isCollapsed)
            }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {isCollapsed ? (
              <>
                <ChevronRight className="w-3 h-3" />
                {children.length} repl{children.length > 1 ? 'ies' : 'y'}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Collapse
              </>
            )}
          </button>
        )}
      </motion.div>

      {/* Nested children */}
      <AnimatePresence>
        {hasChildren && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-6 mt-4 space-y-4 relative"
          >
            {children.map(child => (
              <CommentNode
                key={child.id}
                comment={child}
                allReplies={allReplies}
                depth={depth + 1}
                isHighlighted={false}
                onCommentClick={onCommentClick}
                onAnalyze={onAnalyze}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ConversationThread({
  replies,
  highlightedCommentId,
  threadContext,
  onCommentClick
}: ConversationThreadProps) {
  const [analyzingComment, setAnalyzingComment] = useState<DebateComment | null>(null)

  // Find root-level comments (no parent or parent not in this thread)
  const replyIds = new Set(replies.map(r => r.id))
  const rootReplies = replies.filter(r => !r.parentId || !replyIds.has(r.parentId))

  const handleAnalyze = useCallback((comment: DebateComment) => {
    setAnalyzingComment(comment)
    // TODO: Open analysis modal/panel
    console.log('Analyze comment:', comment.id)
  }, [])

  if (replies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No comments in this debate</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Thread stats header */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pb-3 border-b border-border">
        <span>{replies.length} comments in thread</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            {replies.filter(r => r.position === 'pro').length} PRO
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger" />
            {replies.filter(r => r.position === 'con').length} CON
          </span>
        </div>
      </div>

      {/* Comment tree */}
      <div className="space-y-4">
        {rootReplies.map(comment => (
          <CommentNode
            key={comment.id}
            comment={comment}
            allReplies={replies}
            depth={0}
            isHighlighted={highlightedCommentId === comment.id}
            onCommentClick={onCommentClick}
            onAnalyze={handleAnalyze}
          />
        ))}
      </div>

      {/* Per-comment analysis modal placeholder */}
      <AnimatePresence>
        {analyzingComment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
            onClick={() => setAnalyzingComment(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-background rounded-xl border border-border shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Deep AI Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyzing argument by u/{analyzingComment.author}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary/30 border border-border mb-4">
                <p className="text-sm text-foreground italic">"{analyzingComment.text}"</p>
              </div>

              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span>Premium feature - Coming soon</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Deep analysis with source verification requires Claude Agent SDK
                </p>
              </div>

              <button
                onClick={() => setAnalyzingComment(null)}
                className="w-full py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ConversationThread
