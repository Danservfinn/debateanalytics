'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Swords, ExternalLink } from 'lucide-react'
import type { DebateThread, DebateComment } from '@/types/debate'
import { ConversationThread } from './ConversationThread'
import { AnalysisPanel } from './AnalysisPanel'

interface DebateDetailModalProps {
  debate: DebateThread | null
  isOpen: boolean
  onClose: () => void
  threadContext?: string
}

export function DebateDetailModal({ debate, isOpen, onClose, threadContext }: DebateDetailModalProps) {
  const router = useRouter()
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const [isMobileAnalysisOpen, setIsMobileAnalysisOpen] = useState(false)

  const handleOpenArena = useCallback(() => {
    if (debate) {
      onClose()
      // Use debate ID as arena ID
      router.push(`/arena/${debate.id}`)
    }
  }, [debate, onClose, router])

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleJumpToComment = useCallback((commentId: string) => {
    setHighlightedCommentId(commentId)
    // Scroll to comment in thread
    const element = document.getElementById(`comment-${commentId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Clear highlight after animation
      setTimeout(() => setHighlightedCommentId(null), 2000)
    }
  }, [])

  if (!debate) return null

  // Calculate stats
  const proReplies = debate.replies.filter(r => r.position === 'pro')
  const conReplies = debate.replies.filter(r => r.position === 'con')
  const proAvgQuality = proReplies.length > 0
    ? proReplies.reduce((sum, r) => sum + r.qualityScore, 0) / proReplies.length
    : 0
  const conAvgQuality = conReplies.length > 0
    ? conReplies.reduce((sum, r) => sum + r.qualityScore, 0) / conReplies.length
    : 0

  const winnerConfig = {
    pro: { label: 'PRO WINS', color: 'text-success', bg: 'bg-success/20' },
    con: { label: 'CON WINS', color: 'text-danger', bg: 'bg-danger/20' },
    draw: { label: 'DRAW', color: 'text-muted-foreground', bg: 'bg-secondary' },
    unresolved: { label: 'ONGOING', color: 'text-warning', bg: 'bg-warning/20' }
  }[debate.winner]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-8 lg:inset-12 bg-background rounded-xl border border-border shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${winnerConfig.bg} ${winnerConfig.color}`}>
                    {winnerConfig.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {debate.replies.length} comments
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-foreground truncate">
                  {debate.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Arena button */}
                <button
                  className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  onClick={handleOpenArena}
                >
                  <Swords className="w-4 h-4" />
                  <span className="text-sm font-medium">Debate Arena</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content - Split View on Desktop */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Conversation Thread (Left) */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 md:border-r border-border">
                <ConversationThread
                  replies={debate.replies}
                  highlightedCommentId={highlightedCommentId}
                  threadContext={threadContext}
                  onCommentClick={setHighlightedCommentId}
                />
              </div>

              {/* Analysis Panel (Right) - Hidden on Mobile */}
              <div className="hidden md:block w-[400px] lg:w-[450px] overflow-y-auto p-4 md:p-6 bg-secondary/20">
                <AnalysisPanel
                  debate={debate}
                  proAvgQuality={proAvgQuality}
                  conAvgQuality={conAvgQuality}
                  onJumpToComment={handleJumpToComment}
                />
              </div>
            </div>

            {/* Mobile Sticky Analysis Bar */}
            <div className="md:hidden border-t border-border bg-background">
              <button
                onClick={() => setIsMobileAnalysisOpen(!isMobileAnalysisOpen)}
                className="w-full p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${winnerConfig.color}`}>
                    {winnerConfig.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {debate.replies.filter(r => r.fallacies && r.fallacies.length > 0).length} fallacies
                  </span>
                </div>
                <motion.span
                  animate={{ rotate: isMobileAnalysisOpen ? 180 : 0 }}
                  className="text-muted-foreground"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </motion.span>
              </button>

              {/* Mobile Analysis Bottom Sheet */}
              <AnimatePresence>
                {isMobileAnalysisOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="max-h-[60vh] overflow-y-auto p-4 bg-secondary/20">
                      <AnalysisPanel
                        debate={debate}
                        proAvgQuality={proAvgQuality}
                        conAvgQuality={conAvgQuality}
                        onJumpToComment={(id) => {
                          handleJumpToComment(id)
                          setIsMobileAnalysisOpen(false)
                        }}
                        compact
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default DebateDetailModal
