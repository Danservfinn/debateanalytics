// Payment Cache - localStorage persistence for paid analyses
// Client-side only

import type { PaidAnalysis } from '@/types/payment'

const STORAGE_KEY = 'debate-analytics-payments'
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000  // 24 hours

/**
 * Get all paid analyses from localStorage
 */
function getPaidAnalyses(): PaidAnalysis[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as PaidAnalysis[]
  } catch {
    return []
  }
}

/**
 * Save paid analyses to localStorage
 */
function savePaidAnalyses(analyses: PaidAnalysis[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses))
  } catch {
    // localStorage full or disabled, silently fail
  }
}

/**
 * Check if an analysis has been paid for
 */
export function hasPaid(type: 'user' | 'thread', targetId: string): boolean {
  const analyses = getPaidAnalyses()
  const now = Date.now()

  // Find matching analysis that hasn't expired
  return analyses.some(
    (a) =>
      a.type === type &&
      a.targetId.toLowerCase() === targetId.toLowerCase() &&
      now - a.paidAt < CACHE_EXPIRY_MS
  )
}

/**
 * Mark an analysis as paid
 */
export function markPaid(
  type: 'user' | 'thread',
  targetId: string,
  invoiceId: string
): void {
  const analyses = getPaidAnalyses()

  // Remove any existing entry for this target
  const filtered = analyses.filter(
    (a) =>
      !(a.type === type && a.targetId.toLowerCase() === targetId.toLowerCase())
  )

  // Add new entry
  filtered.push({
    type,
    targetId: targetId.toLowerCase(),
    paidAt: Date.now(),
    invoiceId,
  })

  savePaidAnalyses(filtered)
}

/**
 * Clear expired payment records
 */
export function clearExpired(): void {
  const analyses = getPaidAnalyses()
  const now = Date.now()

  const valid = analyses.filter((a) => now - a.paidAt < CACHE_EXPIRY_MS)

  if (valid.length !== analyses.length) {
    savePaidAnalyses(valid)
  }
}

/**
 * Get payment info for a specific analysis (if paid)
 */
export function getPaymentInfo(
  type: 'user' | 'thread',
  targetId: string
): PaidAnalysis | null {
  const analyses = getPaidAnalyses()
  const now = Date.now()

  return (
    analyses.find(
      (a) =>
        a.type === type &&
        a.targetId.toLowerCase() === targetId.toLowerCase() &&
        now - a.paidAt < CACHE_EXPIRY_MS
    ) || null
  )
}

/**
 * Clear all payment records (for testing/debugging)
 */
export function clearAll(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // silently fail
  }
}

/**
 * Get remaining time until a payment expires (in ms)
 * Returns 0 if not paid or expired
 */
export function getRemainingTime(
  type: 'user' | 'thread',
  targetId: string
): number {
  const payment = getPaymentInfo(type, targetId)
  if (!payment) return 0

  const expiresAt = payment.paidAt + CACHE_EXPIRY_MS
  const remaining = expiresAt - Date.now()

  return remaining > 0 ? remaining : 0
}
