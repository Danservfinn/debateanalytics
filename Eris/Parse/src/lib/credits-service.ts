/**
 * Credits Service
 * Handles all credit operations: balance checks, purchases, deductions
 */

import { prisma } from './prisma'
import {
  CREDIT_PACKS,
  SUBSCRIPTION_TIERS,
  FREE_TIER_LIMITS,
  getCreditPack,
  getSubscriptionTier,
  getSubscriberPackPrice,
} from './pricing'

// ============================================================================
// Types
// ============================================================================

export interface UserCreditsInfo {
  // Credit balance (purchased credits)
  creditBalance: number
  lifetimeCredits: number
  lifetimeSpent: number

  // Subscription info
  subscription: {
    tierId: string
    tierName: string
    monthlyCredits: number
    creditsUsedThisMonth: number
    creditsRemainingThisMonth: number
    currentPeriodEnd: Date | null
    isActive: boolean
  } | null

  // Total available for analysis
  totalAvailable: number

  // Is subscriber (for pack discounts)
  isSubscriber: boolean
}

export interface PurchaseResult {
  success: boolean
  error?: string
  newBalance?: number
  transactionId?: string
}

export interface DeductResult {
  success: boolean
  error?: string
  source: 'subscription' | 'credits'
  newBalance?: number
  newSubscriptionUsage?: number
}

// ============================================================================
// Get User Credits Info
// ============================================================================

export async function getUserCreditsInfo(userId: string): Promise<UserCreditsInfo> {
  const [credits, subscription] = await Promise.all([
    prisma.credits.findUnique({ where: { userId } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ])

  const creditBalance = credits?.balance ?? 0
  const lifetimeCredits = credits?.lifetimeCredits ?? 0
  const lifetimeSpent = credits?.lifetimeSpent ?? 0

  let subscriptionInfo: UserCreditsInfo['subscription'] = null

  if (subscription && subscription.status === 'active') {
    const tier = getSubscriptionTier(subscription.tierId)
    subscriptionInfo = {
      tierId: subscription.tierId,
      tierName: tier?.name ?? 'Unknown',
      monthlyCredits: subscription.analysesPerMonth,
      creditsUsedThisMonth: subscription.analysesUsedThisMonth,
      creditsRemainingThisMonth: Math.max(
        0,
        subscription.analysesPerMonth - subscription.analysesUsedThisMonth
      ),
      currentPeriodEnd: subscription.currentPeriodEnd,
      isActive: true,
    }
  }

  // Free tier users get monthly analyses
  const freeCreditsRemaining = subscriptionInfo
    ? 0
    : FREE_TIER_LIMITS.MONTHLY_ANALYSES

  const totalAvailable =
    creditBalance +
    (subscriptionInfo?.creditsRemainingThisMonth ?? freeCreditsRemaining)

  return {
    creditBalance,
    lifetimeCredits,
    lifetimeSpent,
    subscription: subscriptionInfo,
    totalAvailable,
    isSubscriber: subscriptionInfo !== null,
  }
}

// ============================================================================
// Check If User Can Analyze
// ============================================================================

export async function canUserAnalyze(userId: string): Promise<{
  canAnalyze: boolean
  reason?: string
  source?: 'subscription' | 'credits' | 'free'
}> {
  const info = await getUserCreditsInfo(userId)

  // Check subscription credits first
  if (info.subscription && info.subscription.creditsRemainingThisMonth > 0) {
    return { canAnalyze: true, source: 'subscription' }
  }

  // Check purchased credits
  if (info.creditBalance > 0) {
    return { canAnalyze: true, source: 'credits' }
  }

  // Check free tier daily allowance
  if (!info.subscription) {
    const today = new Date().toISOString().split('T')[0]
    const dailyFree = await prisma.dailyFreeAnalysis.findUnique({
      where: { userId },
    })

    if (!dailyFree || dailyFree.date !== today) {
      return { canAnalyze: true, source: 'free' }
    }

    if (dailyFree.count < FREE_TIER_LIMITS.MONTHLY_ANALYSES) {
      return { canAnalyze: true, source: 'free' }
    }
  }

  return {
    canAnalyze: false,
    reason: info.subscription
      ? 'You have used all your subscription credits this month. Purchase additional credits to continue.'
      : 'You have used your free analyses. Subscribe or purchase credits to continue.',
  }
}

// ============================================================================
// Deduct Credits for Analysis
// ============================================================================

export async function deductForAnalysis(
  userId: string,
  analysisId?: string
): Promise<DeductResult> {
  const canAnalyzeResult = await canUserAnalyze(userId)

  if (!canAnalyzeResult.canAnalyze) {
    return {
      success: false,
      error: canAnalyzeResult.reason,
      source: 'credits',
    }
  }

  const source = canAnalyzeResult.source!

  return await prisma.$transaction(async (tx) => {
    if (source === 'subscription') {
      // Deduct from subscription
      const subscription = await tx.subscription.update({
        where: { userId },
        data: {
          analysesUsedThisMonth: { increment: 1 },
        },
      })

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'SUBSCRIPTION_USE',
          amount: 0,
          description: 'Analysis (subscription)',
          metadata: analysisId ? { analysisId } : undefined,
        },
      })

      return {
        success: true,
        source: 'subscription' as const,
        newSubscriptionUsage: subscription.analysesUsedThisMonth,
      }
    } else if (source === 'credits') {
      // Deduct from purchased credits
      const credits = await tx.credits.update({
        where: { userId },
        data: {
          balance: { decrement: 1 },
          lifetimeSpent: { increment: 1 },
        },
      })

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'SPEND',
          amount: -1,
          description: 'Analysis',
          metadata: analysisId ? { analysisId } : undefined,
        },
      })

      return {
        success: true,
        source: 'credits' as const,
        newBalance: credits.balance,
      }
    } else {
      // Free tier - update daily count
      const today = new Date().toISOString().split('T')[0]

      await tx.dailyFreeAnalysis.upsert({
        where: { userId },
        create: {
          userId,
          date: today,
          count: 1,
        },
        update: {
          date: today,
          count: { increment: 1 },
        },
      })

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'FREE_USE',
          amount: 0,
          description: 'Free analysis',
          metadata: analysisId ? { analysisId } : undefined,
        },
      })

      return {
        success: true,
        source: 'credits' as const, // Treat free as credits for simplicity
        newBalance: 0,
      }
    }
  })
}

