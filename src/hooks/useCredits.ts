"use client"

import { useState, useEffect, useCallback } from 'react'
import type { CreditBalanceResponse } from '@/types/credits'

interface UseCreditsReturn {
  balance: number | null
  isLoading: boolean
  isNewUser: boolean
  isLow: boolean
  error: string | null
  refresh: () => Promise<void>
  claimDaily: () => Promise<{ success: boolean; credited: number; message?: string }>
}

const LOW_BALANCE_THRESHOLD = 25 // Less than 1 deep analysis

export function useCredits(): UseCreditsReturn {
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/credits/balance')

      if (!res.ok) {
        throw new Error('Failed to fetch balance')
      }

      const data: CreditBalanceResponse = await res.json()
      setBalance(data.balance)
      setIsNewUser(data.isNewUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      // On error, set balance to null but don't break the UI
      setBalance(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const claimDaily = useCallback(async () => {
    try {
      const res = await fetch('/api/credits/balance', {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success && data.credited > 0) {
        // Refresh balance after claiming
        await fetchBalance()
      }

      return {
        success: data.success,
        credited: data.credited || 0,
        message: data.message,
      }
    } catch (err) {
      return {
        success: false,
        credited: 0,
        message: 'Failed to claim daily credits',
      }
    }
  }, [fetchBalance])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    balance,
    isLoading,
    isNewUser,
    isLow: balance !== null && balance < LOW_BALANCE_THRESHOLD,
    error,
    refresh: fetchBalance,
    claimDaily,
  }
}
