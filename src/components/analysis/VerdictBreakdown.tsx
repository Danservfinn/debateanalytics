'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  ChevronDown,
  ChevronUp,
  Trophy,
  Users,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react'
import type {
  TraditionalDebateVerdict,
  VotingIssue,
  SpeakerEvaluation,
  BurdenAnalysis
} from '@/types/debate-scoring'

interface VerdictBreakdownProps {
  verdict: TraditionalDebateVerdict
  onJumpToComment?: (commentId: string) => void
}

/**
 * VerdictBreakdown - Detailed explanation of how the debate verdict was determined
 *
 * Shows:
 * - Winner and confidence
 * - Voting issues (key reasons)
 * - Issue breakdown (PRO vs CON wins)
 * - Speaker evaluations
 * - Burden of proof analysis
 */
export function VerdictBreakdown({ verdict, onJumpToComment }: VerdictBreakdownProps) {
  const [expanded, setExpanded] = useState(true)

  const winnerConfig = {
    pro: { label: 'PRO WINS', color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30' },
    con: { label: 'CON WINS', color: 'text-danger', bgColor: 'bg-danger/10', borderColor: 'border-danger/30' },
    draw: { label: 'DRAW', color: 'text-muted-foreground', bgColor: 'bg-muted/10', borderColor: 'border-border' }
  }[verdict.winner]

  return (
    <div className="card-premium overflow-hidden">
      {/* Header with verdict */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 border-b border-border bg-secondary/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Verdict Breakdown</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${winnerConfig.bgColor} ${winnerConfig.color} border ${winnerConfig.borderColor}`}>
            {winnerConfig.label}
          </span>
          <span className="text-sm text-muted-foreground">
            ({verdict.winnerConfidence}% confidence)
          </span>
        </div>
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
              {/* Score comparison */}
              <ScoreComparison verdict={verdict} />

              {/* Voting issues */}
              <VotingIssuesSection votingIssues={verdict.votingIssues} />

              {/* Issue breakdown */}
              <IssueBreakdownSection verdict={verdict} />

              {/* Burden of proof */}
              <BurdenSection burden={verdict.burden} />

              {/* Speaker standings */}
              <SpeakerStandingsSection speakers={verdict.speakers} />

              {/* Judge notes */}
              {verdict.judgeNotes && (
                <JudgeNotesSection notes={verdict.judgeNotes} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ScoreComparison({ verdict }: { verdict: TraditionalDebateVerdict }) {
  const maxScore = Math.max(verdict.proScore, verdict.conScore, 1)

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        Score Comparison
      </h3>

      <div className="space-y-3">
        {/* PRO score bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="font-medium text-success">PRO</span>
            </div>
            <span className="font-bold text-foreground">{verdict.proScore}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(verdict.proScore / maxScore) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-success"
            />
          </div>
        </div>

        {/* CON score bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-danger" />
              <span className="font-medium text-danger">CON</span>
            </div>
            <span className="font-bold text-foreground">{verdict.conScore}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(verdict.conScore / maxScore) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-danger"
            />
          </div>
        </div>

        {/* Margin */}
        <div className="text-center text-xs text-muted-foreground pt-1">
          Margin: {verdict.margin} points
        </div>
      </div>
    </div>
  )
}

function VotingIssuesSection({ votingIssues }: { votingIssues: VotingIssue[] }) {
  if (votingIssues.length === 0) return null

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" />
        Voting Issues (Why the Winner Won)
      </h3>

      <div className="space-y-2">
        {votingIssues.map((issue, idx) => (
          <div
            key={issue.issueId || idx}
            className={`p-3 rounded-lg border ${
              issue.winner === 'pro'
                ? 'bg-success/5 border-success/30'
                : 'bg-danger/5 border-danger/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">#{idx + 1}</span>
                <span className="text-sm font-medium text-foreground">{issue.issue}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  issue.winner === 'pro' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {issue.winner.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Weight: {issue.weight}/10
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{issue.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function IssueBreakdownSection({ verdict }: { verdict: TraditionalDebateVerdict }) {
  const totalIssues = verdict.issuesWonByPro + verdict.issuesWonByCon + verdict.issueDraws

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Scale className="w-3.5 h-3.5" />
        Issue Breakdown
      </h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* PRO wins */}
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
          <div className="text-2xl font-bold text-success">{verdict.issuesWonByPro}</div>
          <div className="text-[10px] text-success font-medium uppercase">PRO Wins</div>
        </div>

        {/* Draws */}
        <div className="p-3 rounded-lg bg-muted/10 border border-border text-center">
          <div className="text-2xl font-bold text-muted-foreground">{verdict.issueDraws}</div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase">Draws</div>
        </div>

        {/* CON wins */}
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-center">
          <div className="text-2xl font-bold text-danger">{verdict.issuesWonByCon}</div>
          <div className="text-[10px] text-danger font-medium uppercase">CON Wins</div>
        </div>
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <span className="text-muted-foreground">PRO Arguments</span>
          <span className="font-medium">{verdict.totalProArguments}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <span className="text-muted-foreground">CON Arguments</span>
          <span className="font-medium">{verdict.totalConArguments}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <span className="text-muted-foreground flex items-center gap-1">
            <XCircle className="w-3 h-3 text-danger" />
            Dropped by PRO
          </span>
          <span className="font-medium text-danger">{verdict.droppedByPro}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
          <span className="text-muted-foreground flex items-center gap-1">
            <XCircle className="w-3 h-3 text-danger" />
            Dropped by CON
          </span>
          <span className="font-medium text-danger">{verdict.droppedByCon}</span>
        </div>
      </div>

      {/* Impact totals */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2">Impact Analysis</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-success/5 border border-success/20">
            <span className="text-success">PRO Impact Total</span>
            <span className="font-bold text-success">{verdict.proImpactTotal.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-danger/5 border border-danger/20">
            <span className="text-danger">CON Impact Total</span>
            <span className="font-bold text-danger">{verdict.conImpactTotal.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BurdenSection({ burden }: { burden: BurdenAnalysis }) {
  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5" />
        Burden of Proof
      </h3>

      <div className="space-y-3">
        {/* Burdens */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded-lg bg-success/5 border border-success/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-success">PRO Must Prove</span>
              {burden.burdenMet.pro ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-danger" />
              )}
            </div>
            <p className="text-[10px] text-foreground">{burden.affirmativeBurden}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-danger/5 border border-danger/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-danger">CON Must Prove</span>
              {burden.burdenMet.con ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-danger" />
              )}
            </div>
            <p className="text-[10px] text-foreground">{burden.negativeBurden}</p>
          </div>
        </div>

        {/* Presumption */}
        <div className="p-2.5 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-medium text-foreground">Presumption</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            If neither side meets their burden, presumption goes to{' '}
            <span className={burden.presumption === 'pro' ? 'text-success font-medium' : burden.presumption === 'con' ? 'text-danger font-medium' : 'text-foreground'}>
              {burden.presumption === 'none' ? 'neither side' : burden.presumption.toUpperCase()}
            </span>
          </p>
        </div>

        {/* Reasoning */}
        {burden.burdenReasoning && (
          <div className="p-2.5 rounded-lg bg-info/5 border border-info/20">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
              <p className="text-[10px] text-foreground">{burden.burdenReasoning}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SpeakerStandingsSection({ speakers }: { speakers: SpeakerEvaluation[] }) {
  const [showDetails, setShowDetails] = useState(false)

  if (speakers.length === 0) return null

  // Sort by speaker points
  const sortedSpeakers = [...speakers].sort((a, b) => b.speakerPoints - a.speakerPoints)

  return (
    <div className="p-4">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Speaker Standings
          <span className="ml-1 px-1.5 py-0.5 rounded bg-secondary text-[10px]">{speakers.length}</span>
        </h3>
        {showDetails ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <div className="space-y-2">
        {sortedSpeakers.map((speaker, idx) => (
          <div
            key={speaker.author}
            className={`p-2.5 rounded-lg border transition-all ${
              speaker.position === 'pro'
                ? 'bg-success/5 border-success/30'
                : 'bg-danger/5 border-danger/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                <span className="text-sm font-medium text-foreground">u/{speaker.author}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  speaker.position === 'pro' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {speaker.position.toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-bold text-foreground">{speaker.speakerPoints} pts</span>
            </div>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-border/50 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Content</div>
                      <div className="text-xs font-medium">{speaker.content}/40</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Style</div>
                      <div className="text-xs font-medium">{speaker.style}/40</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Strategy</div>
                      <div className="text-xs font-medium">{speaker.strategy}/20</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Honesty</div>
                      <div className="text-xs font-medium">{speaker.intellectualHonesty}/10</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div className="p-1 rounded bg-secondary/30">
                      <div className="text-[10px] text-muted-foreground">Arguments</div>
                      <div className="text-xs font-medium">{speaker.argumentsMade}</div>
                    </div>
                    <div className="p-1 rounded bg-success/10">
                      <div className="text-[10px] text-muted-foreground">Won</div>
                      <div className="text-xs font-medium text-success">{speaker.argumentsWon}</div>
                    </div>
                    <div className="p-1 rounded bg-danger/10">
                      <div className="text-[10px] text-muted-foreground">Lost</div>
                      <div className="text-xs font-medium text-danger">{speaker.argumentsLost}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {!showDetails && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Click to see detailed breakdown (Content/Style/Strategy)
        </p>
      )}
    </div>
  )
}

function JudgeNotesSection({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Judge Notes
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
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <p className="text-xs text-foreground whitespace-pre-wrap">{notes}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!expanded && (
        <p className="text-[10px] text-muted-foreground">
          Click to expand detailed judge reasoning
        </p>
      )}
    </div>
  )
}

export default VerdictBreakdown
