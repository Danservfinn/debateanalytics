/**
 * Debate Analytics Type Definitions
 * Comprehensive types for debate analysis, user metrics, and thread data
 */

// ============================================
// Core Enums
// ============================================

export type ArgumentQuality = 'strong' | 'moderate' | 'weak'
export type RhetoricalStyle = 'analytical' | 'emotional' | 'balanced' | 'aggressive' | 'passive'
export type FallacyType =
  | 'ad_hominem'
  | 'straw_man'
  | 'false_dichotomy'
  | 'appeal_to_authority'
  | 'appeal_to_emotion'
  | 'slippery_slope'
  | 'circular_reasoning'
  | 'red_herring'
  | 'tu_quoque'
  | 'hasty_generalization'
  | 'no_true_scotsman'
  | 'whataboutism'
  | 'false_equivalence'
  | 'moving_goalposts'

// ============================================
// Argument & Comment Types
// ============================================

export interface Fallacy {
  type: FallacyType
  description: string
  quote?: string
  severity: 'minor' | 'moderate' | 'major'
}

export interface Argument {
  id: string
  commentId: string
  quality: ArgumentQuality
  summary: string
  evidence: string[]
  fallacies: Fallacy[]
  score: number // 1-10
}

export interface Comment {
  id: string
  author: string
  body: string
  score: number
  depth: number
  createdUtc: number
  isOp: boolean
  controversiality: number
  hasDelta?: boolean
  arguments: Argument[]
  parentId?: string
}

// ============================================
// Thread Types
// ============================================

export interface ThreadMetadata {
  id: string
  title: string
  subreddit: string
  author: string
  score: number
  upvoteRatio: number
  numComments: number
  createdUtc: number
  url: string
  selftext: string
}

export interface ThreadAnalysis {
  id: string
  metadata: ThreadMetadata
  fetchedAt: string
  comments: Comment[]
  statistics: ThreadStatistics
  topArguments: Argument[]
  fallacyBreakdown: FallacyBreakdown[]
  participants: ParticipantSummary[]
}

export interface ThreadStatistics {
  totalComments: number
  uniqueAuthors: number
  opReplies: number
  deltaAwards: number
  topLevelComments: number
  avgScore: number
  strongArguments: number
  weakArguments: number
  totalFallacies: number
  avgArgumentQuality: number
}

export interface FallacyBreakdown {
  type: FallacyType
  count: number
  percentage: number
}

export interface ParticipantSummary {
  username: string
  commentCount: number
  totalScore: number
  strongArguments: number
  weakArguments: number
  fallacies: number
  isOp: boolean
}

// ============================================
// User Types
// ============================================

export interface UserMetrics {
  username: string
  fetchedAt: string
  totalComments: number
  totalKarma: number
  avgKarma: number
  topSubreddits: SubredditActivity[]
  activityPatterns: ActivityPattern
  argumentMetrics: ArgumentMetrics
  fallacyProfile: FallacyProfile
  rhetoricalStyle: RhetoricalStyle
  qualityScore: number // 1-10 overall
  rank?: number
}

export interface SubredditActivity {
  subreddit: string
  commentCount: number
  totalKarma: number
  avgKarma: number
}

export interface ActivityPattern {
  mostActiveHour: number // 0-23
  mostActiveDay: string // 'Monday', 'Tuesday', etc.
  avgCommentsPerDay: number
  accountAgeDays: number
}

export interface ArgumentMetrics {
  strongArguments: number
  moderateArguments: number
  weakArguments: number
  evidenceCited: number
  netArgumentScore: number // strong - weak
  avgArgumentLength: number
}

export interface FallacyProfile {
  totalFallacies: number
  fallacyTypes: FallacyCount[]
  fallacyRate: number // fallacies per 100 comments
}

export interface FallacyCount {
  type: FallacyType
  count: number
}

// ============================================
// Radar Chart Data (for user skill visualization)
// ============================================

export interface SkillDimension {
  skill: string
  value: number // 0-100
  fullMark: number
}

export interface UserRadarData {
  username: string
  skills: SkillDimension[]
}

// ============================================
// API Response Types
// ============================================

export interface AnalysisManifest {
  version: string
  generatedAt: string
  threads: string[]
  userMetrics: Record<string, UserMetricsSummary>
  globalStats: GlobalStats
}

export interface UserMetricsSummary {
  threadsParticipated: number
  strongArguments: number
  weakArguments: number
  logicalFallacies: number
  netArgumentScore: number
}

export interface GlobalStats {
  totalThreads: number
  totalUsers: number
  avgQualityScore: number
  totalArguments: number
  totalFallacies: number
}

// ============================================
// API Request/Response Types
// ============================================

export interface AnalyzeUserRequest {
  username: string
}

export interface AnalyzeUserResponse {
  success: boolean
  data?: UserMetrics
  error?: string
  cached?: boolean
}

export interface AnalyzeThreadRequest {
  url: string
}

export interface AnalyzeThreadResponse {
  success: boolean
  data?: ThreadAnalysis
  error?: string
}

// ============================================
// Chart Data Types
// ============================================

export interface PieChartData {
  name: string
  value: number
  fill: string
}

export interface BarChartData {
  name: string
  value: number
  fill?: string
}

export interface ScatterPlotPoint {
  x: number
  y: number
  z?: number // for bubble size
  name: string
}

// ============================================
// UI State Types
// ============================================

export interface SearchState {
  query: string
  isLoading: boolean
  error?: string
  recentSearches: string[]
}

export interface FilterState {
  subreddit: string | null
  sortBy: 'score' | 'quality' | 'date' | 'fallacies'
  sortOrder: 'asc' | 'desc'
  minScore?: number
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
}

// ============================================
// Helper Type Guards
// ============================================

export function isValidFallacyType(type: string): type is FallacyType {
  const validTypes: FallacyType[] = [
    'ad_hominem', 'straw_man', 'false_dichotomy', 'appeal_to_authority',
    'appeal_to_emotion', 'slippery_slope', 'circular_reasoning', 'red_herring',
    'tu_quoque', 'hasty_generalization', 'no_true_scotsman', 'whataboutism',
    'false_equivalence', 'moving_goalposts'
  ]
  return validTypes.includes(type as FallacyType)
}

export function getFallacyDisplayName(type: FallacyType): string {
  const names: Record<FallacyType, string> = {
    ad_hominem: 'Ad Hominem',
    straw_man: 'Straw Man',
    false_dichotomy: 'False Dichotomy',
    appeal_to_authority: 'Appeal to Authority',
    appeal_to_emotion: 'Appeal to Emotion',
    slippery_slope: 'Slippery Slope',
    circular_reasoning: 'Circular Reasoning',
    red_herring: 'Red Herring',
    tu_quoque: 'Tu Quoque',
    hasty_generalization: 'Hasty Generalization',
    no_true_scotsman: 'No True Scotsman',
    whataboutism: 'Whataboutism',
    false_equivalence: 'False Equivalence',
    moving_goalposts: 'Moving the Goalposts'
  }
  return names[type]
}
