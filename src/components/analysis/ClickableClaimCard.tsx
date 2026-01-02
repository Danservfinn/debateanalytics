'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  Scale,
  MessageSquare,
  Copy,
  Check
} from 'lucide-react'

interface VerificationSource {
  title: string
  url: string
  snippet: string
  credibility: 'high' | 'medium' | 'low'
}

interface ClaimVerificationResult {
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable'
  confidence: number
  summary: string
  explanation: string
  sources: VerificationSource[]
  keyEvidence: string[]
  nuances: string[]
  verifiedAt: string
}

interface ClaimData {
  id: string
  text: string
  author: string
  verdict: string
  confidence: number
}

interface ClickableClaimCardProps {
  claim: ClaimData
  index: number
  threadContext?: string
  threadId?: string  // Thread ID for caching verifications
}

const verdictConfig = {
  true: {
    label: 'True',
    icon: CheckCircle,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    badge: 'badge-strong'
  },
  mostly_true: {
    label: 'Mostly True',
    icon: CheckCircle,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    badge: 'badge-strong'
  },
  mixed: {
    label: 'Mixed',
    icon: Scale,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    badge: 'badge-neutral'
  },
  mostly_false: {
    label: 'Mostly False',
    icon: XCircle,
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    badge: 'badge-weak'
  },
  false: {
    label: 'False',
    icon: XCircle,
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    badge: 'badge-weak'
  },
  unverifiable: {
    label: 'Unverifiable',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary/50',
    border: 'border-secondary',
    badge: 'badge-neutral'
  },
  unverified: {
    label: 'Unverified',
    icon: AlertCircle,
    color: 'text-muted-foreground',
    bg: 'bg-secondary/30',
    border: 'border-secondary',
    badge: 'badge-neutral'
  }
}

