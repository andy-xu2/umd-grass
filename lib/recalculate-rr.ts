import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import { eq, and, ne, desc, asc } from 'drizzle-orm'
import { applySeasonDecay } from '@/lib/elo'
import { applyMatchDeltas } from '@/lib/match-engine'

export async function recalculateSeasonRr(seasonId: string) {
  await db.transaction(async tx => {
    const confirmedMatches = await tx
      .select()
      .from(matches)
      .where(and(eq(matches.seasonId, seasonId), eq(matches.status, 'CONFIRMED')))
      .orderBy(asc(matches.playedAt), asc(matches.submittedAt))

    const playerIds = Array.from(
      new Set(
        confirmedMatches.flatMap(m => [
          m.team1Player1Id,
          m.team1Player2Id,
          m.team2Player1Id,
          m.team2Player2Id,
        ]),
      ),
    )

    await tx.delete(rrChanges).where(eq(rrChanges.seasonId, seasonId))

    // De-duplicate any existing seasonStats rows for this season
    const existingStats = await tx
      .select()
      .from(seasonStats)
      .where(eq(seasonStats.seasonId, seasonId))

    const keepByUser = new Map<string, (typeof existingStats)[number]>()
    const dupIds: string[] = []
    for (const row of existingStats) {
      keepByUser.has(row.userId) ? dupIds.push(row.id) : keepByUser.set(row.userId, row)
    }
    for (const id of dupIds) {
      await tx.delete(seasonStats).where(eq(seasonStats.id, id))
    }

    // Reset or create each player's stats back to their season-start RR
    const statsByUser = new Map<string, (typeof existingStats)[number]>()

    for (const userId of playerIds) {
      const existing = keepByUser.get(userId)

      const [prevStats] = await tx
        .select({ rr: seasonStats.rr })
        .from(seasonStats)
        .innerJoin(seasons, eq(seasonStats.seasonId, seasons.id))
        .where(and(eq(seasonStats.userId, userId), ne(seasonStats.seasonId, seasonId)))
        .orderBy(desc(seasons.startedAt))
        .limit(1)

      const startingRR = prevStats ? applySeasonDecay(prevStats.rr) : 0

      if (existing) {
        await tx
          .update(seasonStats)
          .set({ rr: startingRR, gamesPlayed: 0, wins: 0, losses: 0 })
          .where(eq(seasonStats.id, existing.id))
        statsByUser.set(userId, { ...existing, rr: startingRR, gamesPlayed: 0, wins: 0, losses: 0 })
      } else {
        const [created] = await tx
          .insert(seasonStats)
          .values({ userId, seasonId, rr: startingRR, gamesPlayed: 0, wins: 0, losses: 0 })
          .returning()
        statsByUser.set(userId, created)
      }
    }

    for (const match of confirmedMatches) {
      const t1p1Stats = statsByUser.get(match.team1Player1Id)
      const t1p2Stats = statsByUser.get(match.team1Player2Id)
      const t2p1Stats = statsByUser.get(match.team2Player1Id)
      const t2p2Stats = statsByUser.get(match.team2Player2Id)
      if (!t1p1Stats || !t1p2Stats || !t2p1Stats || !t2p2Stats) continue

      await applyMatchDeltas(tx, match, t1p1Stats, t1p2Stats, t2p1Stats, t2p2Stats, seasonId)
    }
  })
}
