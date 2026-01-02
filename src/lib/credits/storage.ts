/**
 * Credit Storage Operations
 * Uses Vercel KV for persistent credit storage
 */

import { kv } from '@vercel/kv'
import { v4 as uuidv4 } from 'uuid'
import type {
  UserCredits,
  CreditTransaction,
  CreditTransactionMetadata,
  CreditSpendResult,
} from '@/types/credits'
import { FREE_TIER } from './costs'

// Key patterns
const CREDITS_KEY = (userId: string) => `credits:${userId}`
const TRANSACTION_KEY = (userId: string, id: string) => `tx:${userId}:${id}`
const DAILY_CLAIM_KEY = (userId: string) => `daily:${userId}`

/**
 * Check if Vercel KV is configured
 */
function isKVConfigured(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  )
}

/**
 * Get user's current credit balance
 */
export async function getBalance(userId: string): Promise<number> {
  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, returning mock balance')
    return 25 // Return free tier amount for development
  }

  try {
    const credits = await kv.get<UserCredits>(CREDITS_KEY(userId))
    return credits?.balance ?? 0
  } catch (error) {
    console.error('Failed to get balance:', error)
    return 0
  }
}

/**
 * Get full user credits info
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  if (!isKVConfigured()) {
    return null
  }

  try {
    return await kv.get<UserCredits>(CREDITS_KEY(userId))
  } catch (error) {
    console.error('Failed to get user credits:', error)
    return null
  }
}

/**
 * Initialize a new user with signup credits
 */
export async function initializeNewUser(userId: string): Promise<UserCredits> {
  const now = new Date().toISOString()

  const newUser: UserCredits = {
    userId,
    balance: FREE_TIER.SIGNUP_CREDITS,
    lifetimeCredits: FREE_TIER.SIGNUP_CREDITS,
    lifetimeSpent: 0,
    createdAt: now,
    updatedAt: now,
  }

  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, skipping user initialization')
    return newUser
  }

  try {
    await kv.set(CREDITS_KEY(userId), newUser)

    // Log the signup bonus transaction
    await logTransaction(userId, {
      type: 'signup',
      amount: FREE_TIER.SIGNUP_CREDITS,
      balanceAfter: FREE_TIER.SIGNUP_CREDITS,
      description: 'Welcome bonus credits',
      metadata: {},
    })

    return newUser
  } catch (error) {
    console.error('Failed to initialize user:', error)
    return newUser
  }
}

/**
 * Get or create user credits
 */
export async function getOrCreateUser(userId: string): Promise<UserCredits> {
  const existing = await getUserCredits(userId)
  if (existing) {
    return existing
  }
  return await initializeNewUser(userId)
}

/**
 * Spend credits for an action
 */
export async function spendCredits(
  userId: string,
  amount: number,
  description: string,
  metadata?: CreditTransactionMetadata
): Promise<CreditSpendResult> {
  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, simulating spend')
    return { success: true, newBalance: 25 - amount }
  }

  try {
    const credits = await getOrCreateUser(userId)
    const currentBalance = credits.balance

    if (currentBalance < amount) {
      return {
        success: false,
        newBalance: currentBalance,
        error: 'Insufficient credits',
      }
    }

    const newBalance = currentBalance - amount

    const updatedCredits: UserCredits = {
      ...credits,
      balance: newBalance,
      lifetimeSpent: credits.lifetimeSpent + amount,
      updatedAt: new Date().toISOString(),
    }

    await kv.set(CREDITS_KEY(userId), updatedCredits)

    // Log the transaction
    const txId = await logTransaction(userId, {
      type: 'spend',
      amount: -amount,
      balanceAfter: newBalance,
      description,
      metadata: metadata || {},
    })

    return {
      success: true,
      newBalance,
      transactionId: txId,
    }
  } catch (error) {
    console.error('Failed to spend credits:', error)
    return {
      success: false,
      newBalance: 0,
      error: 'Transaction failed',
    }
  }
}

