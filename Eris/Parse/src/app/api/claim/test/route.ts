/**
 * POST /api/claim/test
 * Deep verification endpoint for individual claims
 *
 * Takes a claim and its context, runs comprehensive verification,
 * and returns structured verdict with evidence
 */

import { NextRequest, NextResponse } from 'next/server'
import { testClaim } from '@/agents/claim-test-agent'
import type { ClaimTestRequest, ClaimTestResponse } from '@/types'

export async function POST(request: NextRequest): Promise<NextResponse<ClaimTestResponse>> {
  try {
    const body: ClaimTestRequest = await request.json()

    // Validate required fields
    if (!body.claimId || !body.claim || !body.context) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: claimId, claim, and context are required',
        },
        { status: 400 }
      )
    }

    // Run the claim test agent
    const result = await testClaim({
      claimId: body.claimId,
      claim: body.claim,
      context: body.context,
      articleUrl: body.articleUrl,
      articleTitle: body.articleTitle,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Claim test error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

// Return method info for OPTIONS
export async function OPTIONS() {
  return NextResponse.json(
    {
      methods: ['POST'],
      description: 'Deep verification endpoint for individual claims',
      body: {
        claimId: 'string (required)',
        claim: 'string (required) - The claim text to verify',
        context: 'string (required) - The surrounding context of the claim',
        articleUrl: 'string (optional) - URL of the source article',
        articleTitle: 'string (optional) - Title of the source article',
      },
    },
    { status: 200 }
  )
}
