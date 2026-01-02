/**
 * Stripe Payment Integration
 * Handles credit purchases via Stripe Checkout
 */

import Stripe from 'stripe'
import { PURCHASE_TIERS } from '@/types/credits'

// Initialize Stripe (only on server)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })
  : null

/**
 * Get Stripe instance (throws if not configured)
 */
export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.')
  }
  return stripe
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!stripe
}

/**
 * Get product configuration for a tier
 */
export function getTierConfig(tierId: string) {
  const tier = PURCHASE_TIERS.find((t) => t.id === tierId)
  if (!tier) {
    throw new Error(`Invalid tier: ${tierId}`)
  }

  const totalCredits = tier.credits + tier.bonus

  return {
    tier,
    totalCredits,
    priceInCents: tier.priceInCents,
    displayPrice: `$${(tier.priceInCents / 100).toFixed(2)}`,
  }
}

/**
 * Create a Stripe Checkout session for credit purchase
 */
export async function createCheckoutSession(params: {
  tierId: string
  userId: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; sessionId: string }> {
  const stripeClient = getStripe()
  const { tier, totalCredits, priceInCents } = getTierConfig(params.tierId)

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${totalCredits} Credits`,
            description: `Debate Analytics credits for AI-powered analysis${
              tier.bonus > 0 ? ` (includes ${tier.bonus} bonus credits!)` : ''
            }`,
            images: ['https://debate-analytics.vercel.app/og-image.png'],
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      tierId: params.tierId,
      credits: totalCredits.toString(),
    },
    // Allow promotion codes
    allow_promotion_codes: true,
    // Customer email collection
    customer_creation: 'if_required',
    billing_address_collection: 'auto',
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return {
    url: session.url,
    sessionId: session.id,
  }
}

/**
 * Verify and parse a Stripe webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripeClient = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  }

  return stripeClient.webhooks.constructEvent(payload, signature, webhookSecret)
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripeClient = getStripe()
  return stripeClient.checkout.sessions.retrieve(sessionId)
}

/**
 * Format amount for display
 */
export function formatAmount(amountInCents: number): string {
  return `$${(amountInCents / 100).toFixed(2)}`
}

// Re-export Stripe types that might be needed
export type { Stripe }
