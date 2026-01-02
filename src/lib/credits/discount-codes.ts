/**
 * Discount Code Validation
 * Handles admin codes (from env) and promotional codes (from KV)
 */

import { kv } from '@vercel/kv'
import type { DiscountCode, DiscountValidationResult } from '@/types/credits'

// Admin codes stored in environment
// Format: CODE1:percent,CODE2:percent (e.g., ADMIN100:100,ADMIN50:50)
const ADMIN_CODES_MAP = new Map<string, number>()
;(process.env.ADMIN_DISCOUNT_CODES || '')
  .split(',')
  .filter(Boolean)
  .forEach((entry) => {
    const [code, percent] = entry.split(':')
    if (code && percent) {
      ADMIN_CODES_MAP.set(code.trim().toUpperCase(), parseInt(percent, 10))
    }
  })

/**
 * Check if Vercel KV is configured
 */
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

/**
 * Validate a discount code
 */
export async function validateDiscountCode(
  code: string,
  action: string = 'unknown'
): Promise<DiscountValidationResult> {
  if (!code || typeof code !== 'string') {
    return { valid: false, discountPercent: 0, error: 'Code required' }
  }

  const normalizedCode = code.trim().toUpperCase()

  // Check admin codes first (from env, unlimited uses)
  if (ADMIN_CODES_MAP.has(normalizedCode)) {
    const discountPercent = ADMIN_CODES_MAP.get(normalizedCode)!
    await logDiscountUsage(normalizedCode, 'admin', action, discountPercent)
    return { valid: true, discountPercent, code: normalizedCode }
  }

  // If KV not configured, only admin codes work
  if (!isKVConfigured()) {
    return { valid: false, discountPercent: 0, error: 'Invalid code' }
  }

  try {
    // Check database for other codes
    const discountCode = await kv.get<DiscountCode>(`discount:${normalizedCode}`)

    if (!discountCode) {
      return { valid: false, discountPercent: 0, error: 'Invalid code' }
    }

    if (!discountCode.active) {
      return { valid: false, discountPercent: 0, error: 'Code is inactive' }
    }

    if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
      return { valid: false, discountPercent: 0, error: 'Code has expired' }
    }

    if (discountCode.maxUses && discountCode.currentUses >= discountCode.maxUses) {
      return { valid: false, discountPercent: 0, error: 'Code usage limit reached' }
    }

    // Increment usage
    await kv.set(`discount:${normalizedCode}`, {
      ...discountCode,
      currentUses: discountCode.currentUses + 1,
    })

    await logDiscountUsage(
      normalizedCode,
      discountCode.type,
      action,
      discountCode.discountPercent
    )

    return {
      valid: true,
      discountPercent: discountCode.discountPercent,
      code: normalizedCode,
    }
  } catch (error) {
    console.error('Failed to validate discount code:', error)
    return { valid: false, discountPercent: 0, error: 'Validation failed' }
  }
}

/**
 * Calculate the discounted cost
 */
export function calculateDiscountedCost(
  baseCost: number,
  discountPercent: number
): number {
  if (discountPercent >= 100) return 0
  return Math.ceil(baseCost * (1 - discountPercent / 100))
}

/**
 * Log discount code usage (for analytics)
 */
async function logDiscountUsage(
  code: string,
  type: string,
  action: string,
  discountPercent: number
): Promise<void> {
  if (!isKVConfigured()) return

  try {
    const usage = {
      code,
      type,
      action,
      discountPercent,
      usedAt: new Date().toISOString(),
    }

    // Add to usage log (keep last 1000)
    await kv.lpush('discount:usage:log', JSON.stringify(usage))
    await kv.ltrim('discount:usage:log', 0, 999)

    // Increment code usage counter
    await kv.incr(`discount:usage:count:${code}`)
  } catch (error) {
    console.error('Failed to log discount usage:', error)
  }
}

/**
 * Create a new discount code (admin function)
 */
export async function createDiscountCode(
  code: string,
  discountPercent: number,
  type: 'promo' | 'referral' | 'beta',
  options: {
    maxUses?: number
    expiresInDays?: number
    createdBy?: string
  } = {}
): Promise<DiscountCode | null> {
  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, cannot create discount code')
    return null
  }

  const normalizedCode = code.trim().toUpperCase()

  const discountCode: DiscountCode = {
    code: normalizedCode,
    type,
    discountPercent,
    maxUses: options.maxUses,
    currentUses: 0,
    expiresAt: options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    createdBy: options.createdBy || 'admin',
    createdAt: new Date().toISOString(),
    active: true,
  }

  try {
    await kv.set(`discount:${normalizedCode}`, discountCode)
    return discountCode
  } catch (error) {
    console.error('Failed to create discount code:', error)
    return null
  }
}

/**
 * Deactivate a discount code
 */
export async function deactivateDiscountCode(code: string): Promise<boolean> {
  if (!isKVConfigured()) return false

  const normalizedCode = code.trim().toUpperCase()

  try {
    const discountCode = await kv.get<DiscountCode>(`discount:${normalizedCode}`)
    if (!discountCode) return false

    await kv.set(`discount:${normalizedCode}`, {
      ...discountCode,
      active: false,
    })

    return true
  } catch (error) {
    console.error('Failed to deactivate discount code:', error)
    return false
  }
}
