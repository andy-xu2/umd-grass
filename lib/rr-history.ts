import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { matches, rrChanges } from '@/drizzle/schema'
import { db } from '@/lib/db'
import type { RrHistoryEntry } from '@/lib/types'

export async function fetchRrHistory(userId: string, seasonId: string): Promise<RrHistoryEntry[]> {
  const rows = await db
    .select({
      matchId: matches.id,
      playedAt: matches.playedAt,
      rrBefore: rrChanges.rrBefore,
      rrAfter: rrChanges.rrAfter,
      delta: rrChanges.delta,
    })
    .from(rrChanges)
    .innerJoin(matches, eq(rrChanges.matchId, matches.id))
    .where(and(
      eq(rrChanges.userId, userId),
      eq(rrChanges.seasonId, seasonId),
      eq(matches.seasonId, seasonId),
      eq(matches.status, 'CONFIRMED'),
    ))
    // Match the rating engine's chronological replay order, including ties.
    .orderBy(asc(matches.playedAt), asc(matches.submittedAt), asc(matches.id))

  return rows.map(row => ({ ...row, playedAt: row.playedAt.toISOString() }))
}
