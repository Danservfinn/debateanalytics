"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  LightningInvoice,
  PaymentStatus,
  CreateInvoiceResponse,
  CheckPaymentResponse,
} from '@/types/payment'
import { markPaid, hasPaid } from '@/lib/payment-cache'

interface UsePaymentOptions {
  analysisType: 'user' | 'thread'
  targetId: string
  onPaymentComplete?: () => void
  pollInterval?: number  // ms between status checks
}

interface UsePaymentReturn {
  invoice: LightningInvoice | null
  status: PaymentStatus
  error: string | null
  isAlreadyPaid: boolean
  createInvoice: () => Promise<void>
  retry: () => void
  timeRemaining: number  // seconds until expiry
}

export function usePayment({
  analysisType,
  targetId,
  onPaymentComplete,
  pollInterval = 2000,
}: UsePaymentOptions): UsePaymentReturn {
  const [invoice, setInvoice] = useState<LightningInvoice | null>(null)
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false)

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const onPaymentCompleteRef = useRef(onPaymentComplete)

  // Keep callback ref updated
  useEffect(() => {
    onPaymentCompleteRef.current = onPaymentComplete
  }, [onPaymentComplete])

  // Check if already paid on mount
  useEffect(() => {
    const paid = hasPaid(analysisType, targetId)
    setIsAlreadyPaid(paid)
    if (paid) {
      setStatus('paid')
    }
  }, [analysisType, targetId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Create a new Lightning invoice
  const createInvoice = useCallback(async () => {
    if (isAlreadyPaid) {
      setStatus('paid')
      onPaymentCompleteRef.current?.()
      return
    }

    setStatus('creating')
    setError(null)

    try {
      const response = await fetch('/api/lightning/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisType, targetId }),
      })

      const data: CreateInvoiceResponse = await response.json()

      if (!data.success || !data.invoice) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      setInvoice(data.invoice)
      setStatus('pending')

      // Calculate time remaining
      const expiresAt = new Date(data.invoice.expiresAt).getTime()
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setTimeRemaining(remaining)

      // Start countdown timer
      countdownRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            if (pollRef.current) clearInterval(pollRef.current)
            setStatus('expired')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Start polling for payment status
      pollRef.current = setInterval(async () => {
        try {
          const checkResponse = await fetch(
            `/api/lightning/check-payment?invoiceId=${data.invoice!.invoiceId}`
          )
          const checkData: CheckPaymentResponse = await checkResponse.json()

          if (checkData.success && checkData.status === 'PAID') {
            // Payment received!
            if (pollRef.current) clearInterval(pollRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)

            // Save to cache
            markPaid(analysisType, targetId, data.invoice!.invoiceId)

            setStatus('paid')
            onPaymentCompleteRef.current?.()
          } else if (checkData.status === 'EXPIRED' || checkData.status === 'CANCELLED') {
            if (pollRef.current) clearInterval(pollRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
            setStatus('expired')
          }
        } catch (pollError) {
          console.error('Payment poll error:', pollError)
          // Don't stop polling on network errors, just log
        }
      }, pollInterval)

    } catch (err) {
      console.error('Create invoice error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to create invoice')

      if (pollRef.current) clearInterval(pollRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [analysisType, targetId, pollInterval, isAlreadyPaid])

  // Retry after error or expiry
  const retry = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    setInvoice(null)
    setStatus('idle')
    setError(null)
    setTimeRemaining(0)

    // Immediately create new invoice
    createInvoice()
  }, [createInvoice])

  return {
    invoice,
    status,
    error,
    isAlreadyPaid,
    createInvoice,
    retry,
    timeRemaining,
  }
}
