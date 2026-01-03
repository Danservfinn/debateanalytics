'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
  Target,
  FileCheck,
  GitBranch,
  MessagesSquare,
  Heart,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  Lightbulb,
  Wand2,
  Trophy,
  TrendingUp,
  Award
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScoreRadarChart } from './ScoreRadarChart'
import type {
  ArgumentAnalysisResult,
  ArgumentScore,
  ScoreCriterion
} from '@/types/argument'
import { GRADE_CONFIG, SEVERITY_CONFIG } from '@/types/argument'

interface ArgumentAnalysisResultsProps {
  result: ArgumentAnalysisResult
  originalText: string
  onBack: () => void
  onApplyImproved: (text: string) => void
  onApplyFix?: (fixedText: string) => void
  onClose: () => void
}

const CRITERION_ICONS: Record<ScoreCriterion, React.ComponentType<{ className?: string }>> = {
  claim_clarity: Target,
  evidence_quality: FileCheck,
  logical_structure: GitBranch,
  engagement: MessagesSquare,
  persuasiveness: Sparkles,
  civility: Heart
}

// Local storage key for score history
const SCORE_HISTORY_KEY = 'debate-analytics-score-history'

interface ScoreHistoryEntry {
  score: number
  grade: string
  timestamp: number
}

function getScoreHistory(): ScoreHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SCORE_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addScoreToHistory(score: number, grade: string) {
  if (typeof window === 'undefined') return
  try {
    const history = getScoreHistory()
    history.push({ score, grade, timestamp: Date.now() })
    // Keep only last 50 entries
    const trimmed = history.slice(-50)
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(trimmed))
  } catch (e) {
    console.error('Failed to save score history:', e)
  }
}

// Achievement definitions
interface Achievement {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  check: (result: ArgumentAnalysisResult, history: ScoreHistoryEntry[]) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_analysis',
    name: 'First Steps',
    description: 'Completed your first argument analysis',
    icon: Award,
    check: (_, history) => history.length === 1
  },
  {
    id: 'perfect_civility',
    name: 'Respectful Debater',
    description: 'Achieved 10/10 on civility',
    icon: Heart,
    check: (result) => result.scores.find(s => s.criterion === 'civility')?.score === 10
  },
  {
    id: 'strong_evidence',
    name: 'Evidence Master',
    description: 'Scored 9+ on evidence quality',
    icon: FileCheck,
    check: (result) => (result.scores.find(s => s.criterion === 'evidence_quality')?.score || 0) >= 9
  },
  {
    id: 'debate_ready',
    name: 'Debate Ready',
    description: 'Achieved "Debate Ready" status',
    icon: CheckCircle2,
    check: (result) => result.debateReadiness === 'ready'
  },
  {
    id: 'a_grade',
    name: 'Honor Roll',
    description: 'Earned an A grade or higher',
    icon: Trophy,
    check: (result) => ['A+', 'A', 'A-'].includes(result.letterGrade)
  },
  {
    id: 'consistent_improver',
    name: 'Growth Mindset',
    description: 'Improved your score 3 times in a row',
    icon: TrendingUp,
    check: (_, history) => {
      if (history.length < 4) return false
      const last4 = history.slice(-4)
      return last4[1].score > last4[0].score &&
             last4[2].score > last4[1].score &&
             last4[3].score > last4[2].score
    }
  }
]

