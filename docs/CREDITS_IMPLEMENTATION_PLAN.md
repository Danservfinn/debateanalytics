# Credits System Implementation Plan

## Executive Summary

Implement a credits-based payment system where users purchase credits to access AI-powered analysis features. **Pricing rule: User pays ≥3x API cost.**

---

## 1. Cost Analysis & Pricing

### AI API Costs (Claude Sonnet 4)
| Action | Input Tokens | Output Tokens | API Cost | User Price (3x) |
|--------|-------------|---------------|----------|-----------------|
| Deep Thread Analysis | ~15,000 | ~8,000 | ~$0.08 | $0.25 |
| Quick Thread Analysis | ~5,000 | ~2,000 | ~$0.02 | $0.10 |
| User Profile Analysis | ~10,000 | ~5,000 | ~$0.05 | $0.15 |
| Claim Verification | ~2,000 | ~1,000 | ~$0.01 | $0.05 |

### Credit Conversion
```
$1.00 = 100 credits
```

| Action | Credits Required | Effective Price |
|--------|-----------------|-----------------|
| Deep Thread Analysis | 25 credits | $0.25 |
| Quick Thread Analysis | 10 credits | $0.10 |
| User Profile Analysis | 15 credits | $0.15 |
| Single Claim Verification | 5 credits | $0.05 |

### Purchase Tiers
| Tier | Credits | Price | Bonus | Effective Rate |
|------|---------|-------|-------|----------------|
| Starter | 100 | $1.00 | - | $0.010/credit |
| Popular | 500 | $4.50 | +50 | $0.008/credit |
| Pro | 1,000 | $8.00 | +250 | $0.006/credit |
| Power | 5,000 | $35.00 | +1,500 | $0.005/credit |

---

## 2. Technical Architecture

### System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Credit Badge │  │ Purchase UI  │  │ Analysis Request     │   │
│  │ (Header)     │  │ (Modal)      │  │ (with credit check)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /api/credits │  │ /api/purchase│  │ Credit Middleware    │   │
│  │ /balance     │  │ /webhook     │  │ (validates balance)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Vercel KV (Redis)                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ user:credits│  │ user:usage  │  │ transactions    │   │   │
│  │  │ {balance}   │  │ {history}   │  │ {purchases}     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PAYMENT PROVIDERS                              │
│  ┌──────────────────────┐  ┌────────────────────────────────┐   │
│  │ Stripe               │  │ Lightning (Strike)             │   │
│  │ - Credit card        │  │ - Bitcoin micropayments        │   │
│  │ - Subscription       │  │ - Instant settlement           │   │
│  └──────────────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Models

```typescript
// User Credits
interface UserCredits {
  userId: string           // Anonymous or authenticated
  balance: number          // Current credit balance
  lifetimeCredits: number  // Total credits ever purchased
  lifetimeSpent: number    // Total credits ever spent
  createdAt: string        // First seen
  updatedAt: string        // Last activity
}

// Transaction Record
interface CreditTransaction {
  id: string
  userId: string
  type: 'purchase' | 'spend' | 'refund' | 'bonus'
  amount: number           // Positive for add, negative for spend
  balanceAfter: number
  description: string      // "Deep analysis: changemyview-owl8q3"
  metadata: {
    action?: string        // 'deep_analysis', 'claim_verify', etc.
    threadId?: string
    paymentId?: string     // Stripe/Lightning payment ID
    apiCost?: number       // Actual API cost in dollars
  }
  createdAt: string
}

// Credit Cost Configuration
interface CreditCosts {
  deep_analysis: 25
  quick_analysis: 10
  user_profile: 15
  claim_verify: 5
  arena_battle: 50        // Future feature
}
```

---

## 3. Implementation Phases

### Phase 1: Core Credit System (Day 1-2)
**Goal:** Basic credit storage and consumption

#### Files to Create:
```
src/
├── lib/
│   ├── credits/
│   │   ├── index.ts           # Main exports
│   │   ├── storage.ts         # Vercel KV operations
│   │   ├── costs.ts           # Credit cost definitions
│   │   └── middleware.ts      # API route protection
│   └── ...
├── app/
│   └── api/
│       └── credits/
│           ├── balance/route.ts
│           ├── spend/route.ts
│           └── history/route.ts
└── types/
    └── credits.ts
```

