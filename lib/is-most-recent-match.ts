import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq, and, or, gt } from 'drizzle-orm'
import type { Tx } from '@/lib/match-engine'

type MatchOrderingRow = {
  id: string
  seasonId: string
  playedAt: Date
  submittedAt: Date
}

export async function isMostRecentConfirmedMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) return false

  return isMostRecentConfirmedMatchRow(db as unknown as Tx, match)
}

export async function isMostRecentConfirmedMatchTx(tx: Tx, matchId: string) {
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) return false

  return isMostRecentConfirmedMatchRow(tx, match)
}

export async function isMostRecentConfirmedMatchRow(tx: Tx, match: MatchOrderingRow) {
  const laterMatches = await tx
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.seasonId, match.seasonId),
        eq(matches.status, 'CONFIRMED'),
        or(
          gt(matches.playedAt, match.playedAt),
          and(
            eq(matches.playedAt, match.playedAt),
            or(
              gt(matches.submittedAt, match.submittedAt),
              and(
                eq(matches.submittedAt, match.submittedAt),
                gt(matches.id, match.id),
              ),
            ),
          ),
        ),
      ),
    )
    .limit(1)

  return laterMatches.length === 0
}
