/**
 * Traditional Debate Scoring System Types
 *
 * Based on Policy, Parliamentary, and World Schools methodologies.
 * Implements flow-based judging where winners are determined by
 * who won more contested issues, not who had higher average scores.
 */

// =============================================================================
// ARGUMENT FLOW TRACKING
// =============================================================================

/**
 * Individual argument in the debate flow
 * Represents a single claim with its supporting warrant and impact
 */
export interface FlowArgument {
  id: string
  commentId: string
  author: string
  position: 'pro' | 'con'
  timestamp: string

  // Argument content (Toulmin model)
  claim: string                    // The main assertion being made
  warrant: string | null           // Reasoning/evidence supporting the claim
  impact: string | null            // Why this matters (significance)

  // Flow tracking
  respondsTo: string | null        // ID of argument this responds to
  responses: string[]              // IDs of arguments that respond to this

  // Status after evaluation
  status: ArgumentStatus
  finalEvaluation: ArgumentEvaluation | null
}

/**
 * Status of an argument after debate flow analysis
 */
export type ArgumentStatus =
  | 'extended'      // Made and never dropped by the side that made it
  | 'dropped'       // Opponent failed to respond (counts against them)
  | 'refuted'       // Opponent successfully answered it
  | 'turned'        // Opponent turned it to their advantage
  | 'conceded'      // Maker explicitly conceded the point
  | 'contested'     // Both sides engaged, needs weighing

/**
 * Detailed evaluation of a single argument
 * Based on traditional debate judging criteria
 */
export interface ArgumentEvaluation {
  // Claim Analysis
  claimClarity: number          // 0-10: Is the claim clear and specific?
  claimRelevance: number        // 0-10: Does it address the central question?

  // Warrant Analysis (Evidence + Reasoning)
  warrantPresent: boolean
  warrantType: WarrantType
  warrantQuality: WarrantQuality | null

  // Impact Analysis
  impactMagnitude: number       // 0-10: How significant is the impact?
  impactProbability: number     // 0-10: How likely is the impact?
  impactTimeframe: ImpactTimeframe
  impactReversibility: ImpactReversibility

  // Internal Link
  internalLinkStrength: number  // 0-10: Does the warrant support the claim?

  // Composite
  overallStrength: number       // 0-10: Combined evaluation
}

/**
 * Type of warrant/evidence used to support a claim
 */
export type WarrantType =
  | 'empirical'     // Studies, data, statistics
  | 'testimonial'   // Expert opinion, authority
  | 'analogical'    // Comparison to similar situations
  | 'logical'       // Deductive/inductive reasoning
  | 'experiential'  // Personal experience, anecdote
  | 'none'          // No warrant provided

/**
 * Quality assessment of a warrant/evidence
 */
export interface WarrantQuality {
  sourceCredibility: number     // 0-10: How trustworthy is the source?
  recency: number               // 0-10: How recent is the evidence?
  relevance: number             // 0-10: How directly applicable?
  sufficiency: number           // 0-10: Is it enough to support the claim?
}

export type ImpactTimeframe = 'immediate' | 'short-term' | 'long-term' | 'speculative'
export type ImpactReversibility = 'reversible' | 'irreversible' | 'unknown'

// =============================================================================
// CLASH EVALUATION
// =============================================================================

/**
 * Evaluation of how two arguments clashed
 * Determines which side won a specific exchange
 */
export interface ClashEvaluation {
  id: string
  attackerId: string            // Argument doing the attacking
  defenderId: string            // Argument being attacked

  clashType: ClashType
  clashQuality: number          // 0-10: How effectively did they engage?

  // Who won this specific clash?
  winner: 'attacker' | 'defender' | 'draw'
  winnerReasoning: string
}

/**
 * Types of argumentative clash
 * Based on traditional debate refutation categories
 */