#### Key Implementation: `src/lib/credits/storage.ts`
```typescript
import { kv } from '@vercel/kv'

export async function getBalance(userId: string): Promise<number> {
  const credits = await kv.get<UserCredits>(`credits:${userId}`)
  return credits?.balance ?? 0
}

export async function spendCredits(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const key = `credits:${userId}`

  // Atomic transaction
  const result = await kv.multi()
    .get(key)
    .exec()

  const credits = result[0] as UserCredits | null
  const currentBalance = credits?.balance ?? 0

  if (currentBalance < amount) {
    return { success: false, newBalance: currentBalance, error: 'Insufficient credits' }
  }

  const newBalance = currentBalance - amount

  await kv.set(key, {
    ...credits,
    balance: newBalance,
    lifetimeSpent: (credits?.lifetimeSpent ?? 0) + amount,
    updatedAt: new Date().toISOString()
  })

  // Log transaction
  await logTransaction(userId, {
    type: 'spend',
    amount: -amount,
    balanceAfter: newBalance,
    description,
    metadata
  })

  return { success: true, newBalance }
}

export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  const key = `credits:${userId}`
  const credits = await kv.get<UserCredits>(key)

  const newBalance = (credits?.balance ?? 0) + amount

  await kv.set(key, {
    userId,
    balance: newBalance,
    lifetimeCredits: (credits?.lifetimeCredits ?? 0) + amount,
    lifetimeSpent: credits?.lifetimeSpent ?? 0,
    createdAt: credits?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  await logTransaction(userId, {
    type: 'purchase',
    amount,
    balanceAfter: newBalance,
    description,
    metadata
  })

  return newBalance
}
```

#### Key Implementation: `src/lib/credits/middleware.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getBalance, spendCredits } from './storage'
import { CREDIT_COSTS } from './costs'

export async function withCreditCheck(
  request: NextRequest,
  action: keyof typeof CREDIT_COSTS,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const userId = getUserId(request)  // From cookie or header
  const cost = CREDIT_COSTS[action]

  const balance = await getBalance(userId)

  if (balance < cost) {
    return NextResponse.json({
      success: false,
      error: 'Insufficient credits',
      required: cost,
      balance,
      purchaseUrl: '/purchase'
    }, { status: 402 })  // Payment Required
  }

  // Execute the handler
  const response = await handler()
  const result = await response.json()

  // Only charge if successful
  if (result.success) {
    await spendCredits(userId, cost, `${action}: ${result.data?.threadId || 'unknown'}`, {
      action,
      threadId: result.data?.threadId
    })
  }

  return response
}
```

---

### Phase 2: User Identity (Day 2-3)
**Goal:** Anonymous user IDs with optional account linking

#### Anonymous User Flow:
```
1. First visit → Generate UUID, store in localStorage + httpOnly cookie
2. All credit operations use this UUID
3. Optional: Link to email for recovery
```

#### Files:
```
src/
├── lib/
│   └── auth/
│       ├── anonymous.ts       # UUID generation/management
│       └── cookies.ts         # Secure cookie handling
├── hooks/
│   └── useUser.ts            # React hook for user state
└── components/
    └── auth/
        └── AccountRecovery.tsx
```

#### Key Implementation: `src/lib/auth/anonymous.ts`
```typescript
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

const USER_COOKIE = 'da_uid'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60  // 1 year

export function getUserId(): string {
  const cookieStore = cookies()
  let userId = cookieStore.get(USER_COOKIE)?.value

  if (!userId) {
    userId = `anon_${uuidv4()}`
    cookieStore.set(USER_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE
    })
  }

  return userId
}
```

---

### Phase 3: Payment Integration (Day 3-5)
**Goal:** Accept payments via Stripe and Lightning

#### Stripe Integration:
```
src/
├── app/
│   └── api/
│       └── payments/
│           ├── stripe/
│           │   ├── create-checkout/route.ts
│           │   └── webhook/route.ts
│           └── lightning/
│               ├── create-invoice/route.ts
│               └── check-payment/route.ts
└── lib/
    └── payments/
        ├── stripe.ts
        └── lightning.ts
```

#### Stripe Checkout Flow:
```typescript
// /api/payments/stripe/create-checkout/route.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRODUCTS = {
  starter: { credits: 100, price: 100 },      // $1.00
  popular: { credits: 550, price: 450 },      // $4.50
  pro: { credits: 1250, price: 800 },         // $8.00
  power: { credits: 6500, price: 3500 },      // $35.00
}

