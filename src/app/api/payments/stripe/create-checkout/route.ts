/**
 * POST /api/payments/stripe/create-checkout
 * Creates a Stripe Checkout session for credit purchase
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, withUserCookie } from '@/lib/credits'
import { createCheckoutSession, isStripeConfigured, getTierConfig } from '@/lib/payments'

export async function POST(request: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { tierId } = body

    if (!tierId || typeof tierId !== 'string') {
      return NextResponse.json(
        { error: 'Tier ID required' },
        { status: 400 }
      )
    }

    // Validate tier exists
    try {
      getTierConfig(tierId)
    } catch {
      return NextResponse.json(
        { error: 'Invalid tier' },
        { status: 400 }
      )
    }

    const userId = getUserIdFromRequest(request)

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://debate-analytics.vercel.app'
    const successUrl = `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/purchase?canceled=true`

    // Create checkout session
    const { url, sessionId } = await createCheckoutSession({
      tierId,
      userId,
      successUrl,
      cancelUrl,
    })

    const response = NextResponse.json({
      url,
      sessionId,
    })

    return withUserCookie(response, userId)
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
