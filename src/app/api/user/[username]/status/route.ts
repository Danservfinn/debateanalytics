import { NextRequest, NextResponse } from 'next/server'
import { getUserStatus } from '@/lib/neo4j'
import type { UserStatus } from '@/types/debate'

interface RouteContext {
  params: Promise<{ username: string }>
}

interface UserStatusResponse {
  success: boolean
  data?: UserStatus
  error?: string
}

/**
 * GET /api/user/[username]/status
 *
 * Lightweight check if a user profile is cached in Neo4j.
 * Returns cached archetype, overall score, and debate count if available.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<UserStatusResponse>> {
  try {
    const { username } = await context.params

    if (!username || username.length < 1 || username.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid username' },
        { status: 400 }
      )
    }

    // Clean username (remove u/ prefix if present)
    const cleanUsername = username.replace(/^u\//, '').toLowerCase()

    // Check if Neo4j is configured
    if (!process.env.NEO4J_URI) {
      // Return uncached status if Neo4j not configured
      return NextResponse.json({
        success: true,
        data: { cached: false }
      })
    }

    const status = await getUserStatus(cleanUsername)

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('User status error:', error)

    // If Neo4j connection fails, return uncached status
    if (error instanceof Error && error.message.includes('Neo4j')) {
      return NextResponse.json({
        success: true,
        data: { cached: false }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Failed to check user status' },
      { status: 500 }
    )
  }
}