export function ArgumentAnalysisResults({
  result,
  originalText,
  onBack,
  onApplyImproved,
  onApplyFix,
  onClose
}: ArgumentAnalysisResultsProps) {
  const [copiedImproved, setCopiedImproved] = useState(false)
  const [showIssues, setShowIssues] = useState(true)
  const [showStrengths, setShowStrengths] = useState(true)
  const [showImproved, setShowImproved] = useState(true)
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set())
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const [showAchievements, setShowAchievements] = useState(false)
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([])

  const gradeConfig = GRADE_CONFIG[result.letterGrade]

  // Track score and check achievements on mount
  useEffect(() => {
    const history = getScoreHistory()
    addScoreToHistory(result.overallScore, result.letterGrade)
    const updatedHistory = getScoreHistory()
    setScoreHistory(updatedHistory)

    // Check for new achievements
    const earnedAchievements = ACHIEVEMENTS.filter(a => a.check(result, updatedHistory))

    // Get previously earned achievements
    const earnedIds = new Set<string>()
    try {
      const stored = localStorage.getItem('earned-achievements')
      if (stored) JSON.parse(stored).forEach((id: string) => earnedIds.add(id))
    } catch {}

    // Find newly earned
    const newlyEarned = earnedAchievements.filter(a => !earnedIds.has(a.id))
    if (newlyEarned.length > 0) {
      setNewAchievements(newlyEarned)
      setShowAchievements(true)
      // Save earned achievements
      newlyEarned.forEach(a => earnedIds.add(a.id))
      localStorage.setItem('earned-achievements', JSON.stringify([...earnedIds]))
    }
  }, [result])

  const handleCopyImproved = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.improvedVersion)
      setCopiedImproved(true)
      setTimeout(() => setCopiedImproved(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [result.improvedVersion])

  const handleApplyFix = useCallback((issueId: string, fixedText: string) => {
    if (onApplyFix) {
      onApplyFix(fixedText)
    }
    setAppliedFixes(prev => new Set([...prev, issueId]))
  }, [onApplyFix])

  const readinessConfig = {
    ready: {
      label: 'Debate Ready',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      icon: CheckCircle2
    },
    needs_work: {
      label: 'Needs Work',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      icon: AlertTriangle
    },
    not_ready: {
      label: 'Not Ready',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      icon: AlertCircle
    }
  }

  const readiness = readinessConfig[result.debateReadiness]
  const ReadinessIcon = readiness.icon

  // Calculate trend from history
  const scoreTrend = scoreHistory.length >= 2
    ? result.overallScore - scoreHistory[scoreHistory.length - 2].score
    : 0

  return (
    <div className="p-6 max-h-[80vh] overflow-y-auto">
      {/* Achievement Popup */}
      <AnimatePresence>
        {showAchievements && newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowAchievements(false)}
          >
            <motion.div
              className="bg-zinc-900 border border-primary/30 rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
              initial={{ rotateX: -15 }}
              animate={{ rotateX: 0 }}
            >
              <div className="text-center mb-4">
                <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-foreground">
                  Achievement Unlocked!
                </h3>
              </div>
              <div className="space-y-3">
                {newAchievements.map(achievement => {
                  const Icon = achievement.icon
                  return (
                    <div
                      key={achievement.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
                    >
                      <div className="p-2 rounded-full bg-primary/20">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{achievement.name}</p>
                        <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => setShowAchievements(false)}
              >
                Awesome!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <DialogHeader className="mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <DialogTitle className="text-xl">Analysis Results</DialogTitle>
        </div>
      </DialogHeader>

      {/* Overall Score with Radar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className={`p-6 rounded-xl border-2 ${gradeConfig.bgColor} border-current/20`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-bold ${gradeConfig.color}`}>
                  {result.letterGrade}
                </span>
                <span className="text-2xl text-muted-foreground">
                  {result.overallScore}/100
                </span>
                {scoreTrend !== 0 && (
                  <span className={`text-sm flex items-center gap-1 ${scoreTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <TrendingUp className={`w-4 h-4 ${scoreTrend < 0 ? 'rotate-180' : ''}`} />
                    {scoreTrend > 0 ? '+' : ''}{scoreTrend}
                  </span>
                )}
              </div>
              <p className={`text-sm ${gradeConfig.color} mt-1`}>
                {gradeConfig.description}
              </p>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${readiness.bgColor} mt-3`}>
                <ReadinessIcon className={`w-4 h-4 ${readiness.color}`} />
                <span className={`text-xs font-medium ${readiness.color}`}>
                  {readiness.label}
                </span>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="hidden md:block">
              <ScoreRadarChart scores={result.scores} size={160} />
            </div>
          </div>

          {/* Mobile Radar Chart */}
          <div className="md:hidden flex justify-center mt-4">
            <ScoreRadarChart scores={result.scores} size={180} />
          </div>
        </div>
      </motion.div>

      {/* Score Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-foreground mb-3">Score Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {result.scores.map((score) => {
            const Icon = CRITERION_ICONS[score.criterion] || Target
            const percentage = score.score * 10
            const barColor =
              percentage >= 80 ? 'bg-green-500' :
              percentage >= 60 ? 'bg-yellow-500' :
              'bg-red-500'

            return (
              <div
                key={score.criterion}
                className="p-3 rounded-lg bg-secondary/30 border border-border"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {score.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${barColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-8 text-right">
                    {score.score}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2">
                  {score.feedback}
                </p>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Strengths */}
      {result.strengths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <button
            onClick={() => setShowStrengths(!showStrengths)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">
                Strengths ({result.strengths.length})
              </span>
            </div>
            {showStrengths ? (
              <ChevronUp className="w-4 h-4 text-green-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-green-400" />
            )}
          </button>
          <AnimatePresence>
            {showStrengths && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {result.strengths.map((strength, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30 border border-border"
                    >
                      <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{strength}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Issues with Apply Fix */}
      {result.issues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-4"
        >
          <button
            onClick={() => setShowIssues(!showIssues)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">
                Issues Found ({result.issues.length})
              </span>
            </div>
            {showIssues ? (
              <ChevronUp className="w-4 h-4 text-orange-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-orange-400" />
            )}
          </button>
          <AnimatePresence>
            {showIssues && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-3">
                  {result.issues.map((issue) => {
                    const severityConfig = SEVERITY_CONFIG[issue.severity]
                    const isApplied = appliedFixes.has(issue.id)

                    return (
                      <div
                        key={issue.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isApplied
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-secondary/30 border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {issue.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {isApplied && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Applied
                            </span>
                          )}
                        </div>
                        {issue.quote && (
                          <div className="mb-2 p-2 rounded bg-secondary/50 border-l-2 border-orange-500/50">
                            <p className="text-xs text-muted-foreground italic">
                              &ldquo;{issue.quote}&rdquo;
                            </p>
                          </div>
                        )}
                        <p className="text-sm text-foreground mb-2">
                          {issue.explanation}
                        </p>
                        <div className="flex items-start gap-2 p-2 rounded bg-primary/5 border border-primary/10">
                          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-primary">
                              <span className="font-medium">Suggestion:</span> {issue.suggestion}
                            </p>
                            {issue.fixedText && !isApplied && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-7 text-xs text-primary hover:text-primary"
                                onClick={() => handleApplyFix(issue.id, issue.fixedText!)}
                              >
                                <Wand2 className="w-3 h-3 mr-1" />
                                Apply Fix
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Improved Version */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <button
          onClick={() => setShowImproved(!showImproved)}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Improved Version
            </span>
          </div>
          {showImproved ? (
            <ChevronUp className="w-4 h-4 text-primary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-primary" />
          )}
        </button>
        <AnimatePresence>
          {showImproved && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    {result.improvementSummary}
                  </p>
                  <div className="p-3 rounded bg-secondary/50 border border-border">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {result.improvedVersion}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyImproved}
                      className="flex-1"
                    >
                      {copiedImproved ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Improved Version
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyImproved(result.improvedVersion)}
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Edit & Reanalyze
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Score History Mini Chart */}
      {scoreHistory.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6 p-4 rounded-lg bg-secondary/20 border border-border"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Your Progress ({scoreHistory.length} analyses)
            </span>
          </div>
          <div className="flex items-end gap-1 h-12">
            {scoreHistory.slice(-10).map((entry, i) => {
              const height = (entry.score / 100) * 100
              const color = entry.score >= 80 ? 'bg-green-500' :
                           entry.score >= 60 ? 'bg-yellow-500' :
                           'bg-red-500'
              return (
                <motion.div
                  key={i}
                  className={`flex-1 rounded-t ${color}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.1 * i }}
                  title={`${entry.score} (${entry.grade})`}
                />
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Edit Argument
        </Button>
        <Button onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

export default ArgumentAnalysisResults