export async function POST(request: NextRequest) {
  const { tier, userId } = await request.json()
  const product = PRODUCTS[tier]

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${product.credits} Credits`,
          description: `Debate Analytics credits for AI analysis`
        },
        unit_amount: product.price
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/purchase`,
    metadata: {
      userId,
      credits: product.credits.toString(),
      tier
    }
  })

  return NextResponse.json({ url: session.url })
}
```

#### Stripe Webhook:
```typescript
// /api/payments/stripe/webhook/route.ts
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { userId, credits, tier } = session.metadata!

    await addCredits(
      userId,
      parseInt(credits),
      `Purchased ${tier} tier`,
      { paymentId: session.id, tier }
    )
  }

  return NextResponse.json({ received: true })
}
```

---

### Phase 4: Frontend Components (Day 5-6)
**Goal:** Credit display, purchase flow, balance warnings

#### Components:
```
src/
└── components/
    └── credits/
        ├── CreditBadge.tsx        # Shows balance in header
        ├── PurchaseModal.tsx      # Credit purchase UI
        ├── InsufficientCredits.tsx # Warning when low
        └── CreditHistory.tsx      # Transaction history
```

#### Key Component: `CreditBadge.tsx`
```tsx
'use client'

import { useState, useEffect } from 'react'
import { Coins, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PurchaseModal } from './PurchaseModal'

export function CreditBadge() {
  const [balance, setBalance] = useState<number | null>(null)
  const [showPurchase, setShowPurchase] = useState(false)

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(data => setBalance(data.balance))
  }, [])

  const isLow = balance !== null && balance < 25  // Less than 1 deep analysis

  return (
    <>
      <Button
        variant={isLow ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => setShowPurchase(true)}
        className="gap-2"
      >
        {isLow && <AlertCircle className="w-4 h-4" />}
        <Coins className="w-4 h-4" />
        <span>{balance ?? '...'} credits</span>
      </Button>

      <PurchaseModal
        open={showPurchase}
        onClose={() => setShowPurchase(false)}
        currentBalance={balance ?? 0}
      />
    </>
  )
}
```

#### Key Component: `PurchaseModal.tsx`
```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, CreditCard } from 'lucide-react'

const TIERS = [
  { id: 'starter', credits: 100, price: '$1.00', popular: false },
  { id: 'popular', credits: 550, price: '$4.50', popular: true, savings: '10%' },
  { id: 'pro', credits: 1250, price: '$8.00', popular: false, savings: '36%' },
  { id: 'power', credits: 6500, price: '$35.00', popular: false, savings: '50%' },
]

