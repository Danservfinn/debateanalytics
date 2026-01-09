/**
 * useCredits Hook
 * Fetches and manages user credit balance
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface CreditsData {
  balance: number
  credits: {
    purchased: number
    lifetimeTotal: number
    lifetimeSpent: number
  }
  subscription: {
    tier: string
    tierId: string
    monthlyAllowance: number
    used: number
    remaining: number
    renewsAt: string
  } | null
  canAnalyze: boolean
  analyzeSource: 'subscription' | 'credits' | 'free' | undefined
  analyzeBlockReason: string | undefined
  totalAvailable: number
  isSubscriber: boolean
}

export function useCredits() {
  const { data: session, status } = useSession()
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    if (!session?.user?.id) {
      setCredits(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/credits/balance')
      const data = await response.json()

      if (data.success) {
        setCredits(data.data)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch credits')
      }
    } catch (err) {
      setError('Failed to fetch credits')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  // Fetch on mount and when session changes
  useEffect(() => {
    if (status === 'loading') return
    fetchCredits()
  }, [status, fetchCredits])

  // Refresh function for use after purchases or analysis
  const refresh = useCallback(() => {
    fetchCredits()
  }, [fetchCredits])

  return {
    credits,
    loading: status === 'loading' || loading,
    error,
    refresh,
    // Convenience accessors
    balance: credits?.totalAvailable ?? 0,
    canAnalyze: credits?.canAnalyze ?? false,
    isSubscriber: credits?.isSubscriber ?? false,
  }
}
