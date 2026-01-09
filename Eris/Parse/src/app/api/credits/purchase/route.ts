/**
 * POST /api/credits/purchase
 * Purchase a credit pack
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { purchaseCreditPack, getUserCreditsInfo } from '@/lib/credits-service'
import { CREDIT_PACKS, getCreditPack, getSubscriberPackPrice } from '@/lib/pricing'

// GET: List available credit packs with user-specific pricing
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    let isSubscriber = false
    if (session?.user?.id) {
      const info = await getUserCreditsInfo(session.user.id)
      isSubscriber = info.isSubscriber
    }

    const packs = CREDIT_PACKS.map((pack) => ({
      ...pack,
      // Show discounted price for subscribers
      effectivePrice: isSubscriber ? getSubscriberPackPrice(pack) : pack.price,
      effectivePriceDisplay: isSubscriber
        ? `$${(getSubscriberPackPrice(pack) / 100).toFixed(2)}`
        : pack.priceDisplay,
      discount: isSubscriber ? '15%' : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        packs,
        isSubscriber,
      },
    })
  } catch (error) {
    console.error('Error fetching credit packs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credit packs' },
      { status: 500 }
    )
  }
}

// POST: Purchase a credit pack
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { packId, stripePaymentIntentId } = body

    if (!packId) {
      return NextResponse.json(
        { success: false, error: 'Pack ID is required' },
        { status: 400 }
      )
    }

    const pack = getCreditPack(packId)
    if (!pack) {
      return NextResponse.json(
        { success: false, error: 'Invalid pack ID' },
        { status: 400 }
      )
    }

    // In production, verify Stripe payment here
    // For now, we'll allow direct purchase (for testing)
    if (process.env.NODE_ENV === 'production' && !stripePaymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'Payment verification required' },
        { status: 400 }
      )
    }

    const result = await purchaseCreditPack(
      session.user.id,
      packId,
      stripePaymentIntentId
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        pack: {
          name: pack.name,
          credits: pack.credits,
        },
      },
    })
  } catch (error) {
    console.error('Error purchasing credits:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to purchase credits' },
      { status: 500 }
    )
  }
}
