'use client'

import { useMemo } from 'react'
import type { DebaterArchetype, DebatePosition } from '@/types/debate'

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
 */
export function ParticipantCard({ participant, rank }: ParticipantCardProps) {
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

  return (
    <div className="card-premium p-4 flex items-center gap-4">
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
    </div>
  )
}

interface ParticipantListProps {
  participants: Participant[]
  maxDisplay?: number
}

/**
 * ParticipantList - Display a list of participants sorted by quality
 */
export function ParticipantList({ participants, maxDisplay = 10 }: ParticipantListProps) {
  const sortedParticipants = useMemo(() => {
    return [...participants]
      .sort((a, b) => b.averageQuality - a.averageQuality)
      .slice(0, maxDisplay)
  }, [participants, maxDisplay])

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
        />
      ))}
    </div>
  )
}

export default ParticipantCard
