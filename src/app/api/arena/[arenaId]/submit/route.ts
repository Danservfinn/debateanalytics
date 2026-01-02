import { NextRequest, NextResponse } from 'next/server'
import type { ArenaSubmission } from '@/types/arena'

// Reference the same store (in production, this would be a database)
const arenaStore = new Map()

/**
 * POST /api/arena/[arenaId]/submit
 * Submit a sealed argument to the arena
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  try {
    const { arenaId } = await params
    const body = await request.json()

    // Validate required fields
    if (!body.position || !['pro', 'con'].includes(body.position)) {
      return NextResponse.json(
        { success: false, error: 'Invalid position' },
        { status: 400 }
      )
    }

    if (!body.argumentText || body.argumentText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Argument text is required' },
        { status: 400 }
      )
    }

    if (body.argumentText.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Argument exceeds 2000 character limit' },
        { status: 400 }
      )
    }

    if (!body.sources || body.sources.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one source is required' },
        { status: 400 }
      )
    }

    // Get or create arena
    let arena = arenaStore.get(arenaId)
    if (!arena) {
      // Create a minimal arena if it doesn't exist
      arena = {
        id: arenaId,
        threadId: arenaId,
        topic: 'Debate Topic',
        description: '',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        status: 'active',
        submissions: [],
        battles: [],
        totalBattles: 0,
        pendingNewArguments: 0,
        proCount: 0,
        conCount: 0,
        minSubmissionsPerSide: 2,
        battleCostUsd: 2
      }
      arenaStore.set(arenaId, arena)
    }

    // Create submission
    const submission: ArenaSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      arenaId,
      position: body.position,
      author: body.anonymous ? 'Anonymous' : (body.author || 'Anonymous'),
      authorId: body.authorId || 'anon_' + Math.random().toString(36).slice(2, 9),
      argumentText: body.argumentText.trim(),
      sources: body.sources.map((s: any) => ({
        title: s.title || 'Source',
        url: s.url,
        quote: s.quote || ''
      })),
      submittedAt: new Date().toISOString(),
      isRevealed: false
    }

    // Add to arena
    arena.submissions.push(submission)

    // Update counts
    if (submission.position === 'pro') {
      arena.proCount++
    } else {
      arena.conCount++
    }

    // Track pending new arguments if there have been battles
    if (arena.battles.length > 0) {
      arena.pendingNewArguments++
    }

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        position: submission.position,
        message: 'Argument sealed successfully'
      }
    })
  } catch (error) {
    console.error('Arena submit error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit argument' },
      { status: 500 }
    )
  }
}
