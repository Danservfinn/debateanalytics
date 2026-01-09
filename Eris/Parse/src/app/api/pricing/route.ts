/**
 * GET /api/pricing
 * Get all pricing information (credit packs and subscription tiers)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserCreditsInfo } from '@/lib/credits-service'
import {
  CREDIT_PACKS,
  SUBSCRIPTION_TIERS,
  getSubscriberPackPrice,
} from '@/lib/pricing'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    let isSubscriber = false
    let currentTierId: string | null = null

    if (session?.user?.id) {
      const info = await getUserCreditsInfo(session.user.id)
      isSubscriber = info.isSubscriber
      currentTierId = info.subscription?.tierId ?? null
    }

    // Format credit packs with subscriber pricing
    const creditPacks = CREDIT_PACKS.map((pack) => ({
      id: pack.id,
      name: pack.name,
      credits: pack.credits,
      price: pack.price,
      priceDisplay: pack.priceDisplay,
      perAnalysis: pack.perAnalysis,
      popular: pack.popular ?? false,
      // Subscriber benefits
      subscriberPrice: getSubscriberPackPrice(pack),
      subscriberPriceDisplay: `$${(getSubscriberPackPrice(pack) / 100).toFixed(2)}`,
      // Effective price for current user
      effectivePrice: isSubscriber ? getSubscriberPackPrice(pack) : pack.price,
    }))

    // Format subscription tiers
    const subscriptionTiers = SUBSCRIPTION_TIERS.map((tier) => ({
      id: tier.id,
      name: tier.name,
      monthlyCredits: tier.monthlyCredits,
      price: tier.price,
      priceDisplay: tier.priceDisplay,
      perAnalysis: tier.perAnalysis,
      features: tier.features,
      popular: tier.popular ?? false,
      // Annual pricing (2 months free)
      annualPrice: tier.price * 10,
      annualPriceDisplay: `$${((tier.price * 10) / 100).toFixed(0)}`,
      annualSavings: tier.price * 2,
      // Current user status
      isCurrent: tier.id === currentTierId,
    }))

    return NextResponse.json({
      success: true,
      data: {
        creditPacks,
        subscriptionTiers,
        user: {
          isSubscriber,
          currentTierId,
          packDiscount: isSubscriber ? '15%' : null,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching pricing:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing' },
      { status: 500 }
    )
  }
}
