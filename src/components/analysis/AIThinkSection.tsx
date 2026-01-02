'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Globe,
  Lightbulb,
  Scale,
  Info
} from 'lucide-react'
import type { AIAnalysis, AISource } from '@/types/debate'
import { PositionLegend, type PositionDefinitions } from './PositionLegend'

interface AIThinkSectionProps {
  analysis: AIAnalysis
  onJumpToComment?: (commentId: string) => void
  positionDefinitions?: PositionDefinitions
}

/**
 * AIThinkSection - "What Does AI Think?" section
 *
 * Displays AI's structured argument answering the central question
 * with premises, evidence, counterarguments addressed, and conclusion.
 */
export function AIThinkSection({ analysis, onJumpToComment, positionDefinitions }: AIThinkSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showPremises, setShowPremises] = useState(true)
  const [showEvidence, setShowEvidence] = useState(true)
  const [showCounterarguments, setShowCounterarguments] = useState(true)
  const [showSources, setShowSources] = useState(false)

  const positionConfig = {
    pro: {
      label: 'Supports the Proposition',
      color: 'bg-success/20 text-success border-success/30',
      bgColor: 'bg-success/5'
    },
    con: {
      label: 'Opposes the Proposition',
      color: 'bg-danger/20 text-danger border-danger/30',
      bgColor: 'bg-danger/5'
    },
    nuanced: {
      label: 'Nuanced Position',
      color: 'bg-primary/20 text-primary border-primary/30',
      bgColor: 'bg-primary/5'
    }
  }

  const config = positionConfig[analysis.position]
  const threadSources = analysis.sources.filter(s => s.type === 'thread')
  const webSources = analysis.sources.filter(s => s.type === 'web')

  return (
    <div className="card-premium overflow-hidden border-2 border-primary/20">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-foreground">
              What Does AI Think?
            </h3>
            <p className="text-xs text-muted-foreground">
              AI-generated analysis based on thread arguments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Position Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
            {config.label}
          </span>
          {/* Confidence */}
          <span className="text-sm text-muted-foreground">
            {analysis.confidence}% confident
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Central Question */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Central Question
                </p>
                <p className="text-sm font-medium text-foreground">
                  {positionDefinitions?.question || analysis.centralQuestion}
                </p>
                {/* Position Legend */}
                {positionDefinitions && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <PositionLegend definitions={positionDefinitions} variant="inline" />
                  </div>
                )}
              </div>

              {/* Conclusion (highlighted) */}
              <div className={`p-4 rounded-lg border ${config.bgColor} ${config.color.replace('text-', 'border-').split(' ')[2]}`}>
                <div className="flex items-start gap-2 mb-2">
                  <Scale className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    AI's Conclusion
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {analysis.conclusion}
                </p>
              </div>

              {/* Premises Section */}
              <CollapsibleSection
                title="Premises"
                icon={Lightbulb}
                count={analysis.premises.length}
                isOpen={showPremises}
                onToggle={() => setShowPremises(!showPremises)}
              >
                <div className="space-y-3">
                  {analysis.premises.map((premise, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-secondary/30 border border-border">
                      <p className="text-sm text-foreground mb-2">
                        <span className="font-medium text-primary">{idx + 1}.</span> {premise.statement}
                      </p>
                      {premise.supporting.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Supporting:
                          </span>
                          <div className="mt-1 space-y-1">
                            {premise.supporting.map((source, sIdx) => (
                              <SourceChip
                                key={sIdx}
                                source={source}
                                onJumpToComment={onJumpToComment}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Evidence Section */}
              <CollapsibleSection
                title="Evidence"
                icon={CheckCircle2}
                count={analysis.evidence.length}
                isOpen={showEvidence}
                onToggle={() => setShowEvidence(!showEvidence)}
              >
                <div className="space-y-3">
                  {analysis.evidence.map((evidence, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-secondary/30 border border-border">
                      <p className="text-sm text-foreground mb-2">
                        {evidence.claim}
                      </p>
                      {evidence.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Sources:
                          </span>
                          <div className="mt-1 space-y-1">
                            {evidence.sources.map((source, sIdx) => (
                              <SourceChip
                                key={sIdx}
                                source={source}
                                onJumpToComment={onJumpToComment}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Counterarguments Addressed */}
              <CollapsibleSection
                title="Counterarguments Addressed"
                icon={MessageSquare}
                count={analysis.counterargumentsAddressed.length}
                isOpen={showCounterarguments}
                onToggle={() => setShowCounterarguments(!showCounterarguments)}
              >
                <div className="space-y-3">
                  {analysis.counterargumentsAddressed.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-secondary/30 border border-border">
                      <div className="mb-2">
                        <span className="text-[10px] text-danger uppercase tracking-wider font-medium">
                          Counterargument:
                        </span>
                        <p className="text-sm text-foreground mt-1">
                          "{item.counterargument}"
                        </p>
                      </div>
                      <div className="pt-2 border-t border-border/50">
                        <span className="text-[10px] text-success uppercase tracking-wider font-medium">
                          Rebuttal:
                        </span>
                        <p className="text-sm text-foreground mt-1">
                          {item.rebuttal}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Sources Summary */}
              <CollapsibleSection
                title="Sources Used"
                icon={Globe}
                count={analysis.sources.length}
                isOpen={showSources}
                onToggle={() => setShowSources(!showSources)}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Thread Sources */}
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Thread Sources ({threadSources.length})
                      </span>
                    </div>
                    {threadSources.length > 0 ? (
                      <ul className="space-y-1">
                        {threadSources.map((source, idx) => (
                          <li key={idx} className="text-xs text-foreground">
                            <span className="text-muted-foreground">u/{source.author}:</span>{' '}
                            "{source.relevantQuote.substring(0, 80)}..."
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No thread sources cited</p>
                    )}
                  </div>

                  {/* Web Sources */}
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Web Sources ({webSources.length})
                      </span>
                    </div>
                    {webSources.length > 0 ? (
                      <ul className="space-y-1">
                        {webSources.map((source, idx) => (
                          <li key={idx} className="text-xs">
                            {source.url ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                {source.title}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-foreground">{source.title}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No web sources cited</p>
                    )}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Limitations */}
              {analysis.limitations.length > 0 && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-medium text-warning">Limitations</span>
                  </div>
                  <ul className="space-y-1">
                    {analysis.limitations.map((limitation, idx) => (
                      <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-warning">•</span>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-2 rounded bg-secondary/20">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3 h-3 shrink-0" />
                  This analysis was derived solely from arguments presented in this thread. The AI reasoned from first principles without relying on preprogrammed conclusions.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * CollapsibleSection - Reusable collapsible section component
 */
function CollapsibleSection({
  title,
  icon: Icon,
  count,
  isOpen,
  onToggle,
  children
}: {
  title: string
  icon: React.ElementType
  count: number
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between bg-secondary/20 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">
            {count}
          </span>
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
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
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

/**
 * SourceChip - Display a source reference
 */
function SourceChip({
  source,
  onJumpToComment
}: {
  source: AISource
  onJumpToComment?: (commentId: string) => void
}) {
  const credibilityColor = {
    high: 'text-success',
    medium: 'text-warning',
    low: 'text-danger'
  }[source.credibility]

  if (source.type === 'thread') {
    return (
      <div className="inline-flex items-center gap-1 text-xs bg-secondary/50 px-2 py-1 rounded">
        <MessageSquare className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">u/{source.author}:</span>
        <span className="text-foreground truncate max-w-[200px]">
          "{source.relevantQuote.substring(0, 50)}..."
        </span>
        <span className={`text-[10px] ${credibilityColor}`}>
          ({source.credibility})
        </span>
        {source.commentId && onJumpToComment && (
          <button
            onClick={() => onJumpToComment(source.commentId!)}
            className="text-primary hover:underline ml-1"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 text-xs bg-secondary/50 px-2 py-1 rounded">
      <Globe className="w-3 h-3 text-muted-foreground" />
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {source.title}
        </a>
      ) : (
        <span className="text-foreground">{source.title}</span>
      )}
      <span className={`text-[10px] ${credibilityColor}`}>
        ({source.credibility})
      </span>
    </div>
  )
}

export default AIThinkSection
