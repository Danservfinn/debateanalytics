'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import type { DebaterArchetype, DebatePosition, DebateComment } from '@/types/debate'

interface Participant {
  username: string
  commentCount: number
  averageQuality: number
  position: DebatePosition
  archetype?: DebaterArchetype
  isCached: boolean
}

interface ParticipantCardProps {
  participant: Participant
  rank: number
  replies?: DebateComment[]
  onJumpToComment?: (commentId: string) => void
}

// Archetype display configuration
const ARCHETYPE_CONFIG: Record<DebaterArchetype, { label: string; icon: string; color: string }> = {
  the_professor: { label: 'The Professor', icon: '🎓', color: '#3b82f6' },
  the_lawyer: { label: 'The Lawyer', icon: '⚖️', color: '#8b5cf6' },
  the_philosopher: { label: 'The Philosopher', icon: '🤔', color: '#06b6d4' },
  the_warrior: { label: 'The Warrior', icon: '⚔️', color: '#ef4444' },
  the_diplomat: { label: 'The Diplomat', icon: '🕊️', color: '#22c55e' },
  the_socratic: { label: 'The Socratic', icon: '❓', color: '#f59e0b' },
  the_devils_advocate: { label: "Devil's Advocate", icon: '😈', color: '#ec4899' }
}

/**
 * ParticipantCard - Display a debate participant's summary
 *
 * Features:
 * - Archetype badge with icon
 * - Position indicator
 * - Quality score display
 * - Cached profile indicator
 * - Click to expand and view all replies
 */
export function ParticipantCard({ participant, rank, replies = [], onJumpToComment }: ParticipantCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const archetypeConfig = participant.archetype
    ? ARCHETYPE_CONFIG[participant.archetype]
    : null

  const positionColor = useMemo(() => {
    switch (participant.position) {
      case 'pro': return 'text-success'
      case 'con': return 'text-danger'
      default: return 'text-muted-foreground'
    }
  }, [participant.position])

  const qualityIndicator = useMemo(() => {
    if (participant.averageQuality >= 7) return { label: 'Excellent', color: 'text-success' }
    if (participant.averageQuality >= 5) return { label: 'Good', color: 'text-warning' }
    return { label: 'Fair', color: 'text-muted-foreground' }
  }, [participant.averageQuality])

  // Sort replies by quality score
  const sortedReplies = useMemo(() => {
    return [...replies].sort((a, b) => b.qualityScore - a.qualityScore)
  }, [replies])

  const hasReplies = sortedReplies.length > 0

  return (
    <div className="card-premium overflow-hidden">
      {/* Main card - clickable header */}
      <button
        onClick={() => hasReplies && setIsExpanded(!isExpanded)}
        className={`w-full p-4 flex items-center gap-4 text-left transition-colors ${hasReplies ? 'hover:bg-secondary/30 cursor-pointer' : ''}`}
        disabled={!hasReplies}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-sm font-bold text-primary">#{rank}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">
              u/{participant.username}
            </span>
            {participant.isCached && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary">
                Profiled
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs">
            {/* Archetype */}
            {archetypeConfig && (
              <span
                className="flex items-center gap-1"
                style={{ color: archetypeConfig.color }}
              >
                <span>{archetypeConfig.icon}</span>
                <span>{archetypeConfig.label}</span>
              </span>
            )}

            {/* Position */}
            <span className={positionColor}>
              {participant.position.toUpperCase()}
            </span>

            {/* Comment count */}
            <span className="text-muted-foreground">
              {participant.commentCount} comment{participant.commentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Quality Score */}
        <div className="flex-shrink-0 text-right">
          <div className={`text-lg font-bold ${qualityIndicator.color}`}>
            {participant.averageQuality.toFixed(1)}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {qualityIndicator.label}
          </div>
        </div>

        {/* Expand indicator */}
        {hasReplies && (
          <div className="flex-shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        )}
      </button>

      {/* Expandable replies section */}
      <AnimatePresence>
        {isExpanded && sortedReplies.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 bg-secondary/20 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Replies by u/{participant.username}</span>
              </div>

              {sortedReplies.map((reply, idx) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  index={idx + 1}
                  onJumpToComment={onJumpToComment}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * ReplyCard - Display a single reply in the expanded view
 */
function ReplyCard({
  reply,
  index,
  onJumpToComment
}: {
  reply: DebateComment
  index: number
  onJumpToComment?: (commentId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const positionColor = reply.position === 'pro'
    ? 'border-success/30 bg-success/5'
    : reply.position === 'con'
      ? 'border-danger/30 bg-danger/5'
      : 'border-border bg-secondary/30'

  const positionBadgeColor = reply.position === 'pro'
    ? 'bg-success/20 text-success'
    : reply.position === 'con'
      ? 'bg-danger/20 text-danger'
      : 'bg-secondary text-muted-foreground'

  // Truncate long text
  const maxLength = 200
  const isTruncated = reply.text.length > maxLength
  const displayText = isExpanded ? reply.text : (isTruncated ? reply.text.substring(0, maxLength) + '...' : reply.text)

  return (
    <div className={`p-3 rounded-lg border ${positionColor}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${positionBadgeColor}`}>
            {reply.position.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            Quality: {reply.qualityScore.toFixed(1)}/10
          </span>
          {reply.karma > 0 && (
            <span className="text-xs text-muted-foreground">
              {reply.karma} upvotes
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-foreground leading-relaxed">
        "{displayText}"
      </p>

      <div className="flex items-center justify-between mt-2">
        {isTruncated && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-primary hover:underline flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show full reply
              </>
            )}
          </button>
        )}

        {onJumpToComment && (
          <button
            onClick={() => onJumpToComment(reply.id)}
            className="text-[10px] text-primary hover:underline ml-auto"
          >
            View in thread →
          </button>
        )}
      </div>

      {/* Fallacies if present */}
      {reply.fallacies && reply.fallacies.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <span className="text-[10px] text-warning">
            ⚠️ Fallacies detected: {reply.fallacies.map(f => f.type).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

interface ParticipantListProps {
  participants: Participant[]
  maxDisplay?: number
  allReplies?: DebateComment[]
  onJumpToComment?: (commentId: string) => void
}

/**
 * ParticipantList - Display a list of participants sorted by quality
 * Now with clickable participants to view their replies
 */
export function ParticipantList({
  participants,
  maxDisplay = 10,
  allReplies = [],
  onJumpToComment
}: ParticipantListProps) {
  const sortedParticipants = useMemo(() => {
    return [...participants]
      .sort((a, b) => b.averageQuality - a.averageQuality)
      .slice(0, maxDisplay)
  }, [participants, maxDisplay])

  // Create a map of username -> replies for efficient lookup
  const repliesByUser = useMemo(() => {
    const map: Record<string, DebateComment[]> = {}
    allReplies.forEach(reply => {
      if (!map[reply.author]) {
        map[reply.author] = []
      }
      map[reply.author].push(reply)
    })
    return map
  }, [allReplies])

  if (sortedParticipants.length === 0) {
    return (
      <div className="card-premium p-6 text-center text-muted-foreground">
        No participants found
      </div>
    )
  }

  return (
    <div className="space-y-3 stagger-children">
      {sortedParticipants.map((participant, index) => (
        <ParticipantCard
          key={participant.username}
          participant={participant}
          rank={index + 1}
          replies={repliesByUser[participant.username] || []}
          onJumpToComment={onJumpToComment}
        />
      ))}
    </div>
  )
}

export default ParticipantCard
