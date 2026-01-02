/**
 * Credit Cost Configuration
 * Defines credit costs for each action (ensuring ≥3x API cost markup)
 */

import type { CreditAction } from '@/types/credits'

/**
 * Credit costs per action
 *
 * Pricing rule: User pays ≥3x API cost
 *
 * | Action           | API Cost | Credits | User Pays | Markup |
 * |------------------|----------|---------|-----------|--------|
 * | deep_analysis    | ~$0.08   | 25      | $0.25     | 3.1x   |
 * | quick_analysis   | ~$0.02   | 10      | $0.10     | 5x     |
 * | user_profile     | ~$0.05   | 15      | $0.15     | 3x     |
 * | claim_verify     | ~$0.01   | 5       | $0.05     | 5x     |
 * | arena_battle     | ~$0.15   | 50      | $0.50     | 3.3x   |
 */
export const CREDIT_COSTS: Record<CreditAction, number> = {
  deep_analysis: 25,
  quick_analysis: 10,
  user_profile: 15,
  claim_verify: 5,
  arena_battle: 50,
} as const

/**
 * Estimated API costs in dollars (for margin tracking)
 */
export const ESTIMATED_API_COSTS: Record<CreditAction, number> = {
  deep_analysis: 0.08,
  quick_analysis: 0.02,
  user_profile: 0.05,
  claim_verify: 0.01,
  arena_battle: 0.15,
} as const

/**
 * Free tier configuration
 */
export const FREE_TIER = {
  SIGNUP_CREDITS: 25,        // Credits given on first visit (1 free deep analysis)
  DAILY_CREDITS: 5,          // Credits given daily
  DAILY_CAP: 25,             // Max free credits that can accumulate
} as const

/**
 * Get the credit cost for an action
 */
export function getCreditCost(action: CreditAction): number {
  return CREDIT_COSTS[action] ?? 0
}

/**
 * Get human-readable action name
 */
export function getActionDisplayName(action: CreditAction): string {
  const names: Record<CreditAction, string> = {
    deep_analysis: 'Deep Thread Analysis',
    quick_analysis: 'Quick Analysis',
    user_profile: 'User Profile Analysis',
    claim_verify: 'Claim Verification',
    arena_battle: 'Arena Battle',
  }
  return names[action] ?? action
}
