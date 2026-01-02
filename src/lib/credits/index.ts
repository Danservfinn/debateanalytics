/**
 * Credits System - Main Exports
 *
 * Usage:
 * ```typescript
 * import {
 *   getBalance,
 *   spendCredits,
 *   withCreditCheck,
 *   CREDIT_COSTS
 * } from '@/lib/credits'
 * ```
 */

// Storage operations
export {
  getBalance,
  getUserCredits,
  getOrCreateUser,
  initializeNewUser,
  spendCredits,
  addCredits,
  claimDailyCredits,
  getTransactionHistory,
} from './storage'

// Cost configuration
export {
  CREDIT_COSTS,
  ESTIMATED_API_COSTS,
  FREE_TIER,
  getCreditCost,
  getActionDisplayName,
} from './costs'

// Discount codes
export {
  validateDiscountCode,
  calculateDiscountedCost,
  createDiscountCode,
  deactivateDiscountCode,
} from './discount-codes'

// Middleware
export {
  withCreditCheck,
  getUserId,
  getUserIdFromRequest,
  withUserCookie,
  checkSufficientCredits,
} from './middleware'

// Re-export types
export type {
  UserCredits,
  CreditTransaction,
  CreditTransactionMetadata,
  CreditAction,
  CreditSpendResult,
  CreditBalanceResponse,
  DiscountCode,
  DiscountUsage,
  DiscountValidationResult,
  PurchaseTier,
} from '@/types/credits'

export { PURCHASE_TIERS } from '@/types/credits'
