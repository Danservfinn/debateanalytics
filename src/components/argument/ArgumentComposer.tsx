'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  PenSquare,
  Send,
  Loader2,
  Info,
  ThumbsUp,
  ThumbsDown,
  Minus,
  HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { ArgumentAnalysisResults } from './ArgumentAnalysisResults'
import type { ArgumentPosition, ArgumentContext, ArgumentAnalysisResult } from '@/types/argument'

interface ArgumentComposerProps {
  isOpen: boolean
  onClose: () => void
  context: ArgumentContext
}

const POSITION_CONFIG = {
  pro: {
    label: 'PRO',
    description: 'Supporting the proposition',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
    icon: ThumbsUp
  },
  con: {
    label: 'CON',
    description: 'Challenging the proposition',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
    icon: ThumbsDown
  },
  neutral: {
    label: 'NEUTRAL',
    description: 'Balanced perspective',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/20',
    borderColor: 'border-zinc-500/50',
    icon: Minus
  }
}

const MAX_CHARS = 2000
const MIN_CHARS = 20

export function ArgumentComposer({ isOpen, onClose, context }: ArgumentComposerProps) {
  const [position, setPosition] = useState<ArgumentPosition>('pro')
  const [text, setText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ArgumentAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const charCount = text.length
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS
  const canSubmit = isValidLength && !isAnalyzing

  const handleAnalyze = useCallback(async () => {
    if (!canSubmit) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze-argument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          position,
          context
        })
      })

      const result = await response.json()

      if (result.success && result.data) {
        setAnalysisResult(result.data)
      } else {
        setError(result.error || 'Failed to analyze argument')
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze argument. Please try again.')
    }

    setIsAnalyzing(false)
  }, [text, position, context, canSubmit])

  const handleReset = useCallback(() => {
    setAnalysisResult(null)
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    onClose()
    // Reset state after animation
    setTimeout(() => {
      setText('')
      setPosition('pro')
      setAnalysisResult(null)
      setError(null)
    }, 300)
  }, [onClose])

  const handleApplyImproved = useCallback((improvedText: string) => {
    setText(improvedText)
    setAnalysisResult(null)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <AnimatePresence mode="wait">
          {!analysisResult ? (
            <motion.div
              key="composer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {/* Header */}
              <DialogHeader className="mb-6">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <PenSquare className="w-5 h-5 text-primary" />
                  Write Your Argument
                </DialogTitle>
                <DialogDescription>
                  Draft your argument and get AI-powered feedback using traditional debate scoring criteria
                </DialogDescription>
              </DialogHeader>

              {/* Context Panel */}
              <div className="mb-6 p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Central Question
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {context.centralQuestion}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-400 font-medium mb-1">PRO means:</p>
                    <p className="text-xs text-muted-foreground">
                      {context.proDefinition || 'Supporting the proposition'}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400 font-medium mb-1">CON means:</p>
                    <p className="text-xs text-muted-foreground">
                      {context.conDefinition || 'Opposing the proposition'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Position Selector */}
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Your Position
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(POSITION_CONFIG) as [ArgumentPosition, typeof POSITION_CONFIG.pro][]).map(
                    ([key, config]) => {
                      const Icon = config.icon
                      const isSelected = position === key
                      return (
                        <button
                          key={key}
                          onClick={() => setPosition(key)}
                          className={`
                            flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all
                            ${isSelected
                              ? `${config.bgColor} ${config.borderColor} ${config.color}`
                              : 'bg-secondary/30 border-border hover:bg-secondary/50'
                            }
                          `}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? config.color : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${isSelected ? config.color : 'text-foreground'}`}>
                            {config.label}
                          </span>
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              {/* Text Area */}
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Your Argument
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your argument here. Be clear, provide evidence, and address potential counterarguments..."
                  className="w-full h-48 p-4 rounded-lg bg-secondary/30 border border-border text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  maxLength={MAX_CHARS}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-muted-foreground">
                    {charCount < MIN_CHARS && charCount > 0 && (
                      <span className="text-warning">
                        At least {MIN_CHARS} characters required
                      </span>
                    )}
                    {charCount >= MIN_CHARS && charCount <= MAX_CHARS && (
                      <span className="text-success">Ready to analyze</span>
                    )}
                  </p>
                  <p className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {charCount}/{MAX_CHARS}
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Tips */}
              <div className="mb-6 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">Tips for a strong argument:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li>State your main claim clearly upfront</li>
                      <li>Support claims with specific evidence or examples</li>
                      <li>Address potential counterarguments</li>
                      <li>Keep a respectful, professional tone</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAnalyze}
                  disabled={!canSubmit}
                  className="min-w-[160px]"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Analyze Argument
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ArgumentAnalysisResults
                result={analysisResult}
                originalText={text}
                onBack={handleReset}
                onApplyImproved={handleApplyImproved}
                onClose={handleClose}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

export default ArgumentComposer
