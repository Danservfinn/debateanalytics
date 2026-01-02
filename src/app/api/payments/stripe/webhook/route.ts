/**
 * POST /api/payments/stripe/webhook
 * Handles Stripe webhook events for payment confirmation
 */

import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent, isStripeConfigured } from '@/lib/payments'
import { addCredits } from '@/lib/credits'
import type { Stripe } from 'stripe'

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 503 }
    )
  }

  try {
    // Get raw body and signature
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = constructWebhookEvent(body, signature)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Extract metadata
        const userId = session.metadata?.userId
        const tierId = session.metadata?.tierId
        const credits = parseInt(session.metadata?.credits || '0', 10)

        if (!userId || !credits) {
          console.error('Missing metadata in checkout session:', session.id)
          break
        }

        console.log(`Processing payment for user ${userId}: ${credits} credits (tier: ${tierId})`)

        // Add credits to user account
        try {
          const newBalance = await addCredits(
            userId,
            credits,
            `Purchased ${tierId} tier (${credits} credits)`,
            {
              paymentId: session.id,
              tier: tierId,
            }
          )

          console.log(`Credits added. New balance for ${userId}: ${newBalance}`)
        } catch (error) {
          console.error('Failed to add credits:', error)
          // Don't return error - Stripe will retry the webhook
          // We should have idempotency handling in production
        }

        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`Checkout session expired: ${session.id}`)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`Payment failed: ${paymentIntent.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
