/**
 * Pricing Configuration
 * Credit packs and subscription tiers
 */

// ============================================================================
// Credit Packs (One-Time Purchase)
// ============================================================================

export interface CreditPack {
  id: string
  name: string
  credits: number
  price: number // in cents
  priceDisplay: string
  perAnalysis: string
  popular?: boolean
  stripePriceId?: string
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_sample',
    name: 'Sample',
    credits: 3,
    price: 500,
    priceDisplay: '$5',
    perAnalysis: '$1.67',
  },
  {
    id: 'pack_basic',
    name: 'Basic',
    credits: 10,
    price: 1500,
    priceDisplay: '$15',
    perAnalysis: '$1.50',
  },
  {
    id: 'pack_bundle',
    name: 'Bundle',
    credits: 25,
    price: 3000,
    priceDisplay: '$30',
    perAnalysis: '$1.20',
    popular: true,
  },
  {
    id: 'pack_bulk',
    name: 'Bulk',
    credits: 60,
    price: 6000,
    priceDisplay: '$60',
    perAnalysis: '$1.00',
  },
]

// ============================================================================
// Subscription Tiers (Monthly)
// ============================================================================

export interface SubscriptionTier {
  id: string
  name: string
  monthlyCredits: number
  price: number // in cents (0 for free)
  priceDisplay: string
  perAnalysis: string | null
  features: string[]
  popular?: boolean
  stripePriceId?: string
  stripeAnnualPriceId?: string
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'tier_free',
    name: 'Free',
    monthlyCredits: 2,
    price: 0,
    priceDisplay: '$0',
    perAnalysis: null,
    features: [
      '2 analyses per month',
      'Basic truth scoring',
      'Steel-manned perspectives',
      'Standard queue',
    ],
  },
  {
    id: 'tier_analyst',
    name: 'Analyst',
    monthlyCredits: 15,
    price: 1900,
    priceDisplay: '$19',
    perAnalysis: '$1.27',
    features: [
      '15 analyses per month',
      'Full analysis features',
      'Priority queue',
      'Analysis history',
      '15% off credit packs',
    ],
  },
  {
    id: 'tier_professional',
    name: 'Professional',
    monthlyCredits: 40,
    price: 3900,
    priceDisplay: '$39',
    perAnalysis: '$0.98',
    popular: true,
    features: [
      '40 analyses per month',
      'Full analysis features',
      'Priority queue',
      'Source Intelligence access',
      'Bulk URL upload',
      '15% off credit packs',
    ],
  },
  {
    id: 'tier_newsroom',
    name: 'Newsroom',
    monthlyCredits: 100,
    price: 7900,
    priceDisplay: '$79',
    perAnalysis: '$0.79',
    features: [
      '100 analyses per month',
      'All Professional features',
      'API access',
      'Team sharing (coming soon)',
      'Custom reports',
      '15% off credit packs',
    ],
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find(pack => pack.id === packId)
}

export function getSubscriptionTier(tierId: string): SubscriptionTier | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId)
}

export function calculatePackDiscount(packId: string): number {
  const pack = getCreditPack(packId)
  if (!pack) return 0

  const basePrice = pack.credits * 167 // $1.67 per credit at sample tier
  const actualPrice = pack.price
  return Math.round((1 - actualPrice / basePrice) * 100)
}

export function getSubscriberPackPrice(pack: CreditPack): number {
  // 15% discount for subscribers
  return Math.round(pack.price * 0.85)
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

// ============================================================================
// Credit Costs
// ============================================================================

export const CREDIT_COSTS = {
  FULL_ANALYSIS: 1,
  QUICK_ANALYSIS: 0, // Free tier uses daily limit, not credits
} as const

// ============================================================================
// Free Tier Limits
// ============================================================================

export const FREE_TIER_LIMITS = {
  MONTHLY_ANALYSES: 2,
  SIGNUP_BONUS_CREDITS: 5, // Bonus credits on signup
} as const
