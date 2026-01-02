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
  ThumbsDown,
  Loader2,
  CheckCircle,
  XCircle,
  Scale,
  Shield,
  Target,
  ExternalLink,
  X
} from 'lucide-react'
import type { DebateComment, DebatePosition } from '@/types/debate'

interface DeepAnalysisResult {
  claims: Array<{
    text: string
    verdict: string
    confidence: number
    sources: Array<{ title: string; url: string; snippet: string; credibility: string }>
    nuance?: string
  }>
  argumentStructure: {
    type: string
    premises: string[]
    conclusion: string
    impliedAssumptions: string[]
    validity: string
    validityReason: string
  }
  soundness: {
    score: number
    strengths: string[]
    weaknesses: string[]
    potentialRebuttals: string[]
  }
  rhetoricalTechniques: Array<{
    technique: string
    quote: string
    effect: string
    effectiveness: string
  }>
  logosScore: number
  ethosScore: number
  pathosScore: number
  overallQuality: number
  summary: string
  analyzedAt: string
}

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
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<DeepAnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Find root-level comments (no parent or parent not in this thread)
  const replyIds = new Set(replies.map(r => r.id))
  const rootReplies = replies.filter(r => !r.parentId || !replyIds.has(r.parentId))

  const handleAnalyze = useCallback(async (comment: DebateComment) => {
    setAnalyzingComment(comment)
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setAnalysisError(null)

    try {
      const response = await fetch('/api/analyze-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          commentText: comment.text,
          author: comment.author,
          position: comment.position,
          threadContext: threadContext || ''
        })
      })

      const result = await response.json()

      if (result.success && result.data) {
        setAnalysisResult(result.data)
      } else {
        setAnalysisError(result.error || 'Analysis failed')
      }
    } catch (err) {
      setAnalysisError('Failed to connect to analysis service')
    } finally {
      setIsAnalyzing(false)
    }
  }, [threadContext])

  const closeAnalysisModal = useCallback(() => {
    setAnalyzingComment(null)
    setAnalysisResult(null)
    setAnalysisError(null)
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

      {/* Per-comment analysis modal */}
      <AnimatePresence>
        {analyzingComment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={closeAnalysisModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-background rounded-xl border border-border shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Deep AI Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      u/{analyzingComment.author} • {analyzingComment.position.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeAnalysisModal}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Original comment */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-sm text-foreground">{analyzingComment.text}</p>
                </div>

                {/* Loading state */}
                {isAnalyzing && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                      <Brain className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-medium">Analyzing argument...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Extracting claims, evaluating logic, checking sources
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-success" /> Extracting claims
                      </span>
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Analyzing argument structure
                      </span>
                      <span className="flex items-center gap-2 opacity-50">
                        <span className="w-3 h-3" /> Evaluating soundness
                      </span>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {analysisError && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-danger/10 text-danger">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-medium">Analysis failed</p>
                      <p className="text-sm opacity-80">{analysisError}</p>
                    </div>
                  </div>
                )}

                {/* Analysis results */}
                {analysisResult && (
                  <div className="space-y-6">
                    {/* Summary & Quality Score */}
                    <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h4 className="font-bold text-foreground mb-1">Analysis Summary</h4>
                          <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
                        </div>
                        <div className="text-center shrink-0">
                          <div className="text-3xl font-bold text-primary">{analysisResult.overallQuality.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Quality</div>
                        </div>
                      </div>

                      {/* Appeal scores */}
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-500">{analysisResult.logosScore}%</div>
                          <div className="text-xs text-muted-foreground">Logos</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-amber-500">{analysisResult.ethosScore}%</div>
                          <div className="text-xs text-muted-foreground">Ethos</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-rose-500">{analysisResult.pathosScore}%</div>
                          <div className="text-xs text-muted-foreground">Pathos</div>
                        </div>
                      </div>
                    </div>

                    {/* Claims */}
                    {analysisResult.claims.length > 0 && (
                      <div>
                        <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-info" />
                          Claims Extracted ({analysisResult.claims.length})
                        </h4>
                        <div className="space-y-2">
                          {analysisResult.claims.map((claim, i) => {
                            const verdictConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
                              true: { color: 'text-success', icon: CheckCircle },
                              mostly_true: { color: 'text-success', icon: CheckCircle },
                              mixed: { color: 'text-warning', icon: Scale },
                              mostly_false: { color: 'text-danger', icon: XCircle },
                              false: { color: 'text-danger', icon: XCircle },
                              unverifiable: { color: 'text-muted-foreground', icon: AlertTriangle }
                            }
                            const config = verdictConfig[claim.verdict] || verdictConfig.unverifiable
                            const VerdictIcon = config.icon

                            return (
                              <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <p className="text-sm text-foreground">{claim.text}</p>
                                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${config.color}`}>
                                    <VerdictIcon className="w-3 h-3" />
                                    {claim.verdict.replace(/_/g, ' ')}
                                  </div>
                                </div>
                                {claim.nuance && (
                                  <p className="text-xs text-muted-foreground italic">{claim.nuance}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Argument Structure */}
                    <div>
                      <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-500" />
                        Argument Structure
                      </h4>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                            {analysisResult.argumentStructure.type.toUpperCase()}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            analysisResult.argumentStructure.validity === 'valid'
                              ? 'bg-success/20 text-success'
                              : analysisResult.argumentStructure.validity === 'invalid'
                              ? 'bg-danger/20 text-danger'
                              : 'bg-warning/20 text-warning'
                          }`}>
                            {analysisResult.argumentStructure.validity.toUpperCase()}
                          </span>
                        </div>

                        {analysisResult.argumentStructure.premises.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Premises:</p>
                            <ul className="space-y-1">
                              {analysisResult.argumentStructure.premises.map((p, i) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                  <span className="text-primary shrink-0">P{i + 1}:</span>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Conclusion:</p>
                          <p className="text-sm text-foreground font-medium">
                            ∴ {analysisResult.argumentStructure.conclusion}
                          </p>
                        </div>

                        <p className="text-xs text-muted-foreground italic">
                          {analysisResult.argumentStructure.validityReason}
                        </p>
                      </div>
                    </div>

                    {/* Soundness */}
                    <div>
                      <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-500" />
                        Soundness ({analysisResult.soundness.score}/10)
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                          <p className="text-xs font-medium text-success mb-2">Strengths</p>
                          <ul className="space-y-1">
                            {analysisResult.soundness.strengths.map((s, i) => (
                              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                <CheckCircle className="w-3 h-3 text-success shrink-0 mt-0.5" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20">
                          <p className="text-xs font-medium text-danger mb-2">Weaknesses</p>
                          <ul className="space-y-1">
                            {analysisResult.soundness.weaknesses.map((w, i) => (
                              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                <XCircle className="w-3 h-3 text-danger shrink-0 mt-0.5" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {analysisResult.soundness.potentialRebuttals.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                          <p className="text-xs font-medium text-warning mb-2">Potential Rebuttals</p>
                          <ul className="space-y-1">
                            {analysisResult.soundness.potentialRebuttals.map((r, i) => (
                              <li key={i} className="text-sm text-foreground">• {r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Rhetorical Techniques */}
                    {analysisResult.rhetoricalTechniques.length > 0 && (
                      <div>
                        <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          Rhetorical Techniques
                        </h4>
                        <div className="space-y-2">
                          {analysisResult.rhetoricalTechniques.map((tech, i) => (
                            <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-foreground">{tech.technique}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  tech.effectiveness === 'high' ? 'bg-success/20 text-success' :
                                  tech.effectiveness === 'medium' ? 'bg-warning/20 text-warning' :
                                  'bg-secondary text-muted-foreground'
                                }`}>
                                  {tech.effectiveness}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground italic mb-1">"{tech.quote}"</p>
                              <p className="text-xs text-muted-foreground">{tech.effect}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs text-muted-foreground/60 text-right pt-2 border-t border-border">
                      Analyzed at {new Date(analysisResult.analyzedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ConversationThread
