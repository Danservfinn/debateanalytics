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

// ============================================================================
// Debater Archetypes (NEW)
// ============================================================================

export type DebaterArchetype =
  | 'the_professor'      // Evidence-heavy, cites sources, structured arguments
  | 'the_lawyer'         // Logic-focused, finds loopholes, precedent-based
  | 'the_philosopher'    // Big-picture, ethics, first principles
  | 'the_warrior'        // Aggressive, rarely concedes, attacks weak points
  | 'the_diplomat'       // Seeks common ground, offers compromises
  | 'the_socratic'       // Questions rather than asserts
  | 'the_devils_advocate' // Takes contrarian positions

export const ARCHETYPE_DESCRIPTIONS: Record<DebaterArchetype, {
  label: string
  description: string
  icon: string
  effectiveAgainst: DebaterArchetype[]
  weakAgainst: DebaterArchetype[]
}> = {
  the_professor: {
    label: 'The Professor',
    description: 'Evidence-heavy debater who cites sources and structures arguments methodically',
    icon: '🎓',
    effectiveAgainst: ['the_warrior', 'the_devils_advocate'],
    weakAgainst: ['the_philosopher', 'the_socratic']
  },
  the_lawyer: {
    label: 'The Lawyer',
    description: 'Logic-focused, finds loopholes and uses precedent-based arguments',
    icon: '⚖️',
    effectiveAgainst: ['the_professor', 'the_diplomat'],
    weakAgainst: ['the_philosopher', 'the_socratic']
  },
  the_philosopher: {
    label: 'The Philosopher',
    description: 'Big-picture thinker who argues from ethics and first principles',
    icon: '🤔',
    effectiveAgainst: ['the_lawyer', 'the_professor'],
    weakAgainst: ['the_warrior', 'the_devils_advocate']
  },
  the_warrior: {
    label: 'The Warrior',
    description: 'Aggressive debater who rarely concedes and attacks weak points',
    icon: '⚔️',
    effectiveAgainst: ['the_diplomat', 'the_philosopher'],
    weakAgainst: ['the_professor', 'the_lawyer']
  },
  the_diplomat: {
    label: 'The Diplomat',
    description: 'Seeks common ground and offers compromises',
    icon: '🤝',
    effectiveAgainst: ['the_warrior', 'the_socratic'],
    weakAgainst: ['the_lawyer', 'the_devils_advocate']
  },
  the_socratic: {
    label: 'The Socratic',
    description: 'Questions rather than asserts, leads opponent to contradictions',
    icon: '❓',
    effectiveAgainst: ['the_professor', 'the_lawyer'],
    weakAgainst: ['the_warrior', 'the_diplomat']
  },
  the_devils_advocate: {
    label: "The Devil's Advocate",
    description: 'Takes contrarian positions to test arguments',
    icon: '😈',
    effectiveAgainst: ['the_diplomat', 'the_philosopher'],
    weakAgainst: ['the_professor', 'the_warrior']
  }
}

// ============================================================================
// Debate Detection Types (NEW)
// ============================================================================

export type DebatePosition = 'pro' | 'con' | 'neutral'
export type DebateWinner = 'pro' | 'con' | 'draw' | 'unresolved'

export interface DebateComment {
  id: string
  author: string
  text: string
  position: DebatePosition
  positionIntensity: number  // 1-10
  qualityScore: number       // 1-10
  isConcession: boolean
  parentId: string | null
  depth: number
  karma: number
  createdAt: string
  claims?: string[]
  fallacies?: Array<{
    type: string
    quote: string
    severity: 'low' | 'medium' | 'high'
  }>
}

export interface MomentumShift {
  replyNumber: number
  fromPosition: DebatePosition
  toPosition: DebatePosition
  trigger: string           // What caused the shift
  qualityDelta: number      // Quality difference that triggered it
}

export interface DebateThread {
  id: string
  title: string             // LLM-generated title
  keyClash: string          // Core point of disagreement
  rootCommentId: string
  winner: DebateWinner
  winnerReason: string
  proScore: number          // Average quality of PRO arguments
  conScore: number          // Average quality of CON arguments
  replyCount: number
  heatLevel: number         // 0-10, how heated the debate got
  replies: DebateComment[]
  momentumShifts?: MomentumShift[]
}

