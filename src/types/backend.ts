/**
 * Backend API Types
 * Types matching the Railway backend API response schema
 */

// Quality breakdown from backend profile synthesis
export interface QualityBreakdown {
  structure: number
  evidence: number
  counterargument: number
  persuasiveness: number
  civility: number
}

// Archetype analysis from backend
export interface DebateArchetype {
  primary: string
  secondary?: string
  blend?: string
  signature_moves: string[]
  blindspots: string[]
  growth_areas: string[]
}

// MBTI inference from backend
export interface MBTIProfile {
  type: string
  confidence: number
  dimension_analysis: {
    EI: { score: number; evidence: string[] }
    SN: { score: number; evidence: string[] }
    TF: { score: number; evidence: string[] }
    JP: { score: number; evidence: string[] }
  }
  debate_implications: string[]
}

// Good faith assessment from backend
export interface GoodFaithAssessment {
  score: number
  assessment: string
  positive_indicators: string[]
  negative_indicators: string[]
}

// Knowledge profile from backend
export interface KnowledgeProfile {
  primary_domains: string[]
  depth_assessment: Record<string, number>
  cross_domain_connections: string[]
}

// Topic expertise from backend
export interface TopicExpertise {
  topic: string
  expertise_level: number
  confidence: number
  evidence_count: number
}

// Top argument from backend
export interface TopArgument {
  rank: number
  category: string
  title: string
  snippet: string
  context: {
    subreddit: string
    thread_title: string
    opponent_position?: string
    outcome?: string
  }
  quality_breakdown: QualityBreakdown
  why_exceptional: string
  techniques_used: string[]
}

// Signature technique from backend
export interface SignatureTechnique {
  name: string
  category: string
  frequency: 'high' | 'moderate' | 'low'
  effectiveness: string
  example?: string
}

// Fallacy instance from backend
export interface FallacyInstance {
  type: string
  severity: 'minor' | 'moderate' | 'major'
  quote: string
  context: string
  explanation: string
}

// Fallacy profile from backend
export interface BackendFallacyProfile {
  total_fallacies: number
  ranked_fallacies: Array<{
    type: string
    count: number
    severity_breakdown: Record<string, number>
    instances: FallacyInstance[]
  }>
  patterns: string[]
  risk_areas: string[]
}

// Full user profile from backend API
export interface BackendUserProfile {
  username: string
  cached: boolean
  cached_at?: string
  analysis_available: boolean

  // Core scores
  overall_score?: number
  debates_analyzed?: number
  total_comments?: number

  // Rich analysis data
  quality_breakdown?: QualityBreakdown
  archetype?: DebateArchetype
  mbti?: MBTIProfile
  good_faith?: GoodFaithAssessment
  knowledge_profile?: KnowledgeProfile
  signature_techniques?: SignatureTechnique[]

  // Optional detailed sections (when include_* params are true)
  fallacy_profile?: BackendFallacyProfile
  top_arguments?: TopArgument[]
  topic_expertise?: TopicExpertise[]
  debates?: unknown[]

  // Stats summary
  stats?: {
    debates_analyzed: number
    total_comments: number
    overall_score?: number
  }

  // Error states
  message?: string
}

// Analysis job status from backend
export interface AnalysisJobStatus {
  username: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'not_found'
  started_at?: string
  completed_at?: string
  progress?: {
    stage: string
    percent: number
  }
  error?: string
  message?: string
  cached_at?: string
}

// Trigger analysis request
export interface TriggerAnalysisRequest {
  force_refresh?: boolean
  max_comments?: number
  max_threads?: number
}