export function PurchaseModal({ open, onClose, currentBalance }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'lightning'>('stripe')

  async function handlePurchase(tier: string) {
    setLoading(tier)

    const endpoint = paymentMethod === 'stripe'
      ? '/api/payments/stripe/create-checkout'
      : '/api/payments/lightning/create-invoice'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier })
    })

    const data = await res.json()

    if (paymentMethod === 'stripe') {
      window.location.href = data.url
    } else {
      // Show Lightning invoice QR
      // ... Lightning payment flow
    }

    setLoading(null)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Method Toggle */}
          <div className="flex gap-2">
            <Button
              variant={paymentMethod === 'stripe' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('stripe')}
              className="flex-1"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Card
            </Button>
            <Button
              variant={paymentMethod === 'lightning' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('lightning')}
              className="flex-1"
            >
              <Zap className="w-4 h-4 mr-2" />
              Lightning
            </Button>
          </div>

          {/* Tier Selection */}
          <div className="grid gap-3">
            {TIERS.map(tier => (
              <button
                key={tier.id}
                onClick={() => handlePurchase(tier.id)}
                disabled={loading !== null}
                className="p-4 border rounded-lg hover:border-primary transition-colors text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {tier.credits} credits
                      {tier.popular && <Badge variant="default">Popular</Badge>}
                      {tier.savings && <Badge variant="success">{tier.savings} off</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ~{Math.floor(tier.credits / 25)} deep analyses
                    </div>
                  </div>
                  <div className="text-xl font-bold">{tier.price}</div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Current balance: {currentBalance} credits
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 5: API Route Protection (Day 6-7)
**Goal:** Enforce credit requirements on all AI endpoints

#### Protected Routes:
```typescript
// /api/analyze-thread-deep/route.ts
import { withCreditCheck } from '@/lib/credits/middleware'

export async function POST(request: NextRequest) {
  return withCreditCheck(request, 'deep_analysis', async () => {
    // Existing deep analysis logic
    // ...
    return NextResponse.json({ success: true, data: analysis })
  })
}
```

#### Credit Cost Constants:
```typescript
// src/lib/credits/costs.ts
export const CREDIT_COSTS = {
  deep_analysis: 25,
  quick_analysis: 10,
  user_profile: 15,
  claim_verify: 5,
  arena_battle: 50,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS
```

---

### Phase 6: Free Tier & Trials (Day 7)
**Goal:** Allow limited free usage to attract users

#### Free Tier Rules:
- New users get **25 free credits** (1 deep analysis)
- Daily free refresh: **5 credits** (encourages return visits)
- Free credits cap at 25 (can't hoard)

```typescript
// src/lib/credits/free-tier.ts
const FREE_SIGNUP_CREDITS = 25
const DAILY_FREE_CREDITS = 5
const FREE_CREDITS_CAP = 25

export async function initializeNewUser(userId: string): Promise<void> {
  await addCredits(userId, FREE_SIGNUP_CREDITS, 'Welcome bonus', { type: 'signup_bonus' })
}

export async function claimDailyCredits(userId: string): Promise<{
  success: boolean
  credited: number
  nextClaim: string
}> {
  const lastClaim = await kv.get<string>(`daily:${userId}`)
  const now = new Date()

  if (lastClaim) {
    const lastDate = new Date(lastClaim)
    if (isSameDay(lastDate, now)) {
      return {
        success: false,
        credited: 0,
        nextClaim: getNextMidnight().toISOString()
      }
    }
  }

  const balance = await getBalance(userId)
  const creditsToAdd = Math.min(DAILY_FREE_CREDITS, FREE_CREDITS_CAP - balance)

  if (creditsToAdd > 0) {
    await addCredits(userId, creditsToAdd, 'Daily free credits', { type: 'daily_bonus' })
  }

  await kv.set(`daily:${userId}`, now.toISOString())

  return {
    success: true,
    credited: creditsToAdd,
    nextClaim: getNextMidnight().toISOString()
  }
}
```

---

## 4. Environment Variables

```env
# Vercel KV (Redis)
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Lightning (Strike) - already configured
STRIKE_API_KEY=

# App
NEXT_PUBLIC_URL=https://debate-analytics.vercel.app
```

---

## 5. Database Schema (Vercel KV)

```
Key Pattern                    | Value Type
-------------------------------|------------------
credits:{userId}               | UserCredits
transactions:{userId}:{id}     | CreditTransaction
daily:{userId}                 | ISO timestamp
usage:{userId}:{month}         | UsageStats
```

---

## 6. Monitoring & Analytics

### Metrics to Track:
1. **Revenue**: Daily/monthly credit purchases
2. **Usage**: Credits spent per action type
3. **Margin**: Actual API cost vs credits charged
4. **Conversion**: Free → paid user rate
5. **Churn**: Users who stop after free credits

### Dashboard API:
```typescript
// /api/admin/stats (protected)
{
  revenue: {
    today: 125.00,
    thisMonth: 3420.00,
    avgPurchase: 8.50
  },
  usage: {
    deepAnalysis: { count: 450, credits: 11250 },
    claimVerify: { count: 1200, credits: 6000 }
  },
  margin: {
    apiCost: 142.30,
    creditsValue: 523.50,
    grossMargin: 0.73  // 73%
  },
  users: {
    total: 892,
    paid: 156,
    conversionRate: 0.175  // 17.5%
  }
}
```

---

## 7. Timeline Summary

| Phase | Days | Deliverables |
|-------|------|--------------|
| 1. Core Credit System | 1-2 | Balance, spend, history APIs |
| 2. User Identity | 2-3 | Anonymous IDs, cookies |
| 3. Payment Integration | 3-5 | Stripe + Lightning checkout |
| 4. Frontend Components | 5-6 | Badge, modal, warnings |
| 5. API Protection | 6-7 | Middleware on all AI routes |
| 6. Free Tier | 7 | Signup bonus, daily credits |

**Total: ~7 days to MVP**

---

## 8. Discount Codes

### Overview
Allow users to enter discount codes at analysis time to reduce or eliminate credit costs. Includes an **admin bypass code** for free analysis.

### Discount Code Types

| Type | Discount | Use Case |
|------|----------|----------|
| `ADMIN` | 100% (free) | Owner/developer testing |
| `PROMO_XX` | 50% off | Marketing campaigns |
| `FRIEND_XX` | 25% off | Referral codes |
| `BETA_XX` | 100% (limited) | Beta testers (max 10 uses) |

### Data Model

```typescript
// Discount Code Definition
interface DiscountCode {
  code: string                    // The code itself (case-insensitive)
  type: 'admin' | 'promo' | 'referral' | 'beta'
  discountPercent: number         // 0-100 (100 = free)
  maxUses?: number                // null = unlimited
  currentUses: number             // Track usage
  expiresAt?: string              // ISO date, null = never
  createdBy: string               // Admin who created it
  createdAt: string
  active: boolean
}

// Usage Log
interface DiscountUsage {
  code: string
  userId: string
  action: string                  // 'deep_analysis', etc.
  creditsSaved: number
  usedAt: string
}
```

### Admin Code Configuration

```typescript
// src/lib/credits/discount-codes.ts

// Admin codes stored in environment (never in code)
const ADMIN_CODES = (process.env.ADMIN_DISCOUNT_CODES || '').split(',').map(c => c.trim().toUpperCase())

// Example .env.local:
// ADMIN_DISCOUNT_CODES=DANIELADMIN2025,DEVTEST123

export async function validateDiscountCode(
  code: string,
  action: string
): Promise<{
  valid: boolean
  discountPercent: number
  error?: string
}> {
  const normalizedCode = code.trim().toUpperCase()

  // Check admin codes first (from env, always 100% off, unlimited)
  if (ADMIN_CODES.includes(normalizedCode)) {
    await logDiscountUsage(normalizedCode, 'admin', action)
    return { valid: true, discountPercent: 100 }
  }

  // Check database for other codes
  const discountCode = await kv.get<DiscountCode>(`discount:${normalizedCode}`)

  if (!discountCode) {
    return { valid: false, discountPercent: 0, error: 'Invalid code' }
  }

  if (!discountCode.active) {
    return { valid: false, discountPercent: 0, error: 'Code is inactive' }
  }

  if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
    return { valid: false, discountPercent: 0, error: 'Code has expired' }
  }

  if (discountCode.maxUses && discountCode.currentUses >= discountCode.maxUses) {
    return { valid: false, discountPercent: 0, error: 'Code usage limit reached' }
  }

  // Increment usage
  await kv.set(`discount:${normalizedCode}`, {
    ...discountCode,
    currentUses: discountCode.currentUses + 1
  })

  await logDiscountUsage(normalizedCode, discountCode.type, action)

  return { valid: true, discountPercent: discountCode.discountPercent }
}

export function calculateDiscountedCost(baseCost: number, discountPercent: number): number {
  return Math.ceil(baseCost * (1 - discountPercent / 100))
}
```

### Updated Credit Middleware

```typescript
// src/lib/credits/middleware.ts (updated)

export async function withCreditCheck(
  request: NextRequest,
  action: keyof typeof CREDIT_COSTS,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const userId = getUserId(request)
  const baseCost = CREDIT_COSTS[action]

  // Check for discount code in request body or header
  const body = await request.clone().json().catch(() => ({}))
  const discountCode = body.discountCode || request.headers.get('X-Discount-Code')

  let finalCost = baseCost
  let discountApplied = false

  if (discountCode) {
    const discount = await validateDiscountCode(discountCode, action)
    if (discount.valid) {
      finalCost = calculateDiscountedCost(baseCost, discount.discountPercent)
      discountApplied = true
    }
  }

  // Free with valid admin/100% code
  if (finalCost === 0) {
    const response = await handler()
    return response
  }

  const balance = await getBalance(userId)

  if (balance < finalCost) {
    return NextResponse.json({
      success: false,
      error: 'Insufficient credits',
      required: finalCost,
      balance,
      discountApplied,
      purchaseUrl: '/purchase'
    }, { status: 402 })
  }

  const response = await handler()
  const result = await response.json()

  if (result.success) {
    await spendCredits(userId, finalCost, `${action}: ${result.data?.threadId || 'unknown'}`, {
      action,
      threadId: result.data?.threadId,
      discountCode: discountApplied ? discountCode : undefined,
      originalCost: baseCost,
      discountedCost: finalCost
    })
  }

  return response
}
```

### Frontend: Discount Code Input

```tsx
// src/components/analysis/DiscountCodeInput.tsx
'use client'

import { useState } from 'react'
import { Tag, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DiscountCodeInputProps {
  onCodeApplied: (code: string | null, discountPercent: number) => void
}

export function DiscountCodeInput({ onCodeApplied }: DiscountCodeInputProps) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [discount, setDiscount] = useState(0)
  const [error, setError] = useState('')

  async function validateCode() {
    if (!code.trim()) return

    setStatus('checking')

    const res = await fetch('/api/credits/validate-discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() })
    })

    const data = await res.json()

    if (data.valid) {
      setStatus('valid')
      setDiscount(data.discountPercent)
      setError('')
      onCodeApplied(code.trim(), data.discountPercent)
    } else {
      setStatus('invalid')
      setError(data.error || 'Invalid code')
      onCodeApplied(null, 0)
    }
  }

  function clearCode() {
    setCode('')
    setStatus('idle')
    setDiscount(0)
    setError('')
    onCodeApplied(null, 0)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Discount code (optional)"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (status !== 'idle') setStatus('idle')
            }}
            onKeyDown={(e) => e.key === 'Enter' && validateCode()}
            className={cn(
              "pl-10 uppercase",
              status === 'valid' && "border-success text-success",
              status === 'invalid' && "border-danger text-danger"
            )}
            disabled={status === 'checking'}
          />
        </div>
        {status === 'valid' ? (
          <Button variant="ghost" size="icon" onClick={clearCode}>
            <X className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={validateCode}
            disabled={!code.trim() || status === 'checking'}
          >
            Apply
          </Button>
        )}
      </div>

      {status === 'valid' && (
        <div className="flex items-center gap-2 text-sm text-success">
          <Check className="w-4 h-4" />
          {discount === 100 ? 'Free analysis!' : `${discount}% off applied`}
        </div>
      )}

      {status === 'invalid' && (
        <p className="text-sm text-danger">{error}</p>
      )}
    </div>
  )
}
```

### Integration in Thread Search

```tsx
// In ThreadSearch.tsx or analysis trigger component

import { DiscountCodeInput } from '@/components/analysis/DiscountCodeInput'

function ThreadSearch() {
  const [discountCode, setDiscountCode] = useState<string | null>(null)
  const [discountPercent, setDiscountPercent] = useState(0)

  async function handleAnalyze() {
    const res = await fetch('/api/analyze-thread-deep', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(discountCode && { 'X-Discount-Code': discountCode })
      },
      body: JSON.stringify({
        url: threadUrl,
        discountCode  // Also in body as fallback
      })
    })
    // ... handle response
  }

  return (
    <div className="space-y-4">
      <Input placeholder="Reddit thread URL..." />

      <DiscountCodeInput
        onCodeApplied={(code, percent) => {
          setDiscountCode(code)
          setDiscountPercent(percent)
        }}
      />

      <Button onClick={handleAnalyze}>
        Analyze Thread
        {discountPercent === 100 && <span className="ml-2 text-success">(FREE)</span>}
        {discountPercent > 0 && discountPercent < 100 && (
          <span className="ml-2 text-success">({discountPercent}% off)</span>
        )}
      </Button>
    </div>
  )
}
```

### Environment Variables (Add)

```env
# Admin discount codes (comma-separated, case-insensitive)
ADMIN_DISCOUNT_CODES=YOURADMINCODE2025,DEVBYPASS
```

### API Route for Validation

```typescript
// /api/credits/validate-discount/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateDiscountCode } from '@/lib/credits/discount-codes'

export async function POST(request: NextRequest) {
  const { code } = await request.json()

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ valid: false, error: 'Code required' })
  }

  const result = await validateDiscountCode(code, 'validation_check')
  return NextResponse.json(result)
}
```

### Admin Code Management (CLI)

```bash
# Add a promo code via CLI script
# scripts/manage-discount-codes.ts

import { kv } from '@vercel/kv'

async function createCode(
  code: string,
  discountPercent: number,
  type: 'promo' | 'referral' | 'beta',
  maxUses?: number,
  expiresInDays?: number
) {
  const discountCode: DiscountCode = {
    code: code.toUpperCase(),
    type,
    discountPercent,
    maxUses,
    currentUses: 0,
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    active: true
  }

  await kv.set(`discount:${code.toUpperCase()}`, discountCode)
  console.log(`Created code: ${code} (${discountPercent}% off)`)
}

// Example usage:
// createCode('LAUNCH50', 50, 'promo', 100, 30)  // 50% off, 100 uses, expires in 30 days
// createCode('BETA2025', 100, 'beta', 10)       // Free, 10 uses, no expiry
```

---

## 9. Future Enhancements

1. **Subscriptions**: Monthly plans with included credits
2. **Referral Program**: Earn credits for invites
3. **API Keys**: For developers to integrate
4. **Enterprise**: Volume pricing for organizations
5. **Crypto Payments**: Beyond Lightning (ETH, stablecoins)
6. **Discount Code Dashboard**: Admin UI for managing codes