export interface EnhancedDebateThread extends DebateThread {
  momentumShifts: MomentumShift[]
  proStrategies: string[]
  conStrategies: string[]
  keyTurningPoints: string[]
}

// ============================================================================
// User Profile Types (NEW)
// ============================================================================

export interface UserProfile {
  username: string
  archetype: DebaterArchetype
  archetypeConfidence: number  // 0-1
  overallScore: number         // 0-10
  debatesAnalyzed?: number
  signatureMoves?: string[]
  knownWeaknesses?: string[]
  topicPreferences?: string[]
  effectiveApproaches?: string[]
}

export interface UserStatus {
  cached: boolean
  cachedAt?: string
  overallScore?: number
  archetype?: {
    primary: string
    confidence?: number
  }
  debatesAnalyzed?: number
}

export interface BatchUserStatus {
  [username: string]: {
    cached: boolean
    archetype?: string
    overallScore?: number
    signatureMoves?: string[]
  }
}

// ============================================================================
// Thread Analysis Result (NEW)
// ============================================================================

export interface ThreadVerdict {
  overallScore: number        // 0-10
  summary: string
  evidenceQualityPct: number  // 0-100
  civilityScore: number       // 0-10
  worthReading: boolean
  // Executive summary fields (optional for backward compatibility)
  keyTakeaways?: string[]     // Array of key points from the debate
  conclusion?: string         // Final verdict/conclusion statement
  winningPosition?: 'pro' | 'con' | 'draw' | 'unresolved'  // Which side generally won
}

export interface ThreadAnalysisResult {
  threadId: string
  subreddit: string
  title: string
  author: string
  commentCount: number
  createdAt: string
  url: string

  // Core analysis
  verdict: ThreadVerdict
  debates: DebateThread[]
  participants: Array<{
    username: string
    commentCount: number
    averageQuality: number
    position: DebatePosition
    archetype?: DebaterArchetype
    isCached: boolean
  }>

  // Claims & Fallacies
  claims: Array<{
    id: string
    text: string
    author: string
    verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverified'
    confidence: number
  }>
  fallacies: Array<{
    id: string
    type: string
    author: string
    quote: string
    severity: 'low' | 'medium' | 'high'
  }>

  // Topics (dynamic, LLM-generated)
  topics?: string[]
}

// ============================================================================
// Argument Fingerprinting (NEW)
// ============================================================================

export type ClaimType = 'factual' | 'policy' | 'value' | 'causal' | 'definitional'

export interface ArgumentFingerprint {
  hash: string
  coreClaim: string
  originalText?: string
  claimType: ClaimType
  commentId?: string
  subject?: string
  predicate?: string
  object?: string
  modifiers?: string[]
  semanticTags: string[]
  threadId?: string
  author?: string
  timestamp?: string
  frequency?: number
  similarity?: number
  similarArguments?: Array<{
    hash: string
    coreClaim: string
    similarity: number
    threadId: string
  }>
}

// ============================================================================
// Reply Coach Types (NEW)
// ============================================================================

export interface ReplySource {
  title: string
  url: string
  relevantQuote: string
  credibilityScore: number  // 0-10
  publishDate?: string
  credibility: 'high' | 'medium' | 'low'
}

export type ReplyStrategyType =
  | 'challenge_framing'
  | 'counter_evidence'
  | 'partial_agreement'
  | 'socratic_question'
  | 'steelman_then_counter'

export interface ResearchedReplyStrategy {
  type: ReplyStrategyType
  suggestedReply: string
  sources: ReplySource[]
  logicalStructure: {
    premise: string
    reasoning: string
    conclusion: string
  }
  strengthScore: number
  riskLevel: 'low' | 'medium' | 'high'
  effectivenessWithArchetype: Record<DebaterArchetype, number>
  editableVersion: string
}

export interface ReplyCoachResult {
  strategies: ResearchedReplyStrategy[]
  tacticsToAvoid: string[]
  opponentProfile?: {
    archetype: DebaterArchetype
    knownWeaknesses: string[]
    effectiveApproaches: string[]
  }
}

