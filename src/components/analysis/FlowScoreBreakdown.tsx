'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Swords,
  Target,
  Users,
  ChevronDown,
  ChevronUp,
  Trophy,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Minus,
  TrendingUp,
  TrendingDown,
  Gavel
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  FlowAnalysisResult,
  DebateIssue,
  ClashEvaluation,
  SpeakerEvaluation,
  BurdenAnalysis,
  FlowArgument
} from '@/types/debate-scoring'

interface FlowScoreBreakdownProps {
  flowAnalysis: FlowAnalysisResult
  compact?: boolean // For use in debate cards
  debateTitle?: string // Filter to show only relevant issues
}

/**
 * FlowScoreBreakdown - Traditional debate scoring visualization
 *
 * Shows issue-by-issue breakdown, clash outcomes, speaker rankings,
 * and burden of proof analysis based on flow-based judging methodology.
 */
export function FlowScoreBreakdown({
  flowAnalysis,
  compact = false,
  debateTitle
}: FlowScoreBreakdownProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    compact ? null : 'issues'
  )

  // Calculate summary stats
  const stats = useMemo(() => {
    const proWins = flowAnalysis.issues.filter(i => i.issueWinner === 'pro').length
    const conWins = flowAnalysis.issues.filter(i => i.issueWinner === 'con').length
    const draws = flowAnalysis.issues.filter(i => i.issueWinner === 'draw').length

    const proArgs = flowAnalysis.arguments.filter(a => a.position === 'pro').length
    const conArgs = flowAnalysis.arguments.filter(a => a.position === 'con').length

    const droppedByPro = flowAnalysis.arguments.filter(
      a => a.position === 'con' && a.status === 'dropped'
    ).length
    const droppedByCon = flowAnalysis.arguments.filter(
      a => a.position === 'pro' && a.status === 'dropped'
    ).length

    // Determine overall winner
    let overallWinner: 'pro' | 'con' | 'draw' = 'draw'
    if (proWins > conWins) overallWinner = 'pro'
    else if (conWins > proWins) overallWinner = 'con'

    return {
      proWins,
      conWins,
      draws,
      proArgs,
      conArgs,
      droppedByPro,
      droppedByCon,
      overallWinner,
      totalClashes: flowAnalysis.clashes.length,
      totalIssues: flowAnalysis.issues.length
    }
  }, [flowAnalysis])

  // Top speakers by points
  const topSpeakers = useMemo(() => {
    return [...flowAnalysis.speakers]
      .sort((a, b) => b.speakerPoints - a.speakerPoints)
      .slice(0, 5)
  }, [flowAnalysis.speakers])

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  if (compact) {
    return <CompactFlowScore stats={stats} burden={flowAnalysis.burden} />
  }

  return (
    <div className="space-y-4">
      {/* Header with overall verdict */}
      <div className="card-featured p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Traditional Flow Analysis</h3>
          </div>
          <Badge
            className={
              stats.overallWinner === 'pro' ? 'badge-strong' :
              stats.overallWinner === 'con' ? 'badge-weak' :
              'badge-neutral'
            }
          >
            {stats.overallWinner === 'pro' ? 'PRO Wins on Flow' :
             stats.overallWinner === 'con' ? 'CON Wins on Flow' :
             'Draw on Flow'}
          </Badge>
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox
            icon={Target}
            label="Issues"
            proValue={stats.proWins}
            conValue={stats.conWins}
            draws={stats.draws}
          />
          <StatBox
            icon={Swords}
            label="Arguments"
            proValue={stats.proArgs}
            conValue={stats.conArgs}
          />
          <StatBox
            icon={AlertCircle}
            label="Dropped"
            proValue={stats.droppedByPro}
            conValue={stats.droppedByCon}
            inverted
          />
          <StatBox
            icon={Scale}
            label="Clashes"
            singleValue={stats.totalClashes}
          />
        </div>
      </div>

      {/* Expandable sections */}
      <div className="space-y-2">
        {/* Issues Section */}
        <ExpandableSection
          title="Issues Breakdown"
          icon={Target}
          isExpanded={expandedSection === 'issues'}
          onToggle={() => toggleSection('issues')}
          badge={`${stats.totalIssues} contested`}
        >
          <IssuesGrid issues={flowAnalysis.issues} />
        </ExpandableSection>

        {/* Clashes Section */}
        <ExpandableSection
          title="Key Clashes"
          icon={Swords}
          isExpanded={expandedSection === 'clashes'}
          onToggle={() => toggleSection('clashes')}
          badge={`${stats.totalClashes} exchanges`}
        >
          <ClashesList
            clashes={flowAnalysis.clashes}
            arguments={flowAnalysis.arguments}
          />
        </ExpandableSection>

        {/* Speakers Section */}
        <ExpandableSection
          title="Speaker Rankings"
          icon={Users}
          isExpanded={expandedSection === 'speakers'}
          onToggle={() => toggleSection('speakers')}
          badge={`${flowAnalysis.speakers.length} debaters`}
        >
          <SpeakerRankings speakers={topSpeakers} />
        </ExpandableSection>

        {/* Burden of Proof Section */}
        <ExpandableSection
          title="Burden of Proof"
          icon={Scale}
          isExpanded={expandedSection === 'burden'}
          onToggle={() => toggleSection('burden')}
        >
          <BurdenDisplay burden={flowAnalysis.burden} />
        </ExpandableSection>
      </div>
    </div>
  )
}