export type ClashType =
  | 'denial'           // "That's not true because..."
  | 'mitigation'       // "Even if true, it's not that bad because..."
  | 'turn'             // "Actually, your argument supports MY side because..."
  | 'outweigh'         // "Even if true, my argument is more important because..."
  | 'no_link'          // "Your evidence doesn't support your claim because..."
  | 'counterplan'      // "Here's a better solution..."
  | 'talking_past'     // Arguments don't actually engage (score = 0)

// =============================================================================
// ISSUE-LEVEL SCORING
// =============================================================================

/**
 * A contested issue in the debate
 * Groups related arguments and determines issue-level winner
 */
export interface DebateIssue {
  id: string
  topic: string                 // What this issue is about
  description: string           // Brief description of the contention

  // Arguments on each side
  proArguments: FlowArgument[]
  conArguments: FlowArgument[]

  // All clashes on this issue
  clashes: ClashEvaluation[]

  // Dropped arguments (unrebutted)
  droppedByPro: FlowArgument[]  // CON arguments that PRO failed to address
  droppedByCon: FlowArgument[]  // PRO arguments that CON failed to address

  // Issue-level evaluation
  issueWinner: 'pro' | 'con' | 'draw'
  issueWeight: number           // 0-10: How important is this issue to the debate?
  reasoning: string             // Why this side won the issue
}

// =============================================================================
// PARTICIPANT EVALUATION (SPEAKER POINTS)
// =============================================================================

/**
 * Individual debater evaluation
 * Separate from argument quality - measures communication effectiveness
 * Based on World Schools debate scoring categories
 */
export interface SpeakerEvaluation {
  author: string
  position: 'pro' | 'con'

  // Traditional speaker point categories (World Schools format)
  content: number               // 0-40: Substance of arguments
  style: number                 // 0-40: Clarity, persuasiveness, tone
  strategy: number              // 0-20: Structure, prioritization, clash handling

  // Composite
  speakerPoints: number         // 0-100: Total speaker evaluation

  // Behavioral metrics
  intellectualHonesty: number   // 0-10: Good faith engagement
  concessionsMade: number       // Count of explicit concessions
  droppedArguments: number      // Count of arguments they failed to address

  // Argument statistics
  argumentsMade: number
  argumentsWon: number
  argumentsLost: number
}

// =============================================================================
// BURDEN OF PROOF
// =============================================================================

/**
 * Analysis of burden of proof in the debate
 * Determines who needs to prove what and if they succeeded
 */
export interface BurdenAnalysis {
  affirmativeBurden: string     // What the PRO side must prove
  negativeBurden: string        // What the CON side must prove (if any)

  presumption: 'pro' | 'con' | 'none'  // Who wins if burden not met?
  burdenMet: {
    pro: boolean
    con: boolean
  }
  burdenReasoning: string
}

// =============================================================================
// DEBATE-LEVEL VERDICT
// =============================================================================

/**
 * Complete debate evaluation using traditional methodology
 * This replaces the simple average-based scoring
 */
export interface TraditionalDebateVerdict {
  debateId: string
  generatedAt: string

  // Issue-by-issue breakdown
  issues: DebateIssue[]
  issuesWonByPro: number
  issuesWonByCon: number
  issueDraws: number

  // Argument flow summary
  totalProArguments: number
  totalConArguments: number
  droppedByPro: number          // Arguments PRO failed to answer
  droppedByCon: number          // Arguments CON failed to answer

  // Impact comparison
  proImpactTotal: number        // Sum of (magnitude × probability) for PRO issues won
  conImpactTotal: number        // Sum of (magnitude × probability) for CON issues won

  // Burden analysis
  burden: BurdenAnalysis

  // Speaker evaluations
  speakers: SpeakerEvaluation[]

  // Final verdict
  winner: 'pro' | 'con' | 'draw'
  winnerConfidence: number      // 0-100: How decisive was the victory?

  // Voting issues (why the winner won)
  votingIssues: VotingIssue[]

  // Traditional score display (for UI compatibility)
  proScore: number              // 0-100 composite
  conScore: number              // 0-100 composite
  margin: number                // Point difference

  // Human-readable explanation
  verdictSummary: string
  judgeNotes: string
}

/**
 * A voting issue - the key reasons why the winner won
 */
