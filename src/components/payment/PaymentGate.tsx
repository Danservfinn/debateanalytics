"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Copy,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LightningQRCode } from './QRCode'
import { usePayment } from '@/hooks/usePayment'

interface PaymentGateProps {
  analysisType: 'user' | 'thread'
  targetId: string
  isModal?: boolean
  onPaymentComplete: () => void
  onCancel: () => void
  allowSkip?: boolean  // Temporary: allow skipping payment for testing
}

export function PaymentGate({
  analysisType,
  targetId,
  isModal = false,
  onPaymentComplete,
  onCancel,
  allowSkip = true,  // Default to true for testing phase
}: PaymentGateProps) {
  const [copied, setCopied] = useState(false)

  const {
    invoice,
    status,
    error,
    isAlreadyPaid,
    createInvoice,
    retry,
    timeRemaining,
  } = usePayment({
    analysisType,
    targetId,
    onPaymentComplete,
  })

  // Auto-create invoice on mount (if not already paid)
  useEffect(() => {
    if (!isAlreadyPaid && status === 'idle') {
      createInvoice()
    }
  }, [isAlreadyPaid, status, createInvoice])

  // If already paid, call onPaymentComplete immediately
  useEffect(() => {
    if (isAlreadyPaid) {
      onPaymentComplete()
    }
  }, [isAlreadyPaid, onPaymentComplete])

  const handleCopy = async () => {
    if (!invoice?.lnInvoice) return

    try {
      await navigator.clipboard.writeText(invoice.lnInvoice)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Content based on status
  const renderContent = () => {
    switch (status) {
      case 'creating':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating Lightning invoice...</p>
          </motion.div>
        )

      case 'pending':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Amount */}
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">$1.00</p>
              {invoice?.convertedAmount && (
                <p className="text-sm text-muted-foreground">
                  ≈ {parseInt(invoice.convertedAmount.amount).toLocaleString()} sats
                </p>
              )}
            </div>

            {/* QR Code */}
            {invoice?.lnInvoice && (
              <LightningQRCode
                value={invoice.lnInvoice}
                size={180}
                isPending={true}
              />
            )}

            {/* Copy button */}
            <Button
              variant="outline"
              onClick={handleCopy}
              className="w-full max-w-xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-success" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Invoice
                </>
              )}
            </Button>

            {/* Timer */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expires in {formatTime(timeRemaining)}</span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Waiting for payment...</span>
            </div>

            {/* Skip button for testing */}
            {allowSkip && (
              <div className="pt-4 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPaymentComplete}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip for now (testing only)
                </Button>
              </div>
            )}
          </motion.div>
        )

      case 'paid':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              <CheckCircle2 className="w-16 h-16 text-success" />
            </motion.div>
            <p className="text-xl font-semibold text-foreground">Payment Received!</p>
            <p className="text-muted-foreground">Loading your analysis...</p>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </motion.div>
        )

      case 'expired':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <AlertCircle className="w-12 h-12 text-warning" />
            <p className="text-lg font-medium text-foreground">Invoice Expired</p>
            <p className="text-sm text-muted-foreground text-center">
              The payment window has closed. Generate a new invoice to continue.
            </p>
            <Button onClick={retry} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate New Invoice
            </Button>
          </motion.div>
        )

      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <AlertCircle className="w-12 h-12 text-danger" />
            <p className="text-lg font-medium text-foreground">Payment Error</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {error || 'Something went wrong. Please try again.'}
            </p>
            <Button onClick={retry} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </motion.div>
        )

      default:
        return null
    }
  }

  // Wrapper component (full page or modal)
  if (isModal) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && status !== 'creating') {
              onCancel()
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md mx-4"
          >
            <Card variant="premium" className="border-primary/20">
              {/* Close button */}
              {status !== 'creating' && status !== 'paid' && (
                <button
                  onClick={onCancel}
                  className="absolute top-4 right-4 p-1 rounded-full hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}

              <CardContent className="pt-6 pb-6">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-3">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    Unlock{' '}
                    {analysisType === 'user' ? 'User Analysis' : 'Deep Analysis'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pay with Bitcoin Lightning
                  </p>
                </div>

                {renderContent()}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Full page overlay
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card variant="premium" className="border-primary/20">
          <CardContent className="pt-8 pb-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 mb-4">
                <Zap className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Unlock User Analysis
              </h1>
              <p className="text-muted-foreground mt-2">
                Analyze <span className="font-medium text-foreground">u/{targetId}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Pay with Bitcoin Lightning
              </p>
            </div>

            {renderContent()}

            {/* Cancel button (only when not processing) */}
            {status !== 'creating' && status !== 'paid' && (
              <div className="mt-6 text-center">
                <button
                  onClick={onCancel}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel and go back
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help text */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Need a Lightning wallet?{' '}
          <a
            href="https://phoenix.acinq.co/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Try Phoenix
          </a>
          {' or '}
          <a
            href="https://muun.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Muun
          </a>
        </p>
      </motion.div>
    </div>
  )
}
