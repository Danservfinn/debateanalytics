/**
 * Data Loading Utilities
 * Functions for loading and caching debate analysis data
 */

import type {
  AnalysisManifest,
  ThreadAnalysis,
  UserMetrics,
  GlobalStats
} from '@/types/debate'

const DATA_BASE_URL = '/data'

/**
 * Load the analysis manifest
 */
export async function loadManifest(): Promise<AnalysisManifest | null> {
  try {
    const response = await fetch(`${DATA_BASE_URL}/analysis-manifest.json`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Failed to load manifest:', error)
    return null
  }
}

/**
 * Load a specific thread analysis
 */
export async function loadThread(threadId: string): Promise<ThreadAnalysis | null> {
  try {
    const response = await fetch(`${DATA_BASE_URL}/threads/${threadId}.json`)
    if (!response.ok) return null
    const data = await response.json()
    // Validate structure - must have metadata property, not be an array (raw Reddit API format)
    if (!data || Array.isArray(data) || !data.metadata) {
      console.warn(`Invalid thread data format for ${threadId}, expected ThreadAnalysis object`)
      return null
    }
    return data
  } catch (error) {
    console.error(`Failed to load thread ${threadId}:`, error)
    return null
  }
}

/**
 * Load all threads
 */
export async function loadAllThreads(): Promise<ThreadAnalysis[]> {
  const manifest = await loadManifest()
  if (!manifest) return []

  const threads = await Promise.all(
    manifest.threads.map(threadId => loadThread(threadId))
  )

  return threads.filter((t): t is ThreadAnalysis => t !== null)
}

/**
 * Load user metrics from cache
 */
export async function loadUserMetrics(username: string): Promise<UserMetrics | null> {
  try {
    const response = await fetch(`${DATA_BASE_URL}/users/${username.toLowerCase()}.json`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error(`Failed to load user ${username}:`, error)
    return null
  }
}

/**
 * Fetch user metrics from API (triggers Python script if needed)
 */
export async function fetchUserMetrics(username: string): Promise<UserMetrics | null> {
  try {
    const response = await fetch(`/api/analyze-user?username=${encodeURIComponent(username)}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch user metrics')
    }
    const result = await response.json()
    return result.data
  } catch (error) {
    console.error(`Failed to fetch user ${username}:`, error)
    return null
  }
}

/**
 * Fetch thread analysis from API (triggers Python script)
 */
export async function fetchThreadAnalysis(url: string): Promise<ThreadAnalysis | null> {
  try {
    const response = await fetch(`/api/analyze-thread?url=${encodeURIComponent(url)}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch thread')
    }
    const result = await response.json()
    return result.data
  } catch (error) {
    console.error(`Failed to fetch thread ${url}:`, error)
    return null
  }
}

/**
 * Get global statistics
 */
export async function getGlobalStats(): Promise<GlobalStats | null> {
  const manifest = await loadManifest()
  return manifest?.globalStats || null
}

/**
 * Get leaderboard data (top users by quality score)
 */
export async function getLeaderboard(
  limit: number = 10,
  sortBy: 'score' | 'arguments' | 'fallacies' = 'score'
): Promise<UserMetrics[]> {
  const manifest = await loadManifest()
  if (!manifest) return []

  // Load all cached user data
  const usernames = Object.keys(manifest.userMetrics)
  const users = await Promise.all(
    usernames.map(username => loadUserMetrics(username))
  )

  const validUsers = users.filter((u): u is UserMetrics => u !== null)

  // Sort by specified criteria
  switch (sortBy) {
    case 'score':
      validUsers.sort((a, b) => b.qualityScore - a.qualityScore)
      break
    case 'arguments':
      validUsers.sort((a, b) => b.argumentMetrics.netArgumentScore - a.argumentMetrics.netArgumentScore)
      break
    case 'fallacies':
      validUsers.sort((a, b) => a.fallacyProfile.fallacyRate - b.fallacyProfile.fallacyRate)
      break
  }

  return validUsers.slice(0, limit)
}

/**
 * Search threads by title or subreddit
 */
export async function searchThreads(query: string): Promise<ThreadAnalysis[]> {
  const allThreads = await loadAllThreads()
  const lowerQuery = query.toLowerCase()

  return allThreads.filter(thread =>
    thread.metadata.title.toLowerCase().includes(lowerQuery) ||
    thread.metadata.subreddit.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('debate-analytics-recent-searches')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

/**
 * Add a search to recent searches
 */
export function addRecentSearch(query: string): void {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentSearches()
    const updated = [query, ...recent.filter(s => s !== query)].slice(0, 5)
    localStorage.setItem('debate-analytics-recent-searches', JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('debate-analytics-recent-searches')
  } catch {
    // Ignore localStorage errors
  }
}
