/**
 * GET /api/credits/balance
 * Returns the current user's credit balance
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateUser,
  getUserIdFromRequest,
  withUserCookie,
  claimDailyCredits,
} from '@/lib/credits'
import type { CreditBalanceResponse } from '@/types/credits'

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request)

  // Get or create user (will give signup bonus if new)
  const user = await getOrCreateUser(userId)

  // Check if this is a new user (created just now)
  const isNewUser =
    new Date(user.createdAt).getTime() > Date.now() - 5000 // Created within last 5 seconds

  const response: CreditBalanceResponse = {
    balance: user.balance,
    lifetimeCredits: user.lifetimeCredits,
    lifetimeSpent: user.lifetimeSpent,
    isNewUser,
  }

  return withUserCookie(
    NextResponse.json(response),
    userId
  )
}

/**
 * POST /api/credits/balance
 * Claim daily credits
 */
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request)

  const result = await claimDailyCredits(userId)

  return withUserCookie(
    NextResponse.json(result),
    userId
  )
}
