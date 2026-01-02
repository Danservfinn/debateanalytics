'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Target,
  Swords,
  BookOpen,
  Handshake,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Quote,
  Info
} from 'lucide-react'
import type {
  DebateThread,
  DebateComment,
  ExecutiveSummaryData,
  StrongestArgument,
  EvidenceLandscape,
  EstablishedItem,
  EstablishedType,
  DebateEvolution,
  DebatePosition
} from '@/types/debate'

interface ExecutiveSummaryProps {
  data: ExecutiveSummaryData
  onJumpToComment?: (commentId: string) => void
}

/**
 * ExecutiveSummary - Comprehensive thread analysis summary
 *
 * Sections:
 * 1. TL;DR - Objective summary
 * 2. Central Question - With PRO/CON definitions
 * 3. Strongest Arguments - Each side
 * 4. Evidence Cited - Split by PRO/CON
 * 5. Points of Agreement
 * 6. Core Disagreements
 * 7. What Was Established
 * 8. How the Debate Evolved
 */
export function ExecutiveSummary({ data, onJumpToComment }: ExecutiveSummaryProps) {
  return (
    <div className="card-premium overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Executive Summary
        </h2>
      </div>

      <div className="divide-y divide-border">
        {/* TL;DR */}
        <TLDRSection tldr={data.tldr} />

        {/* Central Question */}
        <CentralQuestionSection data={data.centralQuestion} />

        {/* Strongest Arguments */}
        <StrongestArgumentsSection
          proArguments={data.strongestProArguments}
          conArguments={data.strongestConArguments}
          onJumpToComment={onJumpToComment}
        />

        {/* Evidence Cited */}
        <EvidenceSection evidence={data.evidenceLandscape} />

        {/* Points of Agreement */}
        <AgreementSection points={data.pointsOfAgreement} />

        {/* Core Disagreements */}
        <DisagreementSection points={data.coreDisagreements} />

        {/* What Was Established */}
        <EstablishedSection
          items={data.established}
          onJumpToComment={onJumpToComment}
        />

        {/* How the Debate Evolved */}
        <EvolutionSection evolution={data.evolution} />
      </div>

      {/* Disclaimer */}
      <div className="p-3 bg-secondary/20 border-t border-border">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3 h-3 shrink-0" />
          Analysis generated from participant statements. "Established" items reflect conclusions reached by discussants, not assessments by this system.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Section Components
// ============================================================================

function TLDRSection({ tldr }: { tldr: string }) {
  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Quote className="w-3.5 h-3.5" />
        TL;DR
      </h3>
      <p className="text-sm text-foreground leading-relaxed">
        {tldr}
      </p>
    </div>
  )
}

function CentralQuestionSection({ data }: { data: ExecutiveSummaryData['centralQuestion'] }) {
  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5" />
        Central Question
      </h3>

      <div className="space-y-3">
        {/* The question */}
        <p className="text-base font-medium text-foreground">
          "{data.question}"
        </p>

        {/* Thread title reference */}
        <p className="text-xs text-muted-foreground">
          Based on thread: "{data.threadTitle}"
        </p>

        {/* PRO/CON definitions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-2.5 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs font-medium text-success">PRO</span>
            </div>
            <p className="text-xs text-foreground">{data.proDefinition}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-danger" />
              <span className="text-xs font-medium text-danger">CON</span>
            </div>
            <p className="text-xs text-foreground">{data.conDefinition}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StrongestArgumentsSection({
  proArguments,
  conArguments,
  onJumpToComment
}: {
  proArguments: StrongestArgument[]
  conArguments: StrongestArgument[]
  onJumpToComment?: (commentId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" />
          Strongest Arguments
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
            <div className="grid md:grid-cols-2 gap-4">
              {/* PRO Arguments */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-medium text-success">PRO Arguments</span>
                </div>
                <div className="space-y-2">
                  {proArguments.slice(0, 2).map((arg, idx) => (
                    <ArgumentCard
                      key={idx}
                      argument={arg}
                      onJumpToComment={onJumpToComment}
                    />
                  ))}
                </div>
              </div>

              {/* CON Arguments */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-danger" />
                  <span className="text-xs font-medium text-danger">CON Arguments</span>
                </div>
                <div className="space-y-2">
                  {conArguments.slice(0, 2).map((arg, idx) => (
                    <ArgumentCard
                      key={idx}
                      argument={arg}
                      onJumpToComment={onJumpToComment}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ArgumentCard({
  argument,
  onJumpToComment
}: {
  argument: StrongestArgument
  onJumpToComment?: (commentId: string) => void
}) {
  const positionColor = argument.position === 'pro'
    ? 'border-success/30 bg-success/5'
    : 'border-danger/30 bg-danger/5'

  return (
    <div className={`p-3 rounded-lg border ${positionColor}`}>
      <p className="text-sm text-foreground leading-relaxed mb-2">
        "{argument.text}"
      </p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>u/{argument.author}</span>
          <span>•</span>
          <span>Quality: {argument.qualityScore.toFixed(1)}/10</span>
          {argument.upvotes && (
            <>
              <span>•</span>
              <span>{argument.upvotes} upvotes</span>
            </>
          )}
        </div>
        {onJumpToComment && (
          <button
            onClick={() => onJumpToComment(argument.commentId)}
            className="text-primary hover:underline flex items-center gap-1"
          >
            View <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
      {argument.evidenceCited && argument.evidenceCited.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground">
            Evidence: {argument.evidenceCited.join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

function EvidenceSection({ evidence }: { evidence: EvidenceLandscape }) {
  const [expanded, setExpanded] = useState(false)

  const maxEvidenceType = (types: Record<string, number>) => {
    const entries = Object.entries(types)
    const max = Math.max(...entries.map(([, v]) => v))
    return max > 0 ? max : 1
  }

  const proMax = maxEvidenceType(evidence.proEvidenceTypes)
  const conMax = maxEvidenceType(evidence.conEvidenceTypes)

  return (
    <div className="p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Evidence Cited
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
            <div className="grid md:grid-cols-2 gap-4">
              {/* PRO Evidence */}
              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-medium text-success">PRO Evidence</span>
                </div>

                {/* Sources list */}
                <ul className="space-y-1 mb-3">
                  {evidence.proEvidence.slice(0, 4).map((item, idx) => (
                    <li key={idx} className="text-xs text-foreground flex items-center justify-between">
                      <span className="truncate">• {item.source}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{item.citationCount}x</span>
                    </li>
                  ))}
                  {evidence.proEvidence.length === 0 && (
                    <li className="text-xs text-muted-foreground italic">No sources cited</li>
                  )}
                </ul>

                {/* Evidence types bar */}
                <div className="space-y-1.5 pt-2 border-t border-success/20">
                  <EvidenceTypeBar label="Academic" value={evidence.proEvidenceTypes.academic} max={proMax} color="bg-success" />
                  <EvidenceTypeBar label="Historical" value={evidence.proEvidenceTypes.historical} max={proMax} color="bg-success" />
                  <EvidenceTypeBar label="Statistical" value={evidence.proEvidenceTypes.statistical} max={proMax} color="bg-success" />
                  <EvidenceTypeBar label="Anecdotal" value={evidence.proEvidenceTypes.anecdotal} max={proMax} color="bg-success" />
                </div>
              </div>

              {/* CON Evidence */}
              <div className="p-3 rounded-lg bg-danger/5 border border-danger/20">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-danger" />
                  <span className="text-xs font-medium text-danger">CON Evidence</span>
                </div>

                {/* Sources list */}
                <ul className="space-y-1 mb-3">
                  {evidence.conEvidence.slice(0, 4).map((item, idx) => (
                    <li key={idx} className="text-xs text-foreground flex items-center justify-between">
                      <span className="truncate">• {item.source}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{item.citationCount}x</span>
                    </li>
                  ))}
                  {evidence.conEvidence.length === 0 && (
                    <li className="text-xs text-muted-foreground italic">No sources cited</li>
                  )}
                </ul>

                {/* Evidence types bar */}
                <div className="space-y-1.5 pt-2 border-t border-danger/20">
                  <EvidenceTypeBar label="Academic" value={evidence.conEvidenceTypes.academic} max={conMax} color="bg-danger" />
                  <EvidenceTypeBar label="Historical" value={evidence.conEvidenceTypes.historical} max={conMax} color="bg-danger" />
                  <EvidenceTypeBar label="Statistical" value={evidence.conEvidenceTypes.statistical} max={conMax} color="bg-danger" />
                  <EvidenceTypeBar label="Anecdotal" value={evidence.conEvidenceTypes.anecdotal} max={conMax} color="bg-danger" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>{evidence.proEvidence.length} sources</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-danger" />
            <span>{evidence.conEvidence.length} sources</span>
          </div>
        </div>
      )}
    </div>
  )
}

function EvidenceTypeBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percent = max > 0 ? (value / max) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-4 text-right">{value}</span>
    </div>
  )
}

function AgreementSection({ points }: { points: string[] }) {
  if (points.length === 0) return null

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Handshake className="w-3.5 h-3.5" />
        Points of Agreement
      </h3>
      <ul className="space-y-2">
        {points.map((point, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DisagreementSection({ points }: { points: string[] }) {
  if (points.length === 0) return null

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Core Disagreements
      </h3>
      <ul className="space-y-2">
        {points.map((point, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
            <span className="text-warning font-bold shrink-0">?</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EstablishedSection({
  items,
  onJumpToComment
}: {
  items: EstablishedItem[]
  onJumpToComment?: (commentId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  const getTypeConfig = (type: EstablishedType) => {
    switch (type) {
      case 'concession_pro':
        return { label: 'Conceded by PRO', color: 'bg-success/10 border-success/30', textColor: 'text-success' }
      case 'concession_con':
        return { label: 'Conceded by CON', color: 'bg-danger/10 border-danger/30', textColor: 'text-danger' }
      case 'mutual_agreement':
        return { label: 'Agreed by Both', color: 'bg-primary/10 border-primary/30', textColor: 'text-primary' }
      case 'correction_accepted':
        return { label: 'Correction Accepted', color: 'bg-info/10 border-info/30', textColor: 'text-info' }
      case 'clarification':
        return { label: 'Clarification Reached', color: 'bg-secondary border-border', textColor: 'text-foreground' }
    }
  }

  return (
    <div className="p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          What Was Established
          <span className="ml-1 px-1.5 py-0.5 rounded bg-secondary text-[10px]">{items.length}</span>
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2"
          >
            {items.map((item, idx) => {
              const config = getTypeConfig(item.type)
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${config.color}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${config.textColor}`} />
                    <span className={`text-xs font-medium ${config.textColor}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-1.5">
                    "{item.text}"
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {item.source && <span>— {item.source}</span>}
                    {item.commentId && onJumpToComment && (
                      <button
                        onClick={() => onJumpToComment(item.commentId!)}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview when collapsed */}
      {!expanded && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} conclusion{items.length !== 1 ? 's' : ''} reached through discussion. Click to expand.
        </p>
      )}
    </div>
  )
}

function EvolutionSection({ evolution }: { evolution: DebateEvolution }) {
  if (!evolution.phases || evolution.phases.length === 0) return null

  const getPositionColor = (position: DebatePosition | 'neutral') => {
    switch (position) {
      case 'pro': return 'bg-success'
      case 'con': return 'bg-danger'
      default: return 'bg-zinc-500'
    }
  }

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        How the Debate Evolved
      </h3>

      {/* Timeline */}
      <div className="flex items-center gap-1 mb-3">
        {evolution.phases.map((phase, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-3 h-3 rounded-full ${getPositionColor(phase.position)}`} />
              <span className="text-[9px] text-muted-foreground mt-1 text-center leading-tight">
                {phase.label}
              </span>
            </div>
            {idx < evolution.phases.length - 1 && (
              <div className="w-full h-0.5 bg-border mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Turning point */}
      {evolution.turningPoint && (
        <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-warning font-medium">&#9889;</span>
            <span className="text-xs font-medium text-warning">Turning Point</span>
          </div>
          <p className="text-xs text-foreground">
            <span className="text-muted-foreground">Comment #{evolution.turningPoint.commentNumber}:</span>{' '}
            {evolution.turningPoint.description}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Impact: {evolution.turningPoint.impact}
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Helper to derive Executive Summary from debates (for components that need it)
// ============================================================================

export function deriveExecutiveSummary(
  debates: DebateThread[],
  threadTitle: string
): ExecutiveSummaryData {
  // Aggregate all replies from all debates
  const allReplies = debates.flatMap(d => d.replies)
  const proReplies = allReplies.filter(r => r.position === 'pro')
  const conReplies = allReplies.filter(r => r.position === 'con')

  // Sort by quality to get strongest arguments
  const sortedPro = [...proReplies].sort((a, b) => b.qualityScore - a.qualityScore)
  const sortedCon = [...conReplies].sort((a, b) => b.qualityScore - a.qualityScore)

  // Derive central question from thread title
  // Strip common patterns like "CMV:", "I don't see", etc.
  let question = threadTitle
    .replace(/^CMV:\s*/i, '')
    .replace(/\?+\s*I don't see it\.?$/i, '')
    .replace(/\?+$/i, '')

  // If it's a statement, convert to question
  if (!question.includes('?')) {
    question = `Is it true that ${question.toLowerCase()}?`
  }

  // Determine PRO/CON definitions based on thread sentiment
  // If thread title is skeptical ("I don't see it"), CON aligns with OP
  const isSkepticalTitle = /don't see|not convinced|disagree|wrong|false/i.test(threadTitle)

  // Calculate wins
  const proWins = debates.filter(d => d.winner === 'pro').length
  const conWins = debates.filter(d => d.winner === 'con').length

  // Build TL;DR
  const tldrParts: string[] = []
  if (debates.length > 0) {
    const mainTopic = threadTitle.replace(/^CMV:\s*/i, '').split('?')[0]
    tldrParts.push(`Discussion centered on ${mainTopic.toLowerCase()}.`)

    if (conWins > proWins) {
      tldrParts.push(`Critics of the position presented stronger arguments, winning ${conWins} of ${debates.length} debates.`)
    } else if (proWins > conWins) {
      tldrParts.push(`Defenders of the position presented stronger arguments, winning ${proWins} of ${debates.length} debates.`)
    } else {
      tldrParts.push(`The debate was evenly contested with no clear winner.`)
    }

    // Add key clash if available
    if (debates[0]?.keyClash) {
      tldrParts.push(`The core disagreement focused on ${debates[0].keyClash.toLowerCase()}.`)
    }
  }

  // Identify concessions
  const concessions: EstablishedItem[] = allReplies
    .filter(r => r.isConcession)
    .map(r => ({
      type: r.position === 'pro' ? 'concession_pro' as const : 'concession_con' as const,
      text: r.text.length > 150 ? r.text.substring(0, 150) + '...' : r.text,
      source: `u/${r.author}`,
      commentId: r.id
    }))

  // Derive evolution phases
  const phases: DebateEvolution['phases'] = []
  if (debates.length > 0 && debates[0].momentumShifts && debates[0].momentumShifts.length > 0) {
    phases.push({ label: 'Start', description: 'Initial positions stated', position: 'neutral' })

    debates[0].momentumShifts.forEach(shift => {
      phases.push({
        label: shift.toPosition === 'pro' ? 'PRO surge' : 'CON surge',
        description: shift.trigger,
        position: shift.toPosition
      })
    })

    phases.push({
      label: debates[0].winner === 'pro' ? 'PRO wins' : debates[0].winner === 'con' ? 'CON wins' : 'Draw',
      description: 'Final outcome',
      position: debates[0].winner === 'draw' ? 'neutral' : debates[0].winner as DebatePosition
    })
  }

  // Find turning point
  let turningPoint: DebateEvolution['turningPoint'] = undefined
  if (debates.length > 0 && debates[0].momentumShifts && debates[0].momentumShifts.length > 0) {
    // Find the most impactful shift (largest quality delta)
    const mostImpactful = debates[0].momentumShifts.reduce((max, shift) =>
      Math.abs(shift.qualityDelta) > Math.abs(max.qualityDelta) ? shift : max
    )
    turningPoint = {
      commentNumber: mostImpactful.replyNumber,
      description: mostImpactful.trigger,
      impact: `Shifted momentum to ${mostImpactful.toPosition.toUpperCase()} side`
    }
  }

  return {
    tldr: tldrParts.join(' '),

    centralQuestion: {
      question,
      threadTitle,
      proDefinition: isSkepticalTitle
        ? `Defends the position against OP's skepticism`
        : `Supports the claim made in the thread`,
      conDefinition: isSkepticalTitle
        ? `Agrees with OP's skepticism`
        : `Opposes the claim made in the thread`
    },

    strongestProArguments: sortedPro.slice(0, 2).map(r => ({
      text: r.text.length > 200 ? r.text.substring(0, 200) + '...' : r.text,
      author: r.author,
      qualityScore: r.qualityScore,
      position: 'pro' as const,
      upvotes: r.karma,
      commentId: r.id
    })),

    strongestConArguments: sortedCon.slice(0, 2).map(r => ({
      text: r.text.length > 200 ? r.text.substring(0, 200) + '...' : r.text,
      author: r.author,
      qualityScore: r.qualityScore,
      position: 'con' as const,
      upvotes: r.karma,
      commentId: r.id
    })),

    evidenceLandscape: {
      proEvidence: [], // Would need NLP to extract
      conEvidence: [], // Would need NLP to extract
      proEvidenceTypes: { academic: 0, historical: 0, anecdotal: 0, statistical: 0 },
      conEvidenceTypes: { academic: 0, historical: 0, anecdotal: 0, statistical: 0 }
    },

    pointsOfAgreement: [], // Would need NLP to extract

    coreDisagreements: debates.slice(0, 3).map(d => d.keyClash),

    established: concessions.slice(0, 5),

    evolution: {
      phases,
      turningPoint
    }
  }
}

export default ExecutiveSummary
