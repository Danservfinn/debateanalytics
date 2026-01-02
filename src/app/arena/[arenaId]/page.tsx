'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Swords,
  Lock,
  Unlock,
  Users,
  Plus,
  Zap,
  Trophy,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Target,
  X,
  Link as LinkIcon,
  Copy,
  Check
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { FloatingShapes } from '@/components/layout/FloatingShapes'
import { Button } from '@/components/ui/button'
import type { DebateArena, ArenaSubmission, BattleRound, BattleResult } from '@/types/arena'
import { getWinnerLabel, getWinnerColor, getWinnerBg } from '@/types/arena'

export default function ArenaPage() {
  const params = useParams()
  const router = useRouter()
  const arenaId = params.arenaId as string

  const [arena, setArena] = useState<DebateArena | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Submission modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [submitPosition, setSubmitPosition] = useState<'pro' | 'con'>('pro')
  const [argumentText, setArgumentText] = useState('')
  const [sources, setSources] = useState<Array<{ title: string; url: string; quote: string }>>([
    { title: '', url: '', quote: '' }
  ])
  const [displayAnonymous, setDisplayAnonymous] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Battle state
  const [isBattleModalOpen, setIsBattleModalOpen] = useState(false)
  const [invoiceData, setInvoiceData] = useState<{ bolt11: string; amountSats: number } | null>(null)
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [isBattleRunning, setIsBattleRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  // Selected battle for viewing
  const [selectedBattle, setSelectedBattle] = useState<BattleRound | null>(null)

  useEffect(() => {
    loadArena()
  }, [arenaId])

  const loadArena = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/arena/${arenaId}`)
      const result = await response.json()

      if (result.success && result.data) {
        setArena(result.data)
        // If there are battles, select the latest one
        if (result.data.battles.length > 0) {
          setSelectedBattle(result.data.battles[result.data.battles.length - 1])
        }
      } else {
        setError(result.error || 'Arena not found')
      }
    } catch (err) {
      setError('Failed to load arena')
    }

    setIsLoading(false)
  }

  const handleOpenSubmitModal = (position: 'pro' | 'con') => {
    setSubmitPosition(position)
    setArgumentText('')
    setSources([{ title: '', url: '', quote: '' }])
    setIsSubmitModalOpen(true)
  }

  const handleAddSource = () => {
    setSources([...sources, { title: '', url: '', quote: '' }])
  }

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index))
  }

  const handleSourceChange = (index: number, field: keyof typeof sources[0], value: string) => {
    const newSources = [...sources]
    newSources[index][field] = value
    setSources(newSources)
  }

  const handleSubmitArgument = async () => {
    if (!argumentText.trim()) return
    if (sources.some(s => !s.url.trim())) {
      alert('All sources must have a URL')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/arena/${arenaId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: submitPosition,
          argumentText: argumentText.trim(),
          sources: sources.filter(s => s.url.trim()),
          anonymous: displayAnonymous
        })
      })

      const result = await response.json()

      if (result.success) {
        setIsSubmitModalOpen(false)
        loadArena() // Refresh arena data
      } else {
        alert(result.error || 'Failed to submit argument')
      }
    } catch (err) {
      alert('Failed to submit argument')
    }

    setIsSubmitting(false)
  }

  const handleStartBattle = async () => {
    setIsCreatingInvoice(true)

    try {
      const response = await fetch(`/api/arena/${arenaId}/create-invoice`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success && result.data) {
        setInvoiceData(result.data)
        setIsBattleModalOpen(true)
        // Start polling for payment
        pollPayment(result.data.invoiceId)
      } else {
        alert(result.error || 'Failed to create invoice')
      }
    } catch (err) {
      alert('Failed to create invoice')
    }

    setIsCreatingInvoice(false)
  }

  const pollPayment = async (invoiceId: string) => {
    const maxAttempts = 180 // 15 minutes
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setInvoiceData(null)
        setIsBattleModalOpen(false)
        alert('Invoice expired')
        return
      }

      try {
        const response = await fetch(`/api/arena/${arenaId}/check-payment?invoiceId=${invoiceId}`)
        const result = await response.json()

        if (result.paid) {
          // Payment received, trigger battle
          setIsBattleRunning(true)
          await triggerBattle()
          setIsBattleRunning(false)
          setInvoiceData(null)
          setIsBattleModalOpen(false)
          loadArena()
          return
        }
      } catch (err) {
        console.error('Payment poll error:', err)
      }

      attempts++
      setTimeout(poll, 5000) // Poll every 5 seconds
    }

    poll()
  }

  const triggerBattle = async () => {
    try {
      const response = await fetch(`/api/arena/${arenaId}/trigger-battle`, {
        method: 'POST'
      })

      const result = await response.json()

      if (!result.success) {
        alert(result.error || 'Battle failed')
      }
    } catch (err) {
      alert('Battle failed')
    }
  }

  const copyInvoice = () => {
    if (invoiceData) {
      navigator.clipboard.writeText(invoiceData.bolt11)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <FloatingShapes />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading arena...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !arena) {
    return (
      <div className="min-h-screen">
        <FloatingShapes />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-12 h-12 text-warning" />
            <p className="text-lg font-medium">{error || 'Arena not found'}</p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const canBattle = arena.proCount >= arena.minSubmissionsPerSide &&
                    arena.conCount >= arena.minSubmissionsPerSide

  return (
    <div className="min-h-screen bg-background">
      <FloatingShapes />
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link href={`/thread/${arena.threadId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Thread
            </Button>
          </Link>
        </motion.div>

        {/* Arena Header */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-featured p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/20">
              <Swords className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Debate Arena</h1>
              <p className="text-sm text-muted-foreground">Competitive blind argument battles</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/30 border border-border mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">{arena.topic}</h2>
            <p className="text-sm text-muted-foreground">{arena.description}</p>
          </div>

          {/* Submission counts */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-success" />
                <span className="text-2xl font-bold text-success">{arena.proCount}</span>
              </div>
              <p className="text-sm text-muted-foreground">PRO Arguments Sealed</p>
              <button
                onClick={() => handleOpenSubmitModal('pro')}
                className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-success/20 text-success hover:bg-success/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit PRO
              </button>
            </div>

            <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-danger" />
                <span className="text-2xl font-bold text-danger">{arena.conCount}</span>
              </div>
              <p className="text-sm text-muted-foreground">CON Arguments Sealed</p>
              <button
                onClick={() => handleOpenSubmitModal('con')}
                className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit CON
              </button>
            </div>
          </div>

          {/* Battle trigger */}
          <div className="text-center">
            {!canBattle ? (
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <p className="text-muted-foreground mb-2">
                  Requires at least {arena.minSubmissionsPerSide} arguments per side to battle
                </p>
                <p className="text-sm text-muted-foreground/60">
                  {Math.max(0, arena.minSubmissionsPerSide - arena.proCount)} more PRO and{' '}
                  {Math.max(0, arena.minSubmissionsPerSide - arena.conCount)} more CON needed
                </p>
              </div>
            ) : (
              <button
                onClick={handleStartBattle}
                disabled={isCreatingInvoice}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-primary-foreground font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isCreatingInvoice ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Zap className="w-6 h-6" />
                )}
                Start Battle (${arena.battleCostUsd} Lightning)
              </button>
            )}

            {arena.pendingNewArguments > 0 && arena.battles.length > 0 && (
              <p className="mt-3 text-sm text-primary">
                {arena.pendingNewArguments} new argument{arena.pendingNewArguments > 1 ? 's' : ''} since last battle
              </p>
            )}
          </div>
        </motion.section>

        {/* Battle History */}
        {arena.battles.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              Battle History ({arena.battles.length} round{arena.battles.length > 1 ? 's' : ''})
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
              {arena.battles.map((battle) => (
                <button
                  key={battle.id}
                  onClick={() => setSelectedBattle(battle)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedBattle?.id === battle.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Round {battle.round}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getWinnerBg(battle.result.winner)} ${getWinnerColor(battle.result.winner)}`}>
                      {getWinnerLabel(battle.result.winner)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-success">{battle.result.proScore.toFixed(1)}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="text-danger">{battle.result.conScore.toFixed(1)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Battle Results */}
            {selectedBattle && (
              <BattleResultsCard battle={selectedBattle} arena={arena} />
            )}
          </motion.section>
        )}
      </main>

      {/* Submit Argument Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsSubmitModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-background rounded-xl border border-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-foreground">
                    Submit {submitPosition.toUpperCase()} Argument
                  </h3>
                  <button
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="p-2 rounded-lg hover:bg-secondary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Argument text */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Your Argument (max 2000 characters)
                    </label>
                    <textarea
                      value={argumentText}
                      onChange={(e) => setArgumentText(e.target.value.slice(0, 2000))}
                      className="w-full h-48 p-3 rounded-lg bg-secondary/50 border border-border text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Present your strongest argument for this position..."
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {argumentText.length}/2000
                    </p>
                  </div>

                  {/* Sources */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Sources (at least 1 required)
                    </label>
                    <div className="space-y-3">
                      {sources.map((source, index) => (
                        <div key={index} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Source {index + 1}</span>
                            {sources.length > 1 && (
                              <button
                                onClick={() => handleRemoveSource(index)}
                                className="text-danger hover:text-danger/80"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={source.title}
                            onChange={(e) => handleSourceChange(index, 'title', e.target.value)}
                            className="w-full p-2 rounded bg-secondary/50 border border-border text-sm"
                            placeholder="Source title"
                          />
                          <input
                            type="url"
                            value={source.url}
                            onChange={(e) => handleSourceChange(index, 'url', e.target.value)}
                            className="w-full p-2 rounded bg-secondary/50 border border-border text-sm"
                            placeholder="https://..."
                          />
                          <input
                            type="text"
                            value={source.quote}
                            onChange={(e) => handleSourceChange(index, 'quote', e.target.value)}
                            className="w-full p-2 rounded bg-secondary/50 border border-border text-sm"
                            placeholder="Relevant quote (optional)"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleAddSource}
                      className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add another source
                    </button>
                  </div>

                  {/* Anonymous toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="anonymous"
                      checked={displayAnonymous}
                      onChange={(e) => setDisplayAnonymous(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="anonymous" className="text-sm text-muted-foreground">
                      Display as anonymous
                    </label>
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={handleSubmitArgument}
                    disabled={isSubmitting || !argumentText.trim() || sources.every(s => !s.url.trim())}
                    className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                      submitPosition === 'pro'
                        ? 'bg-success text-success-foreground'
                        : 'bg-danger text-danger-foreground'
                    } disabled:opacity-50`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                    Seal Argument
                  </button>

                  <p className="text-xs text-muted-foreground text-center">
                    Your argument will be hidden until the battle is triggered
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle Payment Modal */}
      <AnimatePresence>
        {isBattleModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-background rounded-xl border border-border shadow-2xl max-w-md w-full p-6 text-center"
            >
              {isBattleRunning ? (
                <>
                  <div className="mb-6">
                    <div className="relative inline-block">
                      <Loader2 className="w-16 h-16 animate-spin text-primary" />
                      <Swords className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Battle in Progress</h3>
                  <p className="text-muted-foreground">
                    Claude is analyzing all arguments...
                  </p>
                </>
              ) : invoiceData ? (
                <>
                  <Zap className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Pay with Lightning</h3>
                  <p className="text-muted-foreground mb-6">
                    {invoiceData.amountSats} sats (~${arena.battleCostUsd})
                  </p>

                  <div className="p-4 rounded-lg bg-secondary/50 border border-border mb-4">
                    <p className="text-xs text-muted-foreground break-all font-mono">
                      {invoiceData.bolt11.slice(0, 50)}...
                    </p>
                  </div>

                  <button
                    onClick={copyInvoice}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 mb-4"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy Invoice
                      </>
                    )}
                  </button>

                  <p className="text-xs text-muted-foreground">
                    Waiting for payment... Invoice expires in 15 minutes
                  </p>

                  <button
                    onClick={() => {
                      setIsBattleModalOpen(false)
                      setInvoiceData(null)
                    }}
                    className="mt-4 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Battle Results Card Component
function BattleResultsCard({ battle, arena }: { battle: BattleRound; arena: DebateArena }) {
  const result = battle.result

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-featured p-6 space-y-6"
    >
      {/* Verdict Header */}
      <div className={`p-4 rounded-lg ${getWinnerBg(result.winner)} border border-current/20`}>
        <div className="flex items-center justify-center gap-3 mb-3">
          <Trophy className={`w-8 h-8 ${getWinnerColor(result.winner)}`} />
          <h3 className={`text-2xl font-bold ${getWinnerColor(result.winner)}`}>
            {getWinnerLabel(result.winner)}
          </h3>
        </div>
        <p className="text-sm text-center text-muted-foreground">
          Confidence: {result.confidence}%
        </p>
        <p className="text-center mt-3 text-foreground">{result.verdictSummary}</p>
      </div>

      {/* Score Comparison */}
      <div className="grid grid-cols-2 gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-success mb-1">
            {result.proScore.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">PRO Score</div>
          <div className="text-xs text-muted-foreground mt-1">
            {result.metrics.proAvgScore.toFixed(1)} avg per argument
          </div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-danger mb-1">
            {result.conScore.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">CON Score</div>
          <div className="text-xs text-muted-foreground mt-1">
            {result.metrics.conAvgScore.toFixed(1)} avg per argument
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Source Quality"
          proValue={result.metrics.proSourceQuality}
          conValue={result.metrics.conSourceQuality}
        />
        <MetricCard
          label="Logic Validity"
          proValue={result.metrics.proLogicValidity}
          conValue={result.metrics.conLogicValidity}
        />
        <MetricCard
          label="Claim Accuracy"
          proValue={result.metrics.proClaimAccuracy}
          conValue={result.metrics.conClaimAccuracy}
        />
        <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
          <div className="text-lg font-bold text-foreground">{result.argumentRankings.length}</div>
          <div className="text-xs text-muted-foreground">Arguments Analyzed</div>
        </div>
      </div>

      {/* Reasoning Chain */}
      <div>
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Reasoning Chain
        </h4>
        <div className="space-y-2">
          {result.reasoningChain.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Argument Rankings */}
      <div>
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-500" />
          Argument Rankings
        </h4>
        <div className="space-y-2">
          {result.argumentRankings.map((arg, i) => (
            <div
              key={arg.submissionId}
              className={`p-3 rounded-lg border ${
                arg.position === 'pro' ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">#{arg.rank}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    arg.position === 'pro' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                  }`}>
                    {arg.position.toUpperCase()}
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">{arg.score.toFixed(1)}</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{arg.preview}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Score Deltas (if not first battle) */}
      {battle.scoreDeltas && battle.scoreDeltas.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-info" />
            Score Changes from Previous Battle
          </h4>
          <div className="space-y-2">
            {battle.scoreDeltas.map((delta) => (
              <div key={delta.submissionId} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                <span className="text-sm text-muted-foreground">{delta.reason}</span>
                <span className={`font-medium ${
                  delta.delta > 0 ? 'text-success' : delta.delta < 0 ? 'text-danger' : 'text-muted-foreground'
                }`}>
                  {delta.delta > 0 ? '+' : ''}{delta.delta.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Metric comparison card
function MetricCard({ label, proValue, conValue }: { label: string; proValue: number; conValue: number }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
      <div className="text-xs text-muted-foreground mb-2 text-center">{label}</div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-success">{proValue}%</span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className="text-sm font-medium text-danger">{conValue}%</span>
      </div>
    </div>
  )
}
