/**
 * Pricing Page
 * Credit Packs + Subscription Tiers
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Zap, Crown, Building2, Sparkles } from 'lucide-react'

// Credit Pack data
const CREDIT_PACKS = [
  { id: 'pack_sample', name: 'Sample', credits: 3, price: '$5', perAnalysis: '$1.67' },
  { id: 'pack_basic', name: 'Basic', credits: 10, price: '$15', perAnalysis: '$1.50' },
  { id: 'pack_bundle', name: 'Bundle', credits: 25, price: '$30', perAnalysis: '$1.20', popular: true },
  { id: 'pack_bulk', name: 'Bulk', credits: 60, price: '$60', perAnalysis: '$1.00' },
]

// Subscription Tier data
const SUBSCRIPTION_TIERS = [
  {
    id: 'tier_free',
    name: 'Free',
    price: '$0',
    period: '/month',
    credits: 2,
    icon: Sparkles,
    features: [
      '2 analyses per month',
      'Basic truth scoring',
      'Steel-manned perspectives',
      'Standard queue',
    ],
    cta: 'Get Started',
    ctaVariant: 'outline' as const,
  },
  {
    id: 'tier_analyst',
    name: 'Analyst',
    price: '$19',
    period: '/month',
    credits: 15,
    icon: Zap,
    features: [
      '15 analyses per month',
      'Full analysis features',
      'Priority queue',
      'Analysis history',
      '15% off credit packs',
    ],
    cta: 'Subscribe',
    ctaVariant: 'outline' as const,
  },
  {
    id: 'tier_professional',
    name: 'Professional',
    price: '$39',
    period: '/month',
    credits: 40,
    icon: Crown,
    popular: true,
    features: [
      '40 analyses per month',
      'Full analysis features',
      'Priority queue',
      'Source Intelligence access',
      'Bulk URL upload',
      '15% off credit packs',
    ],
    cta: 'Subscribe',
    ctaVariant: 'default' as const,
  },
  {
    id: 'tier_newsroom',
    name: 'Newsroom',
    price: '$79',
    period: '/month',
    credits: 100,
    icon: Building2,
    features: [
      '100 analyses per month',
      'All Professional features',
      'API access',
      'Team sharing (coming soon)',
      'Custom reports',
      '15% off credit packs',
    ],
    cta: 'Subscribe',
    ctaVariant: 'outline' as const,
  },
]

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <span className="badge-section mb-4 inline-block">Pricing</span>
            <h1 className="font-headline text-4xl md:text-5xl text-foreground mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="font-deck text-xl text-muted-foreground">
              Choose a subscription for regular analysis, or buy credit packs for flexible usage.
              All credits never expire.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Subscription Tiers */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl text-foreground mb-2">Monthly Subscriptions</h2>
            <p className="text-muted-foreground">Get a guaranteed monthly credit allowance</p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  billingPeriod === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  billingPeriod === 'annual'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Annual
                <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                  2 months free
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const Icon = tier.icon
              const annualPrice = tier.price === '$0' ? '$0' : `$${parseInt(tier.price.slice(1)) * 10}`
              const displayPrice = billingPeriod === 'annual' ? annualPrice : tier.price
              const displayPeriod = billingPeriod === 'annual' ? '/year' : '/month'

              return (
                <div
                  key={tier.id}
                  className={`relative border rounded-lg p-6 bg-card ${
                    tier.popular ? 'border-primary border-2' : 'border-border'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-headline text-lg">{tier.name}</h3>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-bold">{displayPrice}</span>
                    <span className="text-muted-foreground">{displayPeriod}</span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    {tier.credits} analyses per month
                  </p>

                  <ul className="space-y-2 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={tier.id === 'tier_free' ? '/auth/signup' : '/auth/signup?plan=' + tier.id}
                    className={`block w-full text-center py-2 px-4 rounded-lg transition-colors ${
                      tier.ctaVariant === 'default'
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-border hover:bg-muted'
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              )
            })}
          </div>
        </section>

        {/* Credit Packs */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl text-foreground mb-2">Credit Packs</h2>
            <p className="text-muted-foreground">
              One-time purchase. Credits never expire. Subscribers get 15% off.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative border rounded-lg p-6 bg-card ${
                  pack.popular ? 'border-primary border-2' : 'border-border'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      Best Value
                    </span>
                  </div>
                )}

                <h3 className="font-headline text-lg mb-2">{pack.name}</h3>

                <div className="mb-2">
                  <span className="text-3xl font-bold">{pack.price}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {pack.credits} credits · {pack.perAnalysis}/analysis
                </p>

                <Link
                  href={`/auth/signup?pack=${pack.id}`}
                  className="block w-full text-center py-2 px-4 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Buy Now
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto">
          <h2 className="font-headline text-2xl text-center mb-8">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">What's the difference between subscription credits and purchased credits?</h3>
              <p className="text-muted-foreground">
                Subscription credits refresh monthly (unused credits don't roll over). Purchased credits never expire
                and can be used anytime. Subscription credits are used first.
              </p>
            </div>

            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">What counts as one analysis?</h3>
              <p className="text-muted-foreground">
                One analysis is a complete evaluation of a single article URL, including truth scoring,
                9-agent analysis, fact-checking, deception detection, and steel-manned perspectives.
              </p>
            </div>

            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">Do subscribers really get 15% off credit packs?</h3>
              <p className="text-muted-foreground">
                Yes! Any active subscriber (Analyst, Professional, or Newsroom) gets 15% off all credit pack purchases.
                The discount is applied automatically at checkout.
              </p>
            </div>

            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">Can I cancel my subscription anytime?</h3>
              <p className="text-muted-foreground">
                Yes, you can cancel anytime. You'll keep access until the end of your billing period.
                Any purchased credits remain in your account.
              </p>
            </div>

            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards (Visa, Mastercard, American Express) through Stripe.
                Enterprise customers can request invoice billing.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