export interface VotingIssue {
  issueId: string
  issue: string                 // Which issue decided the debate
  winner: 'pro' | 'con'
  weight: number                // 0-10: How decisive was this?
  explanation: string           // Why this issue went this way
}

// =============================================================================
// THREAD-LEVEL AGGREGATION
// =============================================================================

/**
 * Thread verdict using traditional methodology
 * Aggregates multiple debate verdicts into overall assessment
 */
export interface TraditionalThreadVerdict {
  threadId: string
  generatedAt: string

  // Individual debate verdicts
  debates: TraditionalDebateVerdict[]

  // Aggregate metrics
  overallWinner: 'pro' | 'con' | 'draw' | 'unresolved'
  proDebatesWon: number
  conDebatesWon: number
  debateDraws: number

  // Quality indicators
  totalIssuesContested: number
  averageClashQuality: number   // 0-10: How well did sides engage?
  averageSpeakerPoints: number  // 0-100

  // Flow health metrics
  totalDroppedArguments: number
  totalConcessions: number
  totalTurns: number            // Arguments turned against their maker

  // Evidence quality distribution
  evidenceDistribution: EvidenceDistribution

  // Final verdict
  verdictConfidence: number     // 0-100
  verdictSummary: string
  recommendedReading: boolean

  // Compatibility with existing ThreadVerdict
  legacyVerdict: LegacyVerdictCompat
}

/**
 * Distribution of evidence types used in the debate
 */
export interface EvidenceDistribution {
  empirical: number
  testimonial: number
  analogical: number
  logical: number
  experiential: number
  unsupported: number
}

/**
 * Compatibility layer for existing ThreadVerdict consumers
 */
export interface LegacyVerdictCompat {
  overallScore: number          // 0-10
  summary: string
  evidenceQualityPct: number
  civilityScore: number
  worthReading: boolean
  keyTakeaways?: string[]
  conclusion?: string
  winningPosition?: 'pro' | 'con' | 'draw' | 'unresolved'
}

// =============================================================================
// FLOW ANALYSIS REQUEST/RESPONSE
// =============================================================================

/**
 * Request to build argument flow from comments
 */
export interface FlowAnalysisRequest {
  comments: FlowComment[]
  centralQuestion: string
  threadTitle: string
  positionDefinitions?: {
    proDefinition: string
    conDefinition: string
  }
}

/**
 * Simplified comment for flow analysis
 */
export interface FlowComment {
  id: string
  parentId: string | null
  author: string
  text: string
  timestamp: string
  karma: number
}

/**
 * Complete flow analysis result
 */
export interface FlowAnalysisResult {
  arguments: FlowArgument[]
  clashes: ClashEvaluation[]
  issues: DebateIssue[]
  speakers: SpeakerEvaluation[]
  burden: BurdenAnalysis
}

// =============================================================================
// SCORING CONFIGURATION
// =============================================================================

/**
 * Configuration for the traditional scoring system
 */
export interface TraditionalScoringConfig {
  // Weights for issue importance calculation
  issueWeights: {
    argumentCount: number       // How much argument count matters
    impactMagnitude: number     // How much impact magnitude matters
    centralityToQuestion: number // How much relevance to central Q matters
  }

  // Thresholds
  droppedArgumentPenalty: number  // Points deducted per dropped argument
  clashQualityThreshold: number   // Minimum clash quality to count
  drawMarginThreshold: number     // Score difference below which it's a draw

  // Speaker point scaling
  speakerPointScale: {
    content: number             // Max points for content (default 40)
    style: number               // Max points for style (default 40)
    strategy: number            // Max points for strategy (default 20)
  }
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: TraditionalScoringConfig = {
  issueWeights: {
    argumentCount: 0.3,
    impactMagnitude: 0.5,
    centralityToQuestion: 0.2
  },
  droppedArgumentPenalty: 5,
  clashQualityThreshold: 3,
  drawMarginThreshold: 5,
  speakerPointScale: {
    content: 40,
    style: 40,
    strategy: 20
  }
}
