'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
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
  Lightbulb
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type {
  ArgumentAnalysisResult,
  ArgumentScore,
  ArgumentIssue,
  ScoreCriterion
} from '@/types/argument'
import { GRADE_CONFIG, SEVERITY_CONFIG } from '@/types/argument'

interface ArgumentAnalysisResultsProps {
  result: ArgumentAnalysisResult
  originalText: string
  onBack: () => void
  onApplyImproved: (text: string) => void
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

export function ArgumentAnalysisResults({
  result,
  originalText,
  onBack,
  onApplyImproved,
  onClose
}: ArgumentAnalysisResultsProps) {
  const [copiedImproved, setCopiedImproved] = useState(false)
  const [showIssues, setShowIssues] = useState(true)
  const [showStrengths, setShowStrengths] = useState(true)
  const [showImproved, setShowImproved] = useState(true)

  const gradeConfig = GRADE_CONFIG[result.letterGrade]

  const handleCopyImproved = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.improvedVersion)
      setCopiedImproved(true)
      setTimeout(() => setCopiedImproved(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [result.improvedVersion])

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

  return (
    <div className="p-6">
      {/* Header */}
      <DialogHeader className="mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <DialogTitle className="text-xl">Analysis Results</DialogTitle>
        </div>
      </DialogHeader>

      {/* Overall Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className={`p-6 rounded-xl border-2 ${gradeConfig.bgColor} border-current/20`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-bold ${gradeConfig.color}`}>
                  {result.letterGrade}
                </span>
                <span className="text-2xl text-muted-foreground">
                  {result.overallScore}/100
                </span>
              </div>
              <p className={`text-sm ${gradeConfig.color} mt-1`}>
                {gradeConfig.description}
              </p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${readiness.bgColor}`}>
              <ReadinessIcon className={`w-5 h-5 ${readiness.color}`} />
              <span className={`text-sm font-medium ${readiness.color}`}>
                {readiness.label}
              </span>
            </div>
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
          {showStrengths && (
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
          )}
        </motion.div>
      )}

      {/* Issues */}
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
          {showIssues && (
            <div className="mt-2 space-y-3">
              {result.issues.map((issue) => {
                const severityConfig = SEVERITY_CONFIG[issue.severity]
                return (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg bg-secondary/30 border border-border"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}>
                        {severityConfig.label}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {issue.type.replace(/_/g, ' ')}
                      </span>
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
                      <p className="text-xs text-primary">
                        <span className="font-medium">Suggestion:</span> {issue.suggestion}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
        {showImproved && (
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
        )}
      </motion.div>

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
