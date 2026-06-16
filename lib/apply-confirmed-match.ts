import { db } from '@/lib/db'
import { matches, seasonStats, seasons } from '@/drizzle/schema'
import { eq, and, ne, desc } from 'drizzle-orm'
import { applySeasonDecay } from '@/lib/elo'
import { applyMatchDeltas } from '@/lib/match-engine'
import { DEFAULT_RR_CONFIG } from '@/lib/rr-config'
import type { Tx } from '@/lib/match-engine'

export async function applyConfirmedMatchIncremental(matchId: string) {
  await db.transaction(tx => applyConfirmedMatchIncrementalTx(tx, matchId))
}

export async function applyConfirmedMatchIncrementalTx(tx: Tx, matchId: string) {
  const rrConfig = DEFAULT_RR_CONFIG

  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match || match.status !== 'CONFIRMED') return

  const seasonId = match.seasonId

  const [season] = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))

  if (!season) return

  const playerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
  ] as const

  async function getOrCreate(userId: string) {
    const [existing] = await tx
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, seasonId)))

    if (existing) return existing

    const [prevStats] = await tx
      .select({ rr: seasonStats.rr })
      .from(seasonStats)
      .innerJoin(seasons, eq(seasonStats.seasonId, seasons.id))
      .where(and(eq(seasonStats.userId, userId), ne(seasonStats.seasonId, seasonId)))
      .orderBy(desc(seasons.startedAt))
      .limit(1)

    const startingRR = prevStats
      ? applySeasonDecay(prevStats.rr)
      : rrConfig.baseStartingRr

    const [created] = await tx
      .insert(seasonStats)
      .values({
        userId,
        seasonId,
        startingRr: startingRR,
        rr: startingRR,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
      })
      .returning()

    return created
  }

  const [t1p1Stats, t1p2Stats, t2p1Stats, t2p2Stats] = await Promise.all(
    playerIds.map(getOrCreate),
  )

  await applyMatchDeltas(
    tx,
    match,
    t1p1Stats,
    t1p2Stats,
    t2p1Stats,
    t2p2Stats,
    seasonId,
    rrConfig,
  )
}
