'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Brain,
  AlertTriangle,
  Scale,
  Target,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  ArrowRight
} from 'lucide-react'
import type { DebateThread, DebateComment, DebatePosition } from '@/types/debate'
import { ExpandableText } from '@/components/ui/expandable-text'

interface AnalysisPanelProps {
  debate: DebateThread
  proAvgQuality: number
  conAvgQuality: number
  onJumpToComment: (commentId: string) => void
  compact?: boolean
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string | number
  badgeColor?: string
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
  badge,
  badgeColor = 'bg-secondary text-muted-foreground'
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-foreground">{title}</span>
          {badge !== undefined && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-3 border-t border-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Logic type distribution chart
function LogicTypesChart({ replies }: { replies: DebateComment[] }) {
  const logicTypes = {
    deductive: { label: 'Deductive', color: '#3b82f6', icon: '🧠', description: 'Logical certainty from premises' },
    inductive: { label: 'Inductive', color: '#22c55e', icon: '📊', description: 'Probability from observations' },
    analogical: { label: 'Analogical', color: '#f59e0b', icon: '🔄', description: 'Comparison-based reasoning' },
    abductive: { label: 'Abductive', color: '#8b5cf6', icon: '💡', description: 'Best explanation inference' }
  }

  // Mock data - would come from actual analysis
  const distribution = {
    deductive: 35,
    inductive: 28,
    analogical: 22,
    abductive: 15
  }

  const total = Object.values(distribution).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3">
      {Object.entries(logicTypes).map(([key, config]) => {
        const value = distribution[key as keyof typeof distribution]
        const percent = (value / total) * 100

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-1.5">
                <span>{config.icon}</span>
                {config.label}
              </span>
              <span className="text-sm text-muted-foreground">{percent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: config.color }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        )
      })}
    </div>
  )
}