// ============================================================================
// Fact Check Types (NEW)
// ============================================================================

export type FactCheckVerdict =
  | 'true'
  | 'mostly_true'
  | 'mixed'
  | 'mostly_false'
  | 'false'

export interface FactCheckResult {
  verdict: FactCheckVerdict
  confidence: number
  explanation: string
  nuancePoints: string[]
  sources: ReplySource[]
  relatedClaims: Array<{
    claim: string
    verdict: string
    source: string
  }>
}

// ============================================================================
// New Helper Functions
// ============================================================================

export function getArchetypeInfo(archetype: DebaterArchetype) {
  return ARCHETYPE_DESCRIPTIONS[archetype]
}

export function getWinnerLabel(winner: DebateWinner): string {
  switch (winner) {
    case 'pro': return 'Pro Side Wins'
    case 'con': return 'Con Side Wins'
    case 'draw': return 'Draw'
    case 'unresolved': return 'Unresolved'
  }
}

export function getPositionLabel(position: DebatePosition): string {
  switch (position) {
    case 'pro': return 'Supports OP'
    case 'con': return 'Opposes OP'
    case 'neutral': return 'Neutral'
  }
}

export function getPositionBgColor(position: DebatePosition): string {
  switch (position) {
    case 'pro': return 'bg-success/10'
    case 'con': return 'bg-danger/10'
    case 'neutral': return 'bg-secondary/10'
  }
}

export function getPositionTextColor(position: DebatePosition): string {
  switch (position) {
    case 'pro': return 'text-success'
    case 'con': return 'text-danger'
    case 'neutral': return 'text-muted-foreground'
  }
}

export function getQualityLabel(score: number): string {
  if (score >= 8) return 'Excellent'
  if (score >= 6) return 'Good'
  if (score >= 4) return 'Fair'
  if (score >= 2) return 'Weak'
  return 'Poor'
}

export function getQualityColor(score: number): string {
  if (score >= 8) return '#22c55e'  // green
  if (score >= 6) return '#84cc16'  // lime
  if (score >= 4) return '#f59e0b'  // amber
  if (score >= 2) return '#f97316'  // orange
  return '#ef4444'                   // red
}

// ============================================================================
// Executive Summary Types (NEW)
// ============================================================================

export interface StrongestArgument {
  text: string           // Truncated preview text
  fullText: string       // Full untruncated text
  author: string
  qualityScore: number
  position: DebatePosition
  upvotes?: number
  evidenceCited?: string[]
  commentId: string
}

export interface EvidenceItem {
  source: string
  citationCount: number
  position: DebatePosition
}

export interface EvidenceLandscape {
  proEvidence: EvidenceItem[]
  conEvidence: EvidenceItem[]
  proEvidenceTypes: {
    academic: number
    historical: number
    anecdotal: number
    statistical: number
  }
  conEvidenceTypes: {
    academic: number
    historical: number
    anecdotal: number
    statistical: number
  }
}

export type EstablishedType = 'concession_pro' | 'concession_con' | 'mutual_agreement' | 'correction_accepted' | 'clarification'

export interface EstablishedItem {
  type: EstablishedType
  text: string
  source?: string  // Who said it or acknowledged it
  commentId?: string
}

export interface DebateEvolution {
  phases: Array<{
    label: string
    description: string
    position: DebatePosition | 'neutral'
  }>
  turningPoint?: {
    commentNumber: number
    description: string
    impact: string
  }
}

export interface ExecutiveSummaryData {
  // TL;DR - objective summary
  tldr: string

  // Central Question derived from thread title
  centralQuestion: {
    question: string
    threadTitle: string
    proDefinition: string  // What PRO means in this context
    conDefinition: string  // What CON means in this context
  }

  // Strongest arguments from each side
  strongestProArguments: StrongestArgument[]
  strongestConArguments: StrongestArgument[]

  // Evidence breakdown by side
  evidenceLandscape: EvidenceLandscape

  // Points where both sides agreed
  pointsOfAgreement: string[]

  // Core irreconcilable disagreements
  coreDisagreements: string[]

  // What was established through discussion
  established: EstablishedItem[]

  // How the debate evolved
  evolution: DebateEvolution
}
