'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  HelpCircle,
  Sparkles,
  Save,
  Trash2
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

// Draft storage key prefix
const DRAFT_STORAGE_KEY = 'debate-analytics-argument-draft'

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

// Generate a draft key based on central question
function getDraftKey(question: string): string {
  const hash = question.slice(0, 50).replace(/\s+/g, '-').toLowerCase()
  return `${DRAFT_STORAGE_KEY}-${hash}`
}

interface Draft {
  text: string
  position: ArgumentPosition
  savedAt: number
}

export function ArgumentComposer({ isOpen, onClose, context }: ArgumentComposerProps) {
  const [position, setPosition] = useState<ArgumentPosition>('pro')
  const [text, setText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ArgumentAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingStarter, setIsGeneratingStarter] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const charCount = text.length
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS
  const canSubmit = isValidLength && !isAnalyzing && !isGeneratingStarter

  // Load draft on mount
  useEffect(() => {
    if (isOpen && context.centralQuestion) {
      const draftKey = getDraftKey(context.centralQuestion)
      try {
        const saved = localStorage.getItem(draftKey)
        if (saved) {
          const draft: Draft = JSON.parse(saved)
          setText(draft.text)
          setPosition(draft.position)
          setHasDraft(true)
          setLastSaved(new Date(draft.savedAt))
        }
      } catch (e) {
        console.error('Error loading draft:', e)
      }
    }
  }, [isOpen, context.centralQuestion])

  // Auto-save draft when text or position changes
  useEffect(() => {
    if (!isOpen || !context.centralQuestion || text.length === 0) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Debounce save by 1 second
    autoSaveTimeoutRef.current = setTimeout(() => {
      const draftKey = getDraftKey(context.centralQuestion)
      const draft: Draft = {
        text,
        position,
        savedAt: Date.now()
      }
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft))
        setHasDraft(true)
        setLastSaved(new Date())
      } catch (e) {
        console.error('Error saving draft:', e)
      }
    }, 1000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [text, position, isOpen, context.centralQuestion])

  // Keyboard shortcut: Cmd/Ctrl + Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit && !analysisResult) {
        e.preventDefault()
        handleAnalyze()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, canSubmit, analysisResult])

  // Clear draft
  const clearDraft = useCallback(() => {
    if (context.centralQuestion) {
      const draftKey = getDraftKey(context.centralQuestion)
      localStorage.removeItem(draftKey)
      setHasDraft(false)
      setLastSaved(null)
    }
  }, [context.centralQuestion])

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
      setIsGeneratingStarter(false)
      setHasDraft(false)
      setLastSaved(null)
    }, 300)
  }, [onClose])

  const handleApplyImproved = useCallback((improvedText: string) => {
    setText(improvedText)
    setAnalysisResult(null)
  }, [])

  // AI Kickstarter - generate a starter argument
  const handleGenerateStarter = useCallback(async () => {
    setIsGeneratingStarter(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centralQuestion: context.centralQuestion,
          position,
          proDefinition: context.proDefinition,
          conDefinition: context.conDefinition,
          keyArguments: context.keyArguments
        })
      })

      const result = await response.json()

      if (result.success && result.starterText) {
        setText(result.starterText)
        // Focus the textarea after inserting text
        setTimeout(() => {
          textareaRef.current?.focus()
          // Move cursor to end
          if (textareaRef.current) {
            textareaRef.current.selectionStart = result.starterText.length
            textareaRef.current.selectionEnd = result.starterText.length
          }
        }, 100)
      } else {
        setError(result.error || 'Failed to generate starter. Try writing your own!')
      }
    } catch (err) {
      console.error('Starter generation error:', err)
      setError('Failed to generate starter. Try writing your own!')
    }

    setIsGeneratingStarter(false)
  }, [position, context])

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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">
                    Your Argument
                  </label>
                  {/* Help me start button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateStarter}
                    disabled={isGeneratingStarter || isAnalyzing || text.length > 50}
                    className="text-xs h-7 text-primary hover:text-primary/80"
                  >
                    {isGeneratingStarter ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1.5" />
                        Help me start
                      </>
                    )}
                  </Button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your argument here. Be clear, provide evidence, and address potential counterarguments..."
                  className="w-full h-48 p-4 rounded-lg bg-secondary/30 border border-border text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  maxLength={MAX_CHARS}
                />
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-3">
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
                    {/* Draft indicator */}
                    {hasDraft && lastSaved && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Save className="w-3 h-3" />
                        Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {hasDraft && (
                      <button
                        onClick={() => {
                          setText('')
                          clearDraft()
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                    <p className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {charCount}/{MAX_CHARS}
                    </p>
                  </div>
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">
                    {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}
                  </kbd>
                  {' + '}
                  <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">
                    Enter
                  </kbd>
                  {' to analyze'}
                </p>
                <div className="flex gap-3">
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
