import { NextRequest, NextResponse } from 'next/server'
import {
  getThreadVerifications,
  getVerification,
  hashClaim,
  type StoredVerification
} from '@/lib/verification-storage'

/**
 * GET /api/get-verifications
 *
 * Fetch cached verification results for a thread
 * Query params:
 *   - threadId: Required. The thread identifier
 *   - claimText: Optional. If provided, returns verification for specific claim
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('threadId')
    const claimText = searchParams.get('claimText')

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: 'threadId is required' },
        { status: 400 }
      )
    }

    // If claimText provided, return specific verification
    if (claimText) {
      const verification = await getVerification(threadId, claimText)

      if (!verification) {
        return NextResponse.json({
          success: true,
          data: null,
          cached: false
        })
      }

      return NextResponse.json({
        success: true,
        data: verification,
        cached: true
      })
    }

    // Otherwise, return all verifications for the thread
    const verifications = await getThreadVerifications(threadId)

    // Create a lookup map by claim hash for easy client-side matching
    const verificationsMap: Record<string, StoredVerification> = {}
    for (const v of verifications) {
      verificationsMap[v.claimHash] = v
    }

    return NextResponse.json({
      success: true,
      data: {
        verifications: verifications,
        byHash: verificationsMap,
        count: verifications.length
      }
    })
  } catch (error) {
    console.error('Error fetching verifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch verifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/get-verifications
 *
 * Batch check which claims have cached verifications
 * Body: { threadId: string, claims: Array<{ text: string }> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadId, claims } = body

    if (!threadId || !claims || !Array.isArray(claims)) {
      return NextResponse.json(
        { success: false, error: 'threadId and claims array required' },
        { status: 400 }
      )
    }

    // Get all verifications for the thread
    const verifications = await getThreadVerifications(threadId)

    // Create lookup by hash
    const byHash = new Map<string, StoredVerification>()
    for (const v of verifications) {
      byHash.set(v.claimHash, v)
    }

    // Check each claim
    const results: Record<string, StoredVerification | null> = {}
    for (const claim of claims) {
      if (claim.text) {
        const hash = hashClaim(claim.text)
        results[hash] = byHash.get(hash) || null
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        cachedCount: Object.values(results).filter(v => v !== null).length,
        totalChecked: claims.length
      }
    })
  } catch (error) {
    console.error('Error batch checking verifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check verifications' },
      { status: 500 }
    )
  }
}
