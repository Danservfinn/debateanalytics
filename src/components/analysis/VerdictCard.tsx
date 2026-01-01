"use client"

import { motion } from "framer-motion"
import {
  Target,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  BookOpen,
  TrendingUp,
  HelpCircle,
  Zap
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { DebateVerdict } from "@/types/analysis"

interface VerdictCardProps {
  verdict: DebateVerdict
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-success"
  if (score >= 6) return "text-primary"
  if (score >= 4) return "text-warning"
  return "text-danger"
}

function getScoreLabel(score: number): string {
  if (score >= 8) return "Excellent Debate"
  if (score >= 6) return "Good Debate"
  if (score >= 4) return "Fair Debate"
  if (score >= 2) return "Poor Debate"
  return "Very Poor"
}

function getScoreBg(score: number): string {
  if (score >= 8) return "bg-success/20"
  if (score >= 6) return "bg-primary/20"
  if (score >= 4) return "bg-warning/20"
  return "bg-danger/20"
}

export function VerdictCard({ verdict, className }: VerdictCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Card variant="premium" className="overflow-hidden">
        {/* Header with Score */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Debate Verdict
            </CardTitle>
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full font-bold",
              getScoreBg(verdict.overallScore)
            )}>
              <span className={cn("text-2xl", getScoreColor(verdict.overallScore))}>
                {verdict.overallScore.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
          </div>
          <p className={cn("text-sm font-medium", getScoreColor(verdict.overallScore))}>
            {getScoreLabel(verdict.overallScore)}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Core Dispute */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Core Dispute
            </h3>
            <p className="text-foreground font-medium leading-relaxed">
              {verdict.coreDispute}
            </p>
          </div>

          {/* Evidence Quality Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Evidence Quality</span>
              <span className="font-medium">{verdict.evidenceQualityPct}% claims backed by sources</span>
            </div>
            <Progress value={verdict.evidenceQualityPct} className="h-2" />
          </div>

          {/* Argument Balance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-success">Pro</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{verdict.proStrong}</span>
                <span className="text-sm text-muted-foreground">strong of {verdict.proArguments}</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/20">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-danger" />
                <span className="text-sm font-medium text-danger">Con</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{verdict.conStrong}</span>
                <span className="text-sm text-muted-foreground">strong of {verdict.conArguments}</span>
              </div>
            </div>
          </div>

          {/* Consensus Points */}
          {verdict.consensusPoints.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Consensus Points
              </h3>
              <ul className="space-y-1">
                {verdict.consensusPoints.slice(0, 3).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-success mt-1">•</span>
                    <span className="text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unresolved Questions */}
          {verdict.unresolvedQuestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-warning" />
                Unresolved Questions
              </h3>
              <ul className="space-y-1">
                {verdict.unresolvedQuestions.slice(0, 3).map((question, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-warning mt-1">?</span>
                    <span className="text-muted-foreground">{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red Flags */}
          {verdict.redFlags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger" />
                Red Flags
              </h3>
              <div className="flex flex-wrap gap-2">
                {verdict.redFlags.slice(0, 4).map((flag, i) => (
                  <Badge key={i} variant="danger" className="text-xs">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                {verdict.worthReading ? (
                  <TrendingUp className="w-5 h-5 text-primary" />
                ) : (
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  {verdict.worthReading ? "Worth Reading" : "Consider Skipping"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {verdict.recommendation}
                </p>
              </div>
            </div>
          </div>

          {/* Reading Time */}
          <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Full read: {verdict.readingTimeMinutes} min</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-primary font-medium">
                Optimized: {verdict.optimizedPathMinutes} min
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
