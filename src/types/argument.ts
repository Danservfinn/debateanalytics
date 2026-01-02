/**
 * Argument Composer Types
 *
 * Types for the AI-powered argument analysis and coaching feature.
 * Uses traditional debate scoring criteria.
 */

export type ArgumentPosition = 'pro' | 'con' | 'neutral';

export type ScoreCriterion =
  | 'claim_clarity'
  | 'evidence_quality'
  | 'logical_structure'
  | 'engagement'
  | 'persuasiveness'
  | 'civility';

export type IssueType =
  | 'weak_evidence'
  | 'logical_fallacy'
  | 'missing_rebuttal'
  | 'unclear_claim'
  | 'tone_issue'
  | 'off_topic'
  | 'unsupported_claim'
  | 'redundant'
  | 'weak_conclusion';

export type IssueSeverity = 'critical' | 'major' | 'minor';

export type LetterGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export type DebateReadiness = 'ready' | 'needs_work' | 'not_ready';

/**
 * Context passed to the argument analyzer
 */
export interface ArgumentContext {
  centralQuestion: string;
  proDefinition: string;
  conDefinition: string;
  threadTitle: string;
  keyArguments?: string[];
}

/**
 * User's argument submission
 */
export interface ArgumentSubmission {
  text: string;
  position: ArgumentPosition;
  context: ArgumentContext;
}

/**
 * Individual criterion score with feedback
 */
export interface ArgumentScore {
  criterion: ScoreCriterion;
  score: number; // 0-10
  label: string; // Human-readable criterion name
  feedback: string; // Specific feedback for this criterion
}

/**
 * Individual issue found in the argument
 */
export interface ArgumentIssue {
  id: string;
  severity: IssueSeverity;
  type: IssueType;
  quote: string; // The problematic text
  explanation: string;
  suggestion: string;
  fixedText?: string; // Optional auto-fix replacement
}

/**
 * Complete analysis result
 */
export interface ArgumentAnalysisResult {
  overallScore: number; // 0-100
  letterGrade: LetterGrade;
  scores: ArgumentScore[];
  issues: ArgumentIssue[];
  strengths: string[];
  improvedVersion: string;
  improvementSummary: string;
  debateReadiness: DebateReadiness;
}

/**
 * API response for argument analysis
 */
export interface AnalyzeArgumentResponse {
  success: boolean;
  data?: ArgumentAnalysisResult;
  error?: string;
}

/**
 * Criterion display configuration
 */
export const CRITERION_CONFIG: Record<ScoreCriterion, { label: string; description: string; icon: string }> = {
  claim_clarity: {
    label: 'Claim Clarity',
    description: 'Is the thesis clear and directly addresses the question?',
    icon: 'Target'
  },
  evidence_quality: {
    label: 'Evidence Quality',
    description: 'Are claims supported with specific, credible evidence?',
    icon: 'FileCheck'
  },
  logical_structure: {
    label: 'Logical Structure',
    description: 'Does reasoning flow logically without fallacies?',
    icon: 'GitBranch'
  },
  engagement: {
    label: 'Engagement',
    description: 'Does it address opposing arguments?',
    icon: 'MessagesSquare'
  },
  persuasiveness: {
    label: 'Persuasiveness',
    description: 'Would it convince a neutral observer?',
    icon: 'Sparkles'
  },
  civility: {
    label: 'Civility',
    description: 'Is the tone respectful and professional?',
    icon: 'Heart'
  }
};

/**
 * Issue severity configuration
 */
export const SEVERITY_CONFIG: Record<IssueSeverity, { label: string; color: string; bgColor: string }> = {
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20'
  },
  major: {
    label: 'Major',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20'
  },
  minor: {
    label: 'Minor',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20'
  }
};

/**
 * Grade configuration for display
 */
export const GRADE_CONFIG: Record<LetterGrade, { color: string; bgColor: string; description: string }> = {
  'A+': { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', description: 'Exceptional' },
  'A': { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', description: 'Excellent' },
  'A-': { color: 'text-green-400', bgColor: 'bg-green-500/20', description: 'Very Good' },
  'B+': { color: 'text-green-400', bgColor: 'bg-green-500/20', description: 'Good' },
  'B': { color: 'text-lime-400', bgColor: 'bg-lime-500/20', description: 'Above Average' },
  'B-': { color: 'text-lime-400', bgColor: 'bg-lime-500/20', description: 'Satisfactory' },
  'C+': { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', description: 'Fair' },
  'C': { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', description: 'Average' },
  'C-': { color: 'text-orange-400', bgColor: 'bg-orange-500/20', description: 'Below Average' },
  'D': { color: 'text-orange-400', bgColor: 'bg-orange-500/20', description: 'Poor' },
  'F': { color: 'text-red-400', bgColor: 'bg-red-500/20', description: 'Failing' }
};

/**
 * Calculate letter grade from numeric score
 */
export function getLetterGrade(score: number): LetterGrade {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Calculate debate readiness from score
 */
export function getDebateReadiness(score: number): DebateReadiness {
  if (score >= 80) return 'ready';
  if (score >= 60) return 'needs_work';
  return 'not_ready';
}
