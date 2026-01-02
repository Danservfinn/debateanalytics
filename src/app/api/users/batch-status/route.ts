import { NextRequest, NextResponse } from 'next/server'
import { getBatchUserStatus } from '@/lib/neo4j'
import type { BatchUserStatus } from '@/types/debate'

interface BatchStatusRequest {
  usernames: string[]
}

interface BatchStatusResponse {
  success: boolean
  data?: BatchUserStatus
  error?: string
}

/**
 * POST /api/users/batch-status
 *
 * Batch lookup for multiple user profiles.
 * Used to check which thread participants have cached profiles.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<BatchStatusResponse>> {
  try {
    const body: BatchStatusRequest = await request.json()

    if (!body.usernames || !Array.isArray(body.usernames)) {
      return NextResponse.json(
        { success: false, error: 'usernames array is required' },
        { status: 400 }
      )
    }

    // Limit batch size
    if (body.usernames.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 usernames per request' },
        { status: 400 }
      )
    }

    // Clean usernames
    const cleanUsernames = body.usernames
      .filter(u => u && typeof u === 'string')
      .map(u => u.replace(/^u\//, '').toLowerCase())
      .filter(u => u.length > 0 && u.length <= 50)

    if (cleanUsernames.length === 0) {
      return NextResponse.json({
        success: true,
        data: {}
      })
    }

    // Check if Neo4j is configured
    if (!process.env.NEO4J_URI) {
      // Return all uncached if Neo4j not configured
      const uncachedStatus: BatchUserStatus = {}
      for (const username of cleanUsernames) {
        uncachedStatus[username] = { cached: false }
      }
      return NextResponse.json({
        success: true,
        data: uncachedStatus
      })
    }

    const status = await getBatchUserStatus(cleanUsernames)

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Batch status error:', error)

    // If Neo4j connection fails, return empty status
    if (error instanceof Error && error.message.includes('Neo4j')) {
      return NextResponse.json({
        success: true,
        data: {}
      })
    }

    return NextResponse.json(
      { success: false, error: 'Failed to check user status' },
      { status: 500 }
    )
  }
}
