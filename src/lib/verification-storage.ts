/**
 * Verification Storage Operations
 * Uses Vercel KV to persist claim verification results
 * so paid verifications are shared across all users
 */

import { kv } from '@vercel/kv'
import { createHash } from 'crypto'

export interface VerificationSource {
  title: string
  url: string
  snippet: string
  credibility: 'high' | 'medium' | 'low'
}

export interface StoredVerification {
  claimHash: string
  threadId: string
  claimText: string
  claimAuthor: string
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable'
  confidence: number
  summary: string
  explanation: string
  sources: VerificationSource[]
  keyEvidence: string[]
  nuances: string[]
  verifiedAt: string
  verifiedBy?: string  // User who paid for verification (optional, for analytics)
}

// Key patterns
const VERIFICATION_KEY = (threadId: string, claimHash: string) =>
  `verification:${threadId}:${claimHash}`
const THREAD_VERIFICATIONS_KEY = (threadId: string) =>
  `thread_verifications:${threadId}`

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
 * Generate a stable hash for a claim text
 * This ensures the same claim text always maps to the same verification
 */
export function hashClaim(claimText: string): string {
  // Normalize: lowercase, trim, remove extra whitespace
  const normalized = claimText.toLowerCase().trim().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/**
 * Get a cached verification for a specific claim in a thread
 */
export async function getVerification(
  threadId: string,
  claimText: string
): Promise<StoredVerification | null> {
  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, no cached verifications available')
    return null
  }

  try {
    const claimHash = hashClaim(claimText)
    const verification = await kv.get<StoredVerification>(
      VERIFICATION_KEY(threadId, claimHash)
    )
    return verification
  } catch (error) {
    console.error('Failed to get cached verification:', error)
    return null
  }
}

/**
 * Get all cached verifications for a thread
 */
export async function getThreadVerifications(
  threadId: string
): Promise<StoredVerification[]> {
  if (!isKVConfigured()) {
    return []
  }

  try {
    // Get list of claim hashes for this thread
    const claimHashes = await kv.smembers(THREAD_VERIFICATIONS_KEY(threadId))

    if (!claimHashes || claimHashes.length === 0) {
      return []
    }

    // Fetch all verifications
    const verifications = await Promise.all(
      claimHashes.map(hash =>
        kv.get<StoredVerification>(VERIFICATION_KEY(threadId, hash as string))
      )
    )

    return verifications.filter((v): v is StoredVerification => v !== null)
  } catch (error) {
    console.error('Failed to get thread verifications:', error)
    return []
  }
}

/**
 * Save a verification result
 */
export async function saveVerification(
  threadId: string,
  claimText: string,
  claimAuthor: string,
  result: {
    verdict: StoredVerification['verdict']
    confidence: number
    summary: string
    explanation: string
    sources: VerificationSource[]
    keyEvidence: string[]
    nuances: string[]
    verifiedAt: string
  },
  verifiedBy?: string
): Promise<boolean> {
  if (!isKVConfigured()) {
    console.warn('Vercel KV not configured, cannot save verification')
    return false
  }

  try {
    const claimHash = hashClaim(claimText)

    const verification: StoredVerification = {
      claimHash,
      threadId,
      claimText,
      claimAuthor,
      ...result,
      verifiedBy
    }

    // Save the verification
    await kv.set(
      VERIFICATION_KEY(threadId, claimHash),
      verification,
      { ex: 60 * 60 * 24 * 30 } // Expire after 30 days
    )

    // Add to thread's verification set
    await kv.sadd(THREAD_VERIFICATIONS_KEY(threadId), claimHash)

    return true
  } catch (error) {
    console.error('Failed to save verification:', error)
    return false
  }
}

/**
 * Check if a claim has already been verified
 */
export async function isClaimVerified(
  threadId: string,
  claimText: string
): Promise<boolean> {
  const verification = await getVerification(threadId, claimText)
  return verification !== null
}

/**
 * Get verification by claim hash (for API use)
 */
export async function getVerificationByHash(
  threadId: string,
  claimHash: string
): Promise<StoredVerification | null> {
  if (!isKVConfigured()) {
    return null
  }

  try {
    return await kv.get<StoredVerification>(VERIFICATION_KEY(threadId, claimHash))
  } catch (error) {
    console.error('Failed to get verification by hash:', error)
    return null
  }
}