export function ClickableClaimCard({ claim, index, threadContext, threadId }: ClickableClaimCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verification, setVerification] = useState<ClaimVerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [isCheckingCache, setIsCheckingCache] = useState(true)

  // Response generation state
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const [generatedResponse, setGeneratedResponse] = useState<string | null>(null)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Check for cached verification on mount
  useEffect(() => {
    async function checkCache() {
      if (!threadId) {
        setIsCheckingCache(false)
        return
      }

      try {
        const response = await fetch(
          `/api/get-verifications?threadId=${encodeURIComponent(threadId)}&claimText=${encodeURIComponent(claim.text)}`
        )
        const result = await response.json()

        if (result.success && result.cached && result.data) {
          setVerification(result.data)
          setIsCached(true)
        }
      } catch (err) {
        console.error('Failed to check verification cache:', err)
      } finally {
        setIsCheckingCache(false)
      }
    }

    checkCache()
  }, [threadId, claim.text])

  const currentVerdict = verification?.verdict || claim.verdict || 'unverified'
  const config = verdictConfig[currentVerdict as keyof typeof verdictConfig] || verdictConfig.unverified
  const Icon = config.icon

  const handleVerify = async () => {
    if (isVerifying || verification) {
      setIsExpanded(!isExpanded)
      return
    }

    setIsVerifying(true)
    setError(null)
    setIsExpanded(true)

    try {
      const response = await fetch('/api/verify-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: claim.text,
          author: claim.author,
          context: threadContext,
          threadId: threadId  // Include threadId for caching
        })
      })

      const result = await response.json()

      if (result.success && result.data) {
        setVerification(result.data)
        setIsCached(result.cached || false)
      } else {
        setError(result.error || 'Failed to verify claim')
      }
    } catch (err) {
      setError('Failed to connect to verification service')
    } finally {
      setIsVerifying(false)
    }
  }

  const getCredibilityBadge = (credibility: string) => {
    switch (credibility) {
      case 'high':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success">High</span>
      case 'medium':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">Medium</span>
      case 'low':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/20 text-danger">Low</span>
      default:
        return null
    }
  }

  const handleGenerateResponse = async () => {
    if (!verification) return

    setIsGeneratingResponse(true)
    setResponseError(null)

    try {
      const response = await fetch('/api/generate-factcheck-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: claim.text,
          author: claim.author,
          verification,
          context: threadContext
        })
      })

      const result = await response.json()

      if (result.success && result.data?.response) {
        setGeneratedResponse(result.data.response)
      } else {
        setResponseError(result.error || 'Failed to generate response')
      }
    } catch (err) {
      setResponseError('Failed to connect to response generation service')
    } finally {
      setIsGeneratingResponse(false)
    }
  }

  const handleCopyResponse = async () => {
    if (!generatedResponse) return

    try {
      await navigator.clipboard.writeText(generatedResponse)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = generatedResponse
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`card-premium overflow-hidden transition-all duration-300 ${
        isExpanded ? 'ring-2 ring-primary/50' : ''
      }`}
    >
      {/* Main claim row - clickable */}
      <div
        className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={handleVerify}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{claim.text}</p>
            <p className="text-xs text-muted-foreground mt-1">— u/{claim.author}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCheckingCache ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Loading...</span>
              </div>
            ) : isVerifying ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Verifying...</span>
              </div>
            ) : verification ? (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg} ${config.color}`}>
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{config.label}</span>
                {isCached && <CheckCircle className="w-3 h-3 ml-0.5 opacity-60" />}
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 ml-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-1" />
                )}
              </div>
            ) : (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">Verify</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded verification results */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-4 space-y-4">
              {isVerifying && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <Shield className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-sm text-muted-foreground">AI analyzing claim with sources...</p>
                  <p className="text-xs text-muted-foreground/60">This may take 10-20 seconds</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {verification && (
                <>
                  {/* Verdict summary */}
                  <div className={`p-4 rounded-lg ${config.bg} ${config.border} border`}>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-6 h-6 ${config.color}`} />
                      <div>
                        <h4 className={`text-lg font-bold ${config.color}`}>{config.label}</h4>
                        <p className="text-xs text-muted-foreground">
                          {verification.confidence}% confidence
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{verification.summary}</p>
                  </div>

                  {/* Detailed explanation */}
                  <div>
                    <h5 className="text-sm font-semibold text-foreground mb-2">Analysis</h5>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {verification.explanation}
                    </p>
                  </div>

                  {/* Key evidence */}
                  {verification.keyEvidence.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Key Evidence
                      </h5>
                      <ul className="space-y-1">
                        {verification.keyEvidence.map((evidence, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-success mt-0.5">•</span>
                            {evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Nuances */}
                  {verification.nuances.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-warning" />
                        Important Nuances
                      </h5>
                      <ul className="space-y-1">
                        {verification.nuances.map((nuance, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-warning mt-0.5">•</span>
                            {nuance}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Sources */}
                  {verification.sources.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-info" />
                        Sources
                      </h5>
                      <div className="space-y-2">
                        {verification.sources.map((source, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-lg bg-secondary/30 border border-border"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                              >
                                {source.title}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              {getCredibilityBadge(source.credibility)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {source.snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp and cache indicator */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground/60 pt-2 border-t border-border">
                    <span>
                      Verified at {new Date(verification.verifiedAt).toLocaleString()}
                    </span>
                    {isCached && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="w-3 h-3" />
                        Cached result
                      </span>
                    )}
                  </div>

                  {/* Write Response Section */}
                  <div className="mt-4 pt-4 border-t border-border">
                    {!generatedResponse && !isGeneratingResponse && (
                      <button
                        onClick={handleGenerateResponse}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 text-primary hover:from-primary/30 hover:to-purple-500/30 transition-all"
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-medium">Write my response</span>
                      </button>
                    )}

                    {isGeneratingResponse && (
                      <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <div className="relative">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">Crafting your response...</p>
                      </div>
                    )}

                    {responseError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-sm">{responseError}</p>
                      </div>
                    )}

                    {generatedResponse && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-primary" />
                            Your Response
                          </h5>
                          <button
                            onClick={handleCopyResponse}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              copied
                                ? 'bg-success/20 text-success'
                                : 'bg-secondary hover:bg-secondary/80 text-foreground'
                            }`}
                          >
                            {copied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy to clipboard
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                          <p className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {generatedResponse}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground/60 text-center">
                          Review and personalize before posting. AI-generated responses may need adjustments.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default ClickableClaimCard
