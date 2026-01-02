/**
 * Credit System Types
 * Defines all types for the credits-based payment system
 */

// User Credits Balance
export interface UserCredits {
  userId: string           // Anonymous or authenticated
  balance: number          // Current credit balance
  lifetimeCredits: number  // Total credits ever received
  lifetimeSpent: number    // Total credits ever spent
  createdAt: string        // First seen (ISO timestamp)
  updatedAt: string        // Last activity (ISO timestamp)
}

// Transaction Record for Audit Trail
export interface CreditTransaction {
  id: string
  userId: string
  type: 'purchase' | 'spend' | 'refund' | 'bonus' | 'daily' | 'signup'
  amount: number           // Positive for add, negative for spend
  balanceAfter: number
  description: string      // Human-readable description
  metadata: CreditTransactionMetadata
  createdAt: string        // ISO timestamp
}

export interface CreditTransactionMetadata {
  action?: CreditAction           // 'deep_analysis', 'claim_verify', etc.
  threadId?: string
  paymentId?: string              // Stripe/Lightning payment ID
  apiCost?: number                // Actual API cost in dollars
  tier?: string                   // Purchase tier
  discountCode?: string           // If discount was applied
  originalCost?: number           // Pre-discount cost
  discountedCost?: number         // Post-discount cost
}

// Credit Cost Configuration
export type CreditAction =
  | 'deep_analysis'
  | 'quick_analysis'
  | 'user_profile'
  | 'claim_verify'
  | 'arena_battle'

// Discount Code Definition
export interface DiscountCode {
  code: string                    // The code itself (case-insensitive)
  type: 'admin' | 'promo' | 'referral' | 'beta'
  discountPercent: number         // 0-100 (100 = free)
  maxUses?: number                // null = unlimited
  currentUses: number             // Track usage
  expiresAt?: string              // ISO date, null = never
  createdBy: string               // Admin who created it
  createdAt: string
  active: boolean
}

// Discount Usage Log
export interface DiscountUsage {
  code: string
  userId: string
  action: string                  // 'deep_analysis', etc.
  creditsSaved: number
  usedAt: string
}

// API Response Types
export interface CreditBalanceResponse {
  balance: number
  lifetimeCredits: number
  lifetimeSpent: number
  isNewUser: boolean
}

export interface CreditSpendResult {
  success: boolean
  newBalance: number
  error?: string
  transactionId?: string
}

export interface DiscountValidationResult {
  valid: boolean
  discountPercent: number
  error?: string
  code?: string
}

// Purchase Tiers
export interface PurchaseTier {
  id: string
  credits: number
  priceInCents: number
  bonus: number
  popular?: boolean
}

export const PURCHASE_TIERS: PurchaseTier[] = [
  { id: 'starter', credits: 100, priceInCents: 100, bonus: 0 },
  { id: 'popular', credits: 500, priceInCents: 450, bonus: 50, popular: true },
  { id: 'pro', credits: 1000, priceInCents: 800, bonus: 250 },
  { id: 'power', credits: 5000, priceInCents: 3500, bonus: 1500 },
]
