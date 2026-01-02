/**
 * Debate Arena Types
 * Types for the competitive debate arena with blind submissions and battles
 */

export interface ArenaSubmission {
  id: string
  arenaId: string
  position: 'pro' | 'con'
  author: string
  authorId: string
  argumentText: string
  sources: Array<{
    title: string
    url: string
    quote: string
  }>
  submittedAt: string
  isRevealed: boolean
  firstRevealedInRound?: number
  currentScore?: number
  scoreHistory?: number[]
  trend?: 'improving' | 'declining' | 'stable'
}

export interface BattleArgumentAnalysis {
  submissionId: string
  claims: Array<{
    text: string
    verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable'
    confidence: number
  }>
  argumentStructure: {
    type: 'deductive' | 'inductive' | 'analogical' | 'abductive' | 'mixed'
    validity: 'valid' | 'invalid' | 'uncertain'
  }
  sourceQuality: number
  logicScore: number
  overallScore: number
}

export interface BattleResult {
  winner: 'pro' | 'con' | 'draw'
  proScore: number
  conScore: number
  confidence: number
  verdictSummary: string
  reasoningChain: string[]
  argumentRankings: Array<{
    submissionId: string
    rank: number
    score: number
    position: 'pro' | 'con'
    preview: string
    analysis: BattleArgumentAnalysis
  }>
  metrics: {
    proAvgScore: number
    conAvgScore: number
    proSourceQuality: number
    conSourceQuality: number
    proLogicValidity: number
    conLogicValidity: number
    proClaimAccuracy: number
    conClaimAccuracy: number
  }
  claimBreakdown: Array<{
    claim: string
    source: 'pro' | 'con'
    verdict: string
    confidence: number
  }>
  generatedAt: string
}

export interface BattleRound {
  id: string
  arenaId: string
  round: number
  triggeredBy: string
  triggeredAt: string
  paymentTxId?: string
  includedSubmissionIds: string[]
  newSubmissionIds: string[]
  result: BattleResult
  previousRoundId?: string
  scoreDeltas?: Array<{
    submissionId: string
    previousScore: number
    newScore: number
    delta: number
    reason: string
  }>
}

export interface DebateArena {
  id: string
  threadId: string
  topic: string
  description: string
  createdAt: string
  createdBy: string
  status: 'active' | 'closed'
  submissions: ArenaSubmission[]
  battles: BattleRound[]
  totalBattles: number
  latestBattleId?: string
  pendingNewArguments: number
  proCount: number
  conCount: number
  minSubmissionsPerSide: number
  battleCostUsd: number
}

export interface ArenaInvoice {
  id: string
  arenaId: string
  bolt11: string
  amountSats: number
  amountUsd: number
  expiresAt: string
  status: 'pending' | 'paid' | 'expired'
  paidAt?: string
}

// Helper functions
export function getWinnerLabel(winner: BattleResult['winner']): string {
  switch (winner) {
    case 'pro': return 'PRO Wins'
    case 'con': return 'CON Wins'
    case 'draw': return 'Draw'
  }
}

export function getWinnerColor(winner: BattleResult['winner']): string {
  switch (winner) {
    case 'pro': return 'text-success'
    case 'con': return 'text-danger'
    case 'draw': return 'text-warning'
  }
}

export function getWinnerBg(winner: BattleResult['winner']): string {
  switch (winner) {
    case 'pro': return 'bg-success/20'
    case 'con': return 'bg-danger/20'
    case 'draw': return 'bg-warning/20'
  }
}
