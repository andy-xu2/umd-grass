import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq, and, or, gt } from 'drizzle-orm'

export async function isMostRecentConfirmedMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) return false

  const laterMatches = await db
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
            gt(matches.submittedAt, match.submittedAt),
          ),
        ),
      ),
    )
    .limit(1)

  return laterMatches.length === 0
}