// ============================================================================
// Purchase Credit Pack
// ============================================================================

export async function purchaseCreditPack(
  userId: string,
  packId: string,
  stripePaymentIntentId?: string
): Promise<PurchaseResult> {
  const pack = getCreditPack(packId)

  if (!pack) {
    return { success: false, error: 'Invalid pack' }
  }

  // Check if user is subscriber for discount
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })
  const isSubscriber = subscription?.status === 'active'

  const price = isSubscriber ? getSubscriberPackPrice(pack) : pack.price

  return await prisma.$transaction(async (tx) => {
    // Add credits
    const credits = await tx.credits.upsert({
      where: { userId },
      create: {
        userId,
        balance: pack.credits,
        lifetimeCredits: pack.credits,
        lifetimeSpent: 0,
      },
      update: {
        balance: { increment: pack.credits },
        lifetimeCredits: { increment: pack.credits },
      },
    })

    // Record transaction
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: 'PURCHASE',
        amount: price,
        description: `Purchased ${pack.name} pack (${pack.credits} credits)`,
        metadata: {
          packId,
          credits: pack.credits,
          stripePaymentIntentId,
          subscriberDiscount: isSubscriber,
        },
      },
    })

    return {
      success: true,
      newBalance: credits.balance,
      transactionId: transaction.id,
    }
  })
}

// ============================================================================
// Initialize Credits for New User
// ============================================================================

export async function initializeUserCredits(userId: string): Promise<void> {
  await prisma.credits.upsert({
    where: { userId },
    create: {
      userId,
      balance: FREE_TIER_LIMITS.SIGNUP_BONUS_CREDITS,
      lifetimeCredits: FREE_TIER_LIMITS.SIGNUP_BONUS_CREDITS,
      lifetimeSpent: 0,
    },
    update: {}, // Don't modify if exists
  })

  // Record the signup bonus
  await prisma.transaction.create({
    data: {
      userId,
      type: 'SIGNUP_BONUS',
      amount: 0,
      description: `Welcome bonus: ${FREE_TIER_LIMITS.SIGNUP_BONUS_CREDITS} free credits`,
      metadata: {
        credits: FREE_TIER_LIMITS.SIGNUP_BONUS_CREDITS,
      },
    },
  })
}

// ============================================================================
// Reset Monthly Subscription Credits
// ============================================================================

export async function resetSubscriptionCredits(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: {
      analysesUsedThisMonth: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}

// ============================================================================
// Get Transaction History
// ============================================================================

export async function getTransactionHistory(
  userId: string,
  limit = 50
): Promise<{
  transactions: Array<{
    id: string
    type: string
    amount: number
    description: string | null
    createdAt: Date
  }>
}> {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      createdAt: true,
    },
  })

  return { transactions }
}