// Compact version for debate cards
function CompactFlowScore({
  stats,
  burden
}: {
  stats: ReturnType<typeof useMemo>
  burden: BurdenAnalysis
}) {
  return (
    <div className="border-t border-border mt-4 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Gavel className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Flow Score</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-success/10">
          <div className="text-lg font-bold text-success">{(stats as { proWins: number }).proWins}</div>
          <div className="text-xs text-muted-foreground">PRO Issues</div>
        </div>
        <div className="p-2 rounded-lg bg-zinc-500/10">
          <div className="text-lg font-bold text-zinc-400">{(stats as { draws: number }).draws}</div>
          <div className="text-xs text-muted-foreground">Draws</div>
        </div>
        <div className="p-2 rounded-lg bg-danger/10">
          <div className="text-lg font-bold text-danger">{(stats as { conWins: number }).conWins}</div>
          <div className="text-xs text-muted-foreground">CON Issues</div>
        </div>
      </div>

      {/* Burden met indicator */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Burden Met:</span>
        <div className="flex items-center gap-2">
          <span className={burden.burdenMet.pro ? 'text-success' : 'text-danger'}>
            PRO {burden.burdenMet.pro ? '✓' : '✗'}
          </span>
          <span className={burden.burdenMet.con ? 'text-success' : 'text-danger'}>
            CON {burden.burdenMet.con ? '✓' : '✗'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Stat box component
interface StatBoxProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  proValue?: number
  conValue?: number
  draws?: number
  singleValue?: number
  inverted?: boolean // For "dropped" where lower is better
}

function StatBox({ icon: Icon, label, proValue, conValue, draws, singleValue, inverted }: StatBoxProps) {
  if (singleValue !== undefined) {
    return (
      <div className="p-3 rounded-lg bg-secondary/50 text-center">
        <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
        <div className="text-lg font-bold text-foreground">{singleValue}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-lg bg-secondary/50">
      <div className="flex items-center justify-center gap-1 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className={`font-bold ${inverted ? 'text-danger' : 'text-success'}`}>
          {proValue}
        </span>
        {draws !== undefined && (
          <>
            <span className="text-muted-foreground">-</span>
            <span className="font-bold text-zinc-400">{draws}</span>
          </>
        )}
        <span className="text-muted-foreground">-</span>
        <span className={`font-bold ${inverted ? 'text-success' : 'text-danger'}`}>
          {conValue}
        </span>
      </div>
    </div>
  )
}

// Expandable section wrapper
interface ExpandableSectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  isExpanded: boolean
  onToggle: () => void
  badge?: string
  children: React.ReactNode
}

function ExpandableSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  badge,
  children
}: ExpandableSectionProps) {
  return (
    <div className="card-premium overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{title}</span>
          {badge && (
            <Badge variant="neutral" className="text-xs">
              {badge}
            </Badge>
          )}
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
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 border-t border-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Issues grid
function IssuesGrid({ issues }: { issues: DebateIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No contested issues identified
      </p>
    )
  }

  return (
    <div className="space-y-3 mt-4">
      {issues.map((issue, idx) => (
        <IssueCard key={issue.id} issue={issue} index={idx} />
      ))}
    </div>
  )
}

function IssueCard({ issue, index }: { issue: DebateIssue; index: number }) {
  const winnerConfig = {
    pro: { icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', label: 'PRO Wins' },
    con: { icon: TrendingDown, color: 'text-danger', bg: 'bg-danger/10', label: 'CON Wins' },
    draw: { icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: 'Draw' }
  }

  const config = winnerConfig[issue.issueWinner]
  const WinnerIcon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-3 rounded-lg border ${config.bg} border-border`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Issue #{index + 1}</span>
            <Badge className={`${config.bg} ${config.color} text-xs`}>
              <WinnerIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
          <h4 className="font-medium text-foreground text-sm">{issue.topic}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {issue.description}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Weight</div>
          <div className="font-bold text-foreground">{issue.issueWeight.toFixed(1)}</div>
        </div>
      </div>

      {/* Argument counts */}
      <div className="flex items-center gap-4 mt-2 text-xs">
        <span className="text-success">
          {issue.proArguments.length} PRO args
        </span>
        <span className="text-danger">
          {issue.conArguments.length} CON args
        </span>
        <span className="text-muted-foreground">
          {issue.clashes.length} clashes
        </span>
      </div>

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-2">
        {issue.reasoning}
      </p>
    </motion.div>
  )
}

// Clashes list
function ClashesList({
  clashes,
  arguments: args
}: {
  clashes: ClashEvaluation[]
  arguments: FlowArgument[]
}) {
  // Only show top clashes by quality
  const topClashes = useMemo(() => {
    return [...clashes]
      .sort((a, b) => b.clashQuality - a.clashQuality)
      .slice(0, 5)
  }, [clashes])

  if (topClashes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No direct clashes identified
      </p>
    )
  }

  const getArgument = (id: string) => args.find(a => a.id === id)

  return (
    <div className="space-y-3 mt-4">
      {topClashes.map((clash, idx) => {
        const attacker = getArgument(clash.attackerId)
        const defender = getArgument(clash.defenderId)

        return (
          <motion.div
            key={clash.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-3 rounded-lg bg-secondary/30 border border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <Badge variant="neutral" className="text-xs capitalize">
                {clash.clashType.replace(/_/g, ' ')}
              </Badge>
              <div className="flex items-center gap-1">
                {clash.winner === 'attacker' ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : clash.winner === 'defender' ? (
                  <XCircle className="w-4 h-4 text-danger" />
                ) : (
                  <Minus className="w-4 h-4 text-zinc-400" />
                )}
                <span className="text-xs text-muted-foreground">
                  Quality: {clash.clashQuality.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-2 rounded ${attacker?.position === 'pro' ? 'bg-success/10' : 'bg-danger/10'}`}>
                <span className={attacker?.position === 'pro' ? 'text-success' : 'text-danger'}>
                  Attacker ({attacker?.position?.toUpperCase()})
                </span>
                <p className="text-foreground mt-1 line-clamp-2">
                  {attacker?.claim || 'Unknown'}
                </p>
              </div>
              <div className={`p-2 rounded ${defender?.position === 'pro' ? 'bg-success/10' : 'bg-danger/10'}`}>
                <span className={defender?.position === 'pro' ? 'text-success' : 'text-danger'}>
                  Defender ({defender?.position?.toUpperCase()})
                </span>
                <p className="text-foreground mt-1 line-clamp-2">
                  {defender?.claim || 'Unknown'}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2 italic">
              {clash.winnerReasoning}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}

// Speaker rankings
function SpeakerRankings({ speakers }: { speakers: SpeakerEvaluation[] }) {
  if (speakers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No speakers evaluated
      </p>
    )
  }

  return (
    <div className="space-y-2 mt-4">
      {speakers.map((speaker, idx) => (
        <motion.div
          key={speaker.author}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
        >
          {/* Rank */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
            idx === 1 ? 'bg-zinc-400/20 text-zinc-400' :
            idx === 2 ? 'bg-amber-700/20 text-amber-700' :
            'bg-secondary text-muted-foreground'
          }`}>
            {idx + 1}
          </div>

          {/* Name & position */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground text-sm truncate">
                u/{speaker.author}
              </span>
              <Badge
                className={`text-xs ${
                  speaker.position === 'pro' ? 'badge-strong' : 'badge-weak'
                }`}
              >
                {speaker.position.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>W: {speaker.argumentsWon}</span>
              <span>L: {speaker.argumentsLost}</span>
              <span>IH: {speaker.intellectualHonesty.toFixed(1)}</span>
            </div>
          </div>

          {/* Speaker points */}
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">
              {speaker.speakerPoints}
            </div>
            <div className="text-xs text-muted-foreground">points</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// Burden of proof display
function BurdenDisplay({ burden }: { burden: BurdenAnalysis }) {
  return (
    <div className="space-y-4 mt-4">
      {/* Burdens */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-success">PRO Burden</span>
            {burden.burdenMet.pro ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <XCircle className="w-4 h-4 text-danger" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {burden.affirmativeBurden}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-danger">CON Burden</span>
            {burden.burdenMet.con ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <XCircle className="w-4 h-4 text-danger" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {burden.negativeBurden}
          </p>
        </div>
      </div>

      {/* Presumption */}
      <div className="p-3 rounded-lg bg-secondary/50">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Presumption</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {burden.presumption === 'pro'
            ? 'PRO has presumption (wins if burden not clearly met by either side)'
            : burden.presumption === 'con'
            ? 'CON has presumption (status quo favored)'
            : 'No clear presumption established'
          }
        </p>
      </div>

      {/* Reasoning */}
      <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
        <p className="text-sm text-foreground">
          {burden.burdenReasoning}
        </p>
      </div>
    </div>
  )
}

export default FlowScoreBreakdown
