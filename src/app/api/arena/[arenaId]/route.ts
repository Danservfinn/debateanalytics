import { NextRequest, NextResponse } from 'next/server'
import type { DebateArena } from '@/types/arena'

// In-memory store for demo purposes
// In production, this would be a database
const arenaStore = new Map<string, DebateArena>()

// Initialize with some sample data
function getOrCreateArena(arenaId: string): DebateArena {
  if (arenaStore.has(arenaId)) {
    return arenaStore.get(arenaId)!
  }

  // Create new arena from threadId
  const newArena: DebateArena = {
    id: arenaId,
    threadId: arenaId,
    topic: 'Is beef tallow a healthy cooking fat?',
    description: 'Debate the health benefits and risks of using beef tallow as a primary cooking fat compared to vegetable oils.',
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

  arenaStore.set(arenaId, newArena)
  return newArena
}

/**
 * GET /api/arena/[arenaId]
 * Get arena state and submissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  try {
    const { arenaId } = await params
    const arena = getOrCreateArena(arenaId)

    // Filter out unrevealed argument content for the response
    const safeArena = {
      ...arena,
      submissions: arena.submissions.map(sub => ({
        ...sub,
        argumentText: sub.isRevealed ? sub.argumentText : '[SEALED]',
        sources: sub.isRevealed ? sub.sources : []
      }))
    }

    return NextResponse.json({
      success: true,
      data: safeArena
    })
  } catch (error) {
    console.error('Arena GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load arena' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/arena/[arenaId]
 * Create a new arena for a thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  try {
    const { arenaId } = await params
    const body = await request.json()

    const arena: DebateArena = {
      id: arenaId,
      threadId: body.threadId || arenaId,
      topic: body.topic,
      description: body.description || '',
      createdAt: new Date().toISOString(),
      createdBy: body.createdBy || 'anonymous',
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

    return NextResponse.json({
      success: true,
      data: arena
    })
  } catch (error) {
    console.error('Arena POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create arena' },
      { status: 500 }
    )
  }
}