// Rhetorical analysis bars
function RhetoricalBars({ proReplies, conReplies }: { proReplies: DebateComment[]; conReplies: DebateComment[] }) {
  const appeals = [
    { key: 'logos', label: 'Logos (Logic)', icon: '🧠', proValue: 72, conValue: 58 },
    { key: 'ethos', label: 'Ethos (Credibility)', icon: '🎓', proValue: 45, conValue: 68 },
    { key: 'pathos', label: 'Pathos (Emotion)', icon: '❤️', proValue: 33, conValue: 74 }
  ]

  return (
    <div className="space-y-4">
      {appeals.map(appeal => (
        <div key={appeal.key}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm flex items-center gap-1.5">
              <span>{appeal.icon}</span>
              {appeal.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="h-3 rounded-l-full bg-secondary overflow-hidden flex justify-end">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${appeal.proValue}%` }}
                  className="h-full bg-success/70"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0 w-16 justify-center">
              <span className="text-success">{appeal.proValue}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-danger">{appeal.conValue}</span>
            </div>
            <div className="flex-1">
              <div className="h-3 rounded-r-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${appeal.conValue}%` }}
                  className="h-full bg-danger/70"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="text-success">🟢 PRO Side</span>
        <span className="text-danger">🔴 CON Side</span>
      </div>
    </div>
  )
}

// Reasoning chain item with expandable comment text
interface ReasoningChainItem {
  step: number
  text: string
  commentId: string
  commentText: string
  author: string
  position: DebatePosition
  qualityScore: number
}

function ReasoningChainList({
  items,
  onJumpToComment
}: {
  items: ReasoningChainItem[]
  onJumpToComment: (commentId: string) => void
}) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const toggleExpand = (step: number) => {
    setExpandedStep(expandedStep === step ? null : step)
  }

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength).trim() + '...'
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const isExpanded = expandedStep === item.step
        const positionColor = item.position === 'pro'
          ? 'bg-success/20 text-success border-success/30'
          : item.position === 'con'
            ? 'bg-danger/20 text-danger border-danger/30'
            : 'bg-secondary/20 text-muted-foreground border-border'

        return (
          <div key={item.step} className="group">
            {/* Main row - clickable with hover preview */}
            <button
              onClick={() => toggleExpand(item.step)}
              title={!isExpanded ? `"${truncateText(item.commentText, 150)}"` : undefined}
              className={`w-full flex items-start gap-2 p-2 rounded-lg transition-all text-left
                ${isExpanded ? 'bg-secondary/50' : 'hover:bg-secondary/30'}`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium border ${positionColor}`}>
                {item.step}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{item.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  u/{item.author} • {isExpanded ? 'Click to collapse' : 'Click to view argument'}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded comment text */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-8 mt-1 p-3 rounded-lg bg-card border border-border">
                    {/* Comment preview */}
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {item.commentText.length > 500
                        ? truncateText(item.commentText, 500)
                        : item.commentText
                      }
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onJumpToComment(item.commentId)
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Jump to full comment
                      </button>
                      <span className="text-xs text-muted-foreground">
                        Quality: {item.qualityScore.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// Burden of proof timeline
function BurdenOfProofTracker({ momentumShifts }: { momentumShifts?: DebateThread['momentumShifts'] }) {
  const shifts = momentumShifts || [
    { replyNumber: 1, fromPosition: 'neutral' as const, toPosition: 'pro' as const, trigger: 'Initial claim made', qualityDelta: 6 },
    { replyNumber: 5, fromPosition: 'pro' as const, toPosition: 'con' as const, trigger: 'Counter-evidence presented', qualityDelta: -3 },
    { replyNumber: 8, fromPosition: 'con' as const, toPosition: 'pro' as const, trigger: 'Source credibility challenged', qualityDelta: 4 }
  ]

  const positionColors = {
    pro: 'bg-success text-success-foreground',
    con: 'bg-danger text-danger-foreground',
    neutral: 'bg-secondary text-muted-foreground'
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The burden of proof shifted {shifts.length} time{shifts.length !== 1 ? 's' : ''} during this debate.
      </p>

      <div className="relative pl-4 border-l-2 border-border space-y-4">
        {shifts.map((shift, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-background border-2 border-primary" />
            <div className="p-2 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">Reply #{shift.replyNumber}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className={`px-1.5 py-0.5 rounded text-xs ${positionColors[shift.toPosition]}`}>
                  {shift.toPosition.toUpperCase()} holds burden
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{shift.trigger}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 text-sm">
        <span>Final burden holder:</span>
        <span className="font-bold text-primary">
          {shifts.length > 0 ? shifts[shifts.length - 1].toPosition.toUpperCase() : 'UNRESOLVED'}
        </span>
      </div>
    </div>
  )
}

export function AnalysisPanel({
  debate,
  proAvgQuality,
  conAvgQuality,
  onJumpToComment,
  compact = false
}: AnalysisPanelProps) {
  const proReplies = debate.replies.filter(r => r.position === 'pro')
  const conReplies = debate.replies.filter(r => r.position === 'con')

  const allFallacies = debate.replies.flatMap(r =>
    (r.fallacies || []).map(f => ({ ...f, author: r.author, commentId: r.id }))
  )

  const concessions = debate.replies.filter(r => r.isConcession)

  const winnerConfig = {
    pro: { label: 'PRO WINS', color: 'text-success', bg: 'bg-success/20', icon: '🟢' },
    con: { label: 'CON WINS', color: 'text-danger', bg: 'bg-danger/20', icon: '🔴' },
    draw: { label: 'DRAW', color: 'text-warning', bg: 'bg-warning/20', icon: '⚖️' },
    unresolved: { label: 'ONGOING', color: 'text-muted-foreground', bg: 'bg-secondary', icon: '🔄' }
  }[debate.winner]

  // Reasoning chain - build from actual debate data
  const reasoningChain = debate.replies.slice(0, 8).map((reply, index) => {
    const qualityLabel = reply.qualityScore >= 7 ? 'strong' : reply.qualityScore >= 5 ? 'solid' : 'weaker'
    const positionLabel = reply.position === 'pro' ? 'PRO' : reply.position === 'con' ? 'CON' : 'NEUTRAL'

    let action = ''
    if (index === 0) {
      action = 'established initial claim'
    } else if (reply.isConcession) {
      action = 'made a concession'
    } else if (reply.position !== debate.replies[index - 1]?.position) {
      action = 'challenged with counter-argument'
    } else {
      action = 'reinforced position'
    }

    return {
      step: index + 1,
      text: `${positionLabel} ${action} with ${qualityLabel} argument (${reply.qualityScore.toFixed(1)}/10)`,
      commentId: reply.id,
      commentText: reply.text,
      author: reply.author,
      position: reply.position,
      qualityScore: reply.qualityScore
    }
  })

  return (
    <div className={`space-y-4 ${compact ? 'text-sm' : ''}`}>
      {/* Key Clash Summary - At Top */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
        <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
          <span className="text-lg">&#9876;</span> Core Disagreement
        </h4>
        <p className="text-sm text-foreground leading-relaxed">{debate.keyClash}</p>
      </div>

      {/* Interactive Verdict */}
      <div className={`p-4 rounded-xl ${winnerConfig.bg} border border-current/20`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-background/50">
            <Trophy className={`w-6 h-6 ${winnerConfig.color}`} />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${winnerConfig.color}`}>
              {winnerConfig.icon} {winnerConfig.label}
            </h3>
            <p className="text-sm text-muted-foreground">
              Confidence: {Math.round(Math.abs(debate.proScore - debate.conScore) * 10 + 50)}%
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground mb-3">
          {debate.winnerReason}
        </p>

        {/* Score comparison */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="p-2 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold text-success">{proAvgQuality.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">PRO Average</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold text-danger">{conAvgQuality.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">CON Average</div>
          </div>
        </div>

        {/* Expandable reasoning chain */}
        <CollapsibleSection
          title="Reasoning Chain"
          icon={<Brain className="w-4 h-4 text-primary" />}
          defaultOpen={!compact}
        >
          <ReasoningChainList
            items={reasoningChain}
            onJumpToComment={onJumpToComment}
          />
        </CollapsibleSection>
      </div>

      {/* Logic Types */}
      <CollapsibleSection
        title="Logic Types Used"
        icon={<Brain className="w-4 h-4 text-info" />}
        defaultOpen={!compact}
      >
        <LogicTypesChart replies={debate.replies} />
      </CollapsibleSection>

      {/* Fallacies Detected */}
      <CollapsibleSection
        title="Fallacies Detected"
        icon={<AlertTriangle className="w-4 h-4 text-warning" />}
        badge={allFallacies.length}
        badgeColor={allFallacies.length > 0 ? 'bg-warning/20 text-warning' : 'bg-secondary text-muted-foreground'}
      >
        {allFallacies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fallacies detected in this debate.</p>
        ) : (
          <div className="space-y-2">
            {allFallacies.map((fallacy, i) => (
              <div
                key={i}
                className="p-2 rounded-lg bg-warning/10 border border-warning/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-warning capitalize">
                    {fallacy.type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      fallacy.severity === 'high' ? 'bg-danger/20 text-danger' :
                      fallacy.severity === 'medium' ? 'bg-warning/20 text-warning' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {fallacy.severity}
                    </span>
                    <button
                      onClick={() => onJumpToComment(fallacy.commentId)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Jump <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-1">by u/{fallacy.author}</p>
                {fallacy.quote && (
                  <ExpandableText
                    text={`"${fallacy.quote}"`}
                    className="text-xs italic text-foreground/70"
                    lineClamp={2}
                    author={fallacy.author}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Rhetorical Analysis */}
      <CollapsibleSection
        title="Rhetorical Analysis"
        icon={<Scale className="w-4 h-4 text-purple-500" />}
      >
        <RhetoricalBars proReplies={proReplies} conReplies={conReplies} />
      </CollapsibleSection>

      {/* Burden of Proof */}
      <CollapsibleSection
        title="Burden of Proof"
        icon={<Target className="w-4 h-4 text-orange-500" />}
      >
        <BurdenOfProofTracker momentumShifts={debate.momentumShifts} />
      </CollapsibleSection>

      {/* Steel-Manning Quality */}
      <CollapsibleSection
        title="Steel-Manning Quality"
        icon={<Shield className="w-4 h-4 text-cyan-500" />}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            How well did each side represent their opponent's best arguments?
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
              <div className="text-3xl font-bold text-success mb-1">6.8</div>
              <div className="text-xs text-muted-foreground">PRO Steel-Manning</div>
              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-success">
                <TrendingUp className="w-3 h-3" />
                Fair representation
              </div>
            </div>
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-center">
              <div className="text-3xl font-bold text-danger mb-1">4.2</div>
              <div className="text-xs text-muted-foreground">CON Steel-Manning</div>
              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-danger">
                <TrendingDown className="w-3 h-3" />
                Straw-man tendencies
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-2 rounded bg-secondary/50">
            <strong>Assessment:</strong> PRO side showed better understanding of opposing arguments,
            while CON tended to misrepresent PRO positions for easier rebuttal.
          </div>
        </div>
      </CollapsibleSection>

      {/* Concessions */}
      {concessions.length > 0 && (
        <CollapsibleSection
          title="Concessions Made"
          icon={<span className="text-sm">🤝</span>}
          badge={concessions.length}
          badgeColor="bg-primary/20 text-primary"
        >
          <div className="space-y-2">
            {concessions.map(comment => (
              <div
                key={comment.id}
                className="p-2 rounded-lg bg-primary/10 border border-primary/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      comment.position === 'pro' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                    }`}>
                      {comment.position.toUpperCase()}
                    </span>
                    <span className="text-sm text-muted-foreground">u/{comment.author}</span>
                  </div>
                  <button
                    onClick={() => onJumpToComment(comment.id)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <ExpandableText
                  text={comment.text}
                  className="text-sm text-foreground"
                  lineClamp={2}
                  author={comment.author}
                  position={comment.position}
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

    </div>
  )
}

export default AnalysisPanel
