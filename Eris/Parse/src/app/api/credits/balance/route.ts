/**
 * GET /api/credits/balance
 * Get current user's complete credit information
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserCreditsInfo, canUserAnalyze } from '@/lib/credits-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const [creditsInfo, analyzeCheck] = await Promise.all([
      getUserCreditsInfo(session.user.id),
      canUserAnalyze(session.user.id),
    ])

    return NextResponse.json({
      success: true,
      data: {
        // Legacy field for backwards compatibility
        balance: creditsInfo.totalAvailable,

        // Detailed breakdown
        credits: {
          purchased: creditsInfo.creditBalance,
          lifetimeTotal: creditsInfo.lifetimeCredits,
          lifetimeSpent: creditsInfo.lifetimeSpent,
        },

        subscription: creditsInfo.subscription
          ? {
              tier: creditsInfo.subscription.tierName,
              tierId: creditsInfo.subscription.tierId,
              monthlyAllowance: creditsInfo.subscription.monthlyCredits,
              used: creditsInfo.subscription.creditsUsedThisMonth,
              remaining: creditsInfo.subscription.creditsRemainingThisMonth,
              renewsAt: creditsInfo.subscription.currentPeriodEnd,
            }
          : null,

        // Analysis availability
        canAnalyze: analyzeCheck.canAnalyze,
        analyzeSource: analyzeCheck.source,
        analyzeBlockReason: analyzeCheck.reason,

        // Total available
        totalAvailable: creditsInfo.totalAvailable,
        isSubscriber: creditsInfo.isSubscriber,
      },
    })
  } catch (error) {
    console.error('Credits balance error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credit balance' },
      { status: 500 }
    )
  }
}
