/**
 * Credit Middleware
 * Protects API routes by requiring sufficient credits
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { getBalance, spendCredits, getOrCreateUser } from './storage'
import { CREDIT_COSTS, getCreditCost } from './costs'
import { validateDiscountCode, calculateDiscountedCost } from './discount-codes'
import type { CreditAction } from '@/types/credits'

const USER_COOKIE = 'da_uid'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year

/**
 * Get or create user ID from cookies
 */
export async function getUserId(): Promise<string> {
  const cookieStore = await cookies()
  let userId = cookieStore.get(USER_COOKIE)?.value

  if (!userId) {
    userId = `anon_${uuidv4()}`
    // Note: Setting cookies in server components requires special handling
    // The cookie will be set in the API response
  }

  return userId
}

/**
 * Get user ID from request (for API routes)
 */
export function getUserIdFromRequest(request: NextRequest): string {
  const userId = request.cookies.get(USER_COOKIE)?.value
  return userId || `anon_${uuidv4()}`
}

/**
 * Create a response with user cookie set
 */
export function withUserCookie(
  response: NextResponse,
  userId: string
): NextResponse {
  response.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  })
  return response
}

/**
 * Credit check middleware wrapper for API routes
 *
 * Usage:
 * ```
 * export async function POST(request: NextRequest) {
 *   return withCreditCheck(request, 'deep_analysis', async () => {
 *     // Your handler logic here
 *     return NextResponse.json({ success: true, data: result })
 *   })
 * }
 * ```
 */
export async function withCreditCheck(
  request: NextRequest,
  action: CreditAction,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const userId = getUserIdFromRequest(request)
  const baseCost = getCreditCost(action)

  // Ensure user exists (creates with signup bonus if new)
  await getOrCreateUser(userId)

  // Check for discount code in request body or header
  let discountCode: string | null = null
  let discountPercent = 0

  try {
    const clonedRequest = request.clone()
    const body = await clonedRequest.json().catch(() => ({}))
    discountCode = body.discountCode || request.headers.get('X-Discount-Code')
  } catch {
    // No body or not JSON
    discountCode = request.headers.get('X-Discount-Code')
  }

  // Validate discount code if provided
  if (discountCode) {
    const discount = await validateDiscountCode(discountCode, action)
    if (discount.valid) {
      discountPercent = discount.discountPercent
    }
  }

  const finalCost = calculateDiscountedCost(baseCost, discountPercent)

  // Free with valid 100% discount code
  if (finalCost === 0) {
    const response = await handler()
    return withUserCookie(response, userId)
  }

  // Check balance
  const balance = await getBalance(userId)

  if (balance < finalCost) {
    const errorResponse = NextResponse.json(
      {
        success: false,
        error: 'Insufficient credits',
        required: finalCost,
        balance,
        discountApplied: discountPercent > 0,
        discountPercent,
        originalCost: baseCost,
        purchaseUrl: '/purchase',
      },
      { status: 402 } // Payment Required
    )
    return withUserCookie(errorResponse, userId)
  }

  // Execute the handler
  const response = await handler()

  // Parse the response to check if successful
  const responseClone = response.clone()
  let result: { success?: boolean; data?: { threadId?: string } } = {}
  try {
    result = await responseClone.json()
  } catch {
    // Not JSON, assume success
    result = { success: true }
  }

  // Only charge if successful
  if (result.success !== false) {
    await spendCredits(
      userId,
      finalCost,
      `${action}: ${result.data?.threadId || 'unknown'}`,
      {
        action,
        threadId: result.data?.threadId,
        discountCode: discountPercent > 0 ? discountCode || undefined : undefined,
        originalCost: baseCost,
        discountedCost: finalCost,
      }
    )
  }

  return withUserCookie(response, userId)
}

/**
 * Simple balance check without spending (for UI)
 */
export async function checkSufficientCredits(
  userId: string,
  action: CreditAction,
  discountCode?: string
): Promise<{
  sufficient: boolean
  balance: number
  cost: number
  discountApplied: boolean
}> {
  const baseCost = getCreditCost(action)
  let cost = baseCost
  let discountApplied = false

  if (discountCode) {
    const discount = await validateDiscountCode(discountCode, action)
    if (discount.valid) {
      cost = calculateDiscountedCost(baseCost, discount.discountPercent)
      discountApplied = true
    }
  }

  const balance = await getBalance(userId)

  return {
    sufficient: balance >= cost,
    balance,
    cost,
    discountApplied,
  }
}

// Re-export credit costs for convenience
export { CREDIT_COSTS }
