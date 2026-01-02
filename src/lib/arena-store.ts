/**
 * Shared Arena Store
 *
 * In-memory store shared across all Arena API routes.
 * In production, this would be replaced with a database.
 */

import type { DebateArena } from '@/types/arena'

// Arena store - shared across all routes
export const arenaStore = new Map<string, DebateArena>()

// Invoice store - shared across all routes
export interface ArenaInvoiceRecord {
  id: string
  arenaId: string
  amountSats: number
  amountUsd: number
  bolt11: string
  status: 'pending' | 'paid' | 'expired'
  expiresAt: string
  createdAt: string
}

export const invoiceStore = new Map<string, ArenaInvoiceRecord>()

/**
 * Get or create an arena
 */
export function getOrCreateArena(arenaId: string, threadId?: string): DebateArena {
  if (arenaStore.has(arenaId)) {
    return arenaStore.get(arenaId)!
  }

  // Create new arena
  const newArena: DebateArena = {
    id: arenaId,
    threadId: threadId || arenaId,
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
