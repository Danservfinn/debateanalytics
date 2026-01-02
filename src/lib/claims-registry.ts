/**
 * Claims Registry - Persistent storage for verified claims
 *
 * Claims are hashed by their normalized text content.
 * Once verified, claims remain "sticky" and never need re-verification.
 * All verifications are publicly available to all users.
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export interface VerifiedClaim {
  id: string                    // SHA-256 hash of normalized claim text
  text: string                  // Original claim text
  normalizedText: string        // Lowercase, trimmed, normalized
  status: 'verified' | 'disputed' | 'false' | 'unverified' | 'sourced'
  confidence: number            // 0-100 confidence in verification
  sources: string[]             // URLs or references supporting verification
  explanation: string           // Why this verification status
  verifiedAt: string            // ISO timestamp
  verifiedInThreads: string[]   // Thread IDs where this claim appeared
  verifiedBy: 'claude' | 'grok' | 'manual'  // Who verified it
  sticky: boolean               // Once true, never re-verify
}

export interface ClaimsRegistry {
  version: number
  lastUpdated: string
  totalClaims: number
  claims: Record<string, VerifiedClaim>
}

const REGISTRY_PATH = path.join(process.cwd(), 'public/data/claims/registry.json')

/**
 * Normalize claim text for consistent hashing
 */
export function normalizeClaim(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/[""'']/g, '"')        // Normalize quotes
    .replace(/[—–]/g, '-')          // Normalize dashes
    .replace(/\.{2,}/g, '...')      // Normalize ellipsis
}

/**
 * Generate unique ID for a claim based on its content
 */
export function hashClaim(text: string): string {
  const normalized = normalizeClaim(text)
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16)
}

/**
 * Load the claims registry from disk
 */
export async function loadRegistry(): Promise<ClaimsRegistry> {
  try {
    const data = await fs.readFile(REGISTRY_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // Return empty registry if doesn't exist
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      totalClaims: 0,
      claims: {}
    }
  }
}

/**
 * Save the claims registry to disk
 */
export async function saveRegistry(registry: ClaimsRegistry): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(REGISTRY_PATH)
  await fs.mkdir(dir, { recursive: true })

  registry.lastUpdated = new Date().toISOString()
  registry.totalClaims = Object.keys(registry.claims).length

  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2))
}

/**
 * Look up a claim in the registry
 * Returns the verified claim if found and sticky, null otherwise
 */
export async function lookupClaim(claimText: string): Promise<VerifiedClaim | null> {
  const registry = await loadRegistry()
  const claimId = hashClaim(claimText)

  const claim = registry.claims[claimId]

  // Only return if claim exists and is sticky (permanently verified)
  if (claim && claim.sticky) {
    return claim
  }

  return null
}

/**
 * Register a newly verified claim
 */
export async function registerClaim(
  claimText: string,
  status: VerifiedClaim['status'],
  options: {
    confidence?: number
    sources?: string[]
    explanation?: string
    threadId?: string
    verifiedBy?: VerifiedClaim['verifiedBy']
  } = {}
): Promise<VerifiedClaim> {
  const registry = await loadRegistry()
  const claimId = hashClaim(claimText)

  const existingClaim = registry.claims[claimId]

  if (existingClaim) {
    // Update existing claim - add thread to list
    if (options.threadId && !existingClaim.verifiedInThreads.includes(options.threadId)) {
      existingClaim.verifiedInThreads.push(options.threadId)
    }
    await saveRegistry(registry)
    return existingClaim
  }

  // Create new claim
  const newClaim: VerifiedClaim = {
    id: claimId,
    text: claimText,
    normalizedText: normalizeClaim(claimText),
    status,
    confidence: options.confidence ?? 80,
    sources: options.sources ?? [],
    explanation: options.explanation ?? '',
    verifiedAt: new Date().toISOString(),
    verifiedInThreads: options.threadId ? [options.threadId] : [],
    verifiedBy: options.verifiedBy ?? 'claude',
    sticky: status !== 'unverified'  // Only unverified claims can be re-checked
  }

  registry.claims[claimId] = newClaim
  await saveRegistry(registry)

  return newClaim
}

/**
 * Batch lookup multiple claims
 * Returns map of claim text -> cached verification (or null if not cached)
 */
export async function batchLookupClaims(claimTexts: string[]): Promise<Map<string, VerifiedClaim | null>> {
  const registry = await loadRegistry()
  const results = new Map<string, VerifiedClaim | null>()

  for (const text of claimTexts) {
    const claimId = hashClaim(text)
    const claim = registry.claims[claimId]
    results.set(text, claim?.sticky ? claim : null)
  }

  return results
}

/**
 * Get registry statistics
 */
export async function getRegistryStats(): Promise<{
  totalClaims: number
  verified: number
  disputed: number
  false: number
  sourced: number
  unverified: number
  threadsContributed: number
}> {
  const registry = await loadRegistry()
  const claims = Object.values(registry.claims)

  const threads = new Set<string>()
  claims.forEach(c => c.verifiedInThreads.forEach(t => threads.add(t)))

  return {
    totalClaims: claims.length,
    verified: claims.filter(c => c.status === 'verified').length,
    disputed: claims.filter(c => c.status === 'disputed').length,
    false: claims.filter(c => c.status === 'false').length,
    sourced: claims.filter(c => c.status === 'sourced').length,
    unverified: claims.filter(c => c.status === 'unverified').length,
    threadsContributed: threads.size
  }
}