/**
 * Add credits to user account
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  metadata?: CreditTransactionMetadata
): Promise<number> {
  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, simulating add')
    return amount
  }

  try {
    const credits = await getOrCreateUser(userId)
    const newBalance = credits.balance + amount

    const updatedCredits: UserCredits = {
      ...credits,
      balance: newBalance,
      lifetimeCredits: credits.lifetimeCredits + amount,
      updatedAt: new Date().toISOString(),
    }

    await kv.set(CREDITS_KEY(userId), updatedCredits)

    await logTransaction(userId, {
      type: 'purchase',
      amount,
      balanceAfter: newBalance,
      description,
      metadata: metadata || {},
    })

    return newBalance
  } catch (error) {
    console.error('Failed to add credits:', error)
    throw error
  }
}

/**
 * Claim daily free credits
 */
export async function claimDailyCredits(userId: string): Promise<{
  success: boolean
  credited: number
  nextClaim: string
  message?: string
}> {
  if (!isKVConfigured()) {
    return {
      success: false,
      credited: 0,
      nextClaim: new Date().toISOString(),
      message: 'Credit system not configured',
    }
  }

  try {
    const lastClaim = await kv.get<string>(DAILY_CLAIM_KEY(userId))
    const now = new Date()

    if (lastClaim) {
      const lastDate = new Date(lastClaim)
      if (isSameDay(lastDate, now)) {
        return {
          success: false,
          credited: 0,
          nextClaim: getNextMidnight().toISOString(),
          message: 'Already claimed today',
        }
      }
    }

    const credits = await getOrCreateUser(userId)
    const creditsToAdd = Math.min(
      FREE_TIER.DAILY_CREDITS,
      FREE_TIER.DAILY_CAP - credits.balance
    )

    if (creditsToAdd <= 0) {
      return {
        success: false,
        credited: 0,
        nextClaim: getNextMidnight().toISOString(),
        message: 'Free credits cap reached',
      }
    }

    const newBalance = credits.balance + creditsToAdd

    await kv.set(CREDITS_KEY(userId), {
      ...credits,
      balance: newBalance,
      lifetimeCredits: credits.lifetimeCredits + creditsToAdd,
      updatedAt: now.toISOString(),
    })

    await kv.set(DAILY_CLAIM_KEY(userId), now.toISOString())

    await logTransaction(userId, {
      type: 'daily',
      amount: creditsToAdd,
      balanceAfter: newBalance,
      description: 'Daily free credits',
      metadata: {},
    })

    return {
      success: true,
      credited: creditsToAdd,
      nextClaim: getNextMidnight().toISOString(),
    }
  } catch (error) {
    console.error('Failed to claim daily credits:', error)
    return {
      success: false,
      credited: 0,
      nextClaim: getNextMidnight().toISOString(),
      message: 'Failed to claim credits',
    }
  }
}

/**
 * Log a credit transaction
 */
async function logTransaction(
  userId: string,
  transaction: Omit<CreditTransaction, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const id = uuidv4()
  const fullTransaction: CreditTransaction = {
    id,
    userId,
    ...transaction,
    createdAt: new Date().toISOString(),
  }

  if (isKVConfigured()) {
    try {
      await kv.set(TRANSACTION_KEY(userId, id), fullTransaction)
      // Also add to user's transaction list (keep last 100)
      await kv.lpush(`txlist:${userId}`, id)
      await kv.ltrim(`txlist:${userId}`, 0, 99)
    } catch (error) {
      console.error('Failed to log transaction:', error)
    }
  }

  return id
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 20
): Promise<CreditTransaction[]> {
  if (!isKVConfigured()) {
    return []
  }

  try {
    const txIds = await kv.lrange<string>(`txlist:${userId}`, 0, limit - 1)
    if (!txIds || txIds.length === 0) {
      return []
    }

    const transactions = await Promise.all(
      txIds.map((id) => kv.get<CreditTransaction>(TRANSACTION_KEY(userId, id)))
    )

    return transactions.filter((tx): tx is CreditTransaction => tx !== null)
  } catch (error) {
    console.error('Failed to get transaction history:', error)
    return []
  }
}

// Helper functions
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function getNextMidnight(): Date {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow
}
