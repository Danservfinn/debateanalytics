/**
 * Data Loading Utilities
 * Functions for loading and caching debate analysis data
 */

import type {
  AnalysisManifest,
  ThreadAnalysis,
  UserMetrics,
  GlobalStats,
  FallacyCount,
  FallacyType
} from '@/types/debate'

import type { BackendUserProfile, AnalysisJobStatus } from '@/types/backend'

const DATA_BASE_URL = '/data'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://debate-analytics-api-production.up.railway.app'

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
 * Transform backend profile to frontend UserMetrics format
 */
function transformBackendProfile(profile: BackendUserProfile): UserMetrics {
  // Map fallacy profile
  const fallacyTypes: FallacyCount[] = (profile.fallacy_profile?.ranked_fallacies || [])
    .map(f => ({
      type: f.type as FallacyType,
      count: f.count
    }))

  const totalFallacies = profile.fallacy_profile?.total_fallacies || 0
  const totalComments = profile.total_comments || profile.stats?.total_comments || 0

  // Calculate fallacy rate
  const fallacyRate = totalComments > 0 ? (totalFallacies / totalComments) * 100 : 0

  // Map quality breakdown to argument metrics
  const quality = profile.quality_breakdown || {
    structure: 50,
    evidence: 50,
    counterargument: 50,
    persuasiveness: 50,
    civility: 50
  }

  // Estimate argument counts from overall score
  const overallScore = profile.overall_score || 50
  const debatesAnalyzed = profile.debates_analyzed || profile.stats?.debates_analyzed || 0

  // Map archetype to rhetorical style
  let rhetoricalStyle: UserMetrics['rhetoricalStyle'] = 'balanced'
  if (profile.archetype?.primary) {
    const archetypeMap: Record<string, UserMetrics['rhetoricalStyle']> = {
      'The Logician': 'analytical',
      'The Empiricist': 'analytical',
      'The Socratic': 'analytical',
      'The Diplomat': 'balanced',
      'The Devil\'s Advocate': 'balanced',
      'The Debater': 'aggressive',
      'The Crusader': 'emotional',
      'The Storyteller': 'emotional',
      'The Pragmatist': 'balanced'
    }
    rhetoricalStyle = archetypeMap[profile.archetype.primary] || 'balanced'
  }

  return {
    username: profile.username,
    fetchedAt: profile.cached_at || new Date().toISOString(),
    totalComments,
    totalKarma: 0, // Not provided by backend
    avgKarma: 0,
    topSubreddits: [], // Could be extracted from topic_expertise
    activityPatterns: {
      mostActiveHour: 12,
      mostActiveDay: 'Monday',
      avgCommentsPerDay: totalComments / Math.max(debatesAnalyzed, 1),
      accountAgeDays: 365
    },
    argumentMetrics: {
      strongArguments: Math.round(debatesAnalyzed * (overallScore / 100)),
      moderateArguments: Math.round(debatesAnalyzed * 0.3),
      weakArguments: Math.round(debatesAnalyzed * ((100 - overallScore) / 100)),
      evidenceCited: Math.round(quality.evidence * debatesAnalyzed / 100),
      netArgumentScore: Math.round((overallScore - 50) * debatesAnalyzed / 50),
      avgArgumentLength: 150
    },
    fallacyProfile: {
      totalFallacies,
      fallacyTypes,
      fallacyRate
    },
    rhetoricalStyle,
    qualityScore: Math.round(overallScore / 10) // Convert 0-100 to 1-10
  }
}

/**
 * Fetch user profile from Railway backend API
 */
export async function fetchUserProfileFromBackend(username: string): Promise<BackendUserProfile | null> {
  try {
    const url = `${API_BASE_URL}/api/v1/users/${encodeURIComponent(username)}/profile?include_fallacies=true&include_top_arguments=true&include_expertise=true`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`Backend API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Failed to fetch profile from backend for ${username}:`, error)
    return null
  }
}

/**
 * Trigger analysis for a user on Railway backend
 */
export async function triggerUserAnalysis(
  username: string,
  forceRefresh: boolean = false
): Promise<AnalysisJobStatus | null> {
  try {
    const url = `${API_BASE_URL}/api/v1/users/${encodeURIComponent(username)}/analyze`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        force_refresh: forceRefresh
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to trigger analysis: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Failed to trigger analysis for ${username}:`, error)
    return null
  }
}

/**
 * Check analysis status for a user
 */
export async function checkAnalysisStatus(username: string): Promise<AnalysisJobStatus | null> {
  try {
    const url = `${API_BASE_URL}/api/v1/users/${encodeURIComponent(username)}/analyze/status`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Failed to check analysis status for ${username}:`, error)
    return null
  }
}

/**
 * Fetch user metrics from Railway backend API
 * Falls back to local API if backend unavailable
 */
export async function fetchUserMetrics(username: string): Promise<UserMetrics | null> {
  try {
    // First try Railway backend
    const backendProfile = await fetchUserProfileFromBackend(username)

    if (backendProfile && backendProfile.analysis_available) {
      return transformBackendProfile(backendProfile)
    }

    // If no analysis available, check if we should trigger one
    if (backendProfile && !backendProfile.analysis_available) {
      console.log(`No analysis available for ${username}, triggering analysis...`)
      const jobStatus = await triggerUserAnalysis(username)
      if (jobStatus?.status === 'pending' || jobStatus?.status === 'in_progress') {
        // Return null to indicate analysis in progress
        return null
      }
    }

    // Fallback to local API
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
