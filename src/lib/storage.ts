/**
 * Local Storage Persistence for Thread Analyses
 * Stores thread analyses in browser localStorage
 */

import type { ThreadAnalysisResult } from '@/types/debate'

const STORAGE_KEY = 'debate-analytics-threads'
const STATS_KEY = 'debate-analytics-stats'

interface StoredStats {
  totalThreads: number
  totalUsers: number
  totalArguments: number
  totalFallacies: number
}

/**
 * Get all stored thread analyses
 */
export function getStoredThreads(): ThreadAnalysisResult[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Get a specific stored thread by ID
 */
export function getStoredThread(threadId: string): ThreadAnalysisResult | null {
  const threads = getStoredThreads()
  return threads.find(t => t.threadId === threadId) || null
}

/**
 * Save a thread analysis to localStorage
 */
export function saveThread(analysis: ThreadAnalysisResult): void {
  if (typeof window === 'undefined') return
  try {
    const threads = getStoredThreads()

    // Remove existing entry with same ID (update)
    const filtered = threads.filter(t => t.threadId !== analysis.threadId)

    // Add new analysis at the beginning
    const updated = [analysis, ...filtered]

    // Keep only last 50 threads to avoid localStorage limits
    const trimmed = updated.slice(0, 50)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))

    // Update stats
    updateStats(trimmed)
  } catch (error) {
    console.error('Failed to save thread:', error)
  }
}

/**
 * Update global stats based on stored threads
 */
function updateStats(threads: ThreadAnalysisResult[]): void {
  if (typeof window === 'undefined') return

  // Collect unique users
  const uniqueUsers = new Set<string>()
  let totalArguments = 0
  let totalFallacies = 0

  threads.forEach(thread => {
    // Count participants
    thread.participants?.forEach(p => uniqueUsers.add(p.username))

    // Count arguments from debates
    thread.debates?.forEach(debate => {
      totalArguments += debate.replies?.length || 0
    })

    // Count fallacies
    totalFallacies += thread.fallacies?.length || 0
  })

  const stats: StoredStats = {
    totalThreads: threads.length,
    totalUsers: uniqueUsers.size,
    totalArguments,
    totalFallacies
  }

  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch (error) {
    console.error('Failed to save stats:', error)
  }
}

/**
 * Get stored stats
 */
export function getStoredStats(): StoredStats {
  if (typeof window === 'undefined') {
    return { totalThreads: 0, totalUsers: 0, totalArguments: 0, totalFallacies: 0 }
  }
  try {
    const data = localStorage.getItem(STATS_KEY)
    return data ? JSON.parse(data) : { totalThreads: 0, totalUsers: 0, totalArguments: 0, totalFallacies: 0 }
  } catch {
    return { totalThreads: 0, totalUsers: 0, totalArguments: 0, totalFallacies: 0 }
  }
}

/**
 * Clear all stored data
 */
export function clearStoredData(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STATS_KEY)
  } catch {
    // Ignore errors
  }
}
