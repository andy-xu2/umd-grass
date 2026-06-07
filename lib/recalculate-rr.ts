import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import { eq, and, ne, desc, asc, count, inArray, sql } from 'drizzle-orm'
import { applySeasonDecay } from '@/lib/elo'
import { applyMatchDeltasInMemory, type MutableStats } from '@/lib/match-engine'
import { DEFAULT_RR_CONFIG } from '@/lib/rr-config'
import type { Tx } from '@/lib/match-engine'

export async function recalculateSeasonRr(seasonId: string) {
  await db.transaction(tx => recalculateSeasonRrTx(tx, seasonId))
}

export async function recalculateSeasonRrTx(tx: Tx, seasonId: string) {
  const rrConfig = DEFAULT_RR_CONFIG

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

  if (playerIds.length === 0) {
    await tx.delete(rrChanges).where(eq(rrChanges.seasonId, seasonId))
    return
  }

  const priorSeasonStats = await tx
    .select({
      userId: seasonStats.userId,
      rr: seasonStats.rr,
      startedAt: seasons.startedAt,
    })
    .from(seasonStats)
    .innerJoin(seasons, eq(seasonStats.seasonId, seasons.id))
    .where(and(inArray(seasonStats.userId, playerIds), ne(seasonStats.seasonId, seasonId)))
    .orderBy(desc(seasons.startedAt))

  const priorRrByUser = new Map<string, number>()
  for (const row of priorSeasonStats) {
    if (!priorRrByUser.has(row.userId)) priorRrByUser.set(row.userId, row.rr)
  }

  const historicalGameCounts = await tx
    .select({ userId: rrChanges.userId, games: count(rrChanges.id) })
    .from(rrChanges)
    .where(and(inArray(rrChanges.userId, playerIds), ne(rrChanges.seasonId, seasonId)))
    .groupBy(rrChanges.userId)

  const lifetimeGamesByUser = new Map(
    historicalGameCounts.map(row => [row.userId, Number(row.games)]),
  )
  const statsByUser = new Map<string, MutableStats>()
  const newStatsUserIds = new Set<string>()

  for (const userId of playerIds) {
    const existing = keepByUser.get(userId)
    const priorRr = priorRrByUser.get(userId)
    const startingRR = priorRr !== undefined
      ? applySeasonDecay(priorRr)
      : rrConfig.baseStartingRr

    statsByUser.set(userId, {
      id: existing?.id ?? '',
      rr: startingRR,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    })
    if (!existing) newStatsUserIds.add(userId)
  }

  const rebuiltChanges: Array<{
    matchId: string
    userId: string
    seasonId: string
    delta: number
    rrBefore: number
    rrAfter: number
  }> = []

  for (const match of confirmedMatches) {
    const t1p1Stats = statsByUser.get(match.team1Player1Id)
    const t1p2Stats = statsByUser.get(match.team1Player2Id)
    const t2p1Stats = statsByUser.get(match.team2Player1Id)
    const t2p2Stats = statsByUser.get(match.team2Player2Id)

    if (!t1p1Stats || !t1p2Stats || !t2p1Stats || !t2p2Stats) continue

    const updates = applyMatchDeltasInMemory(
      match,
      t1p1Stats,
      t1p2Stats,
      t2p1Stats,
      t2p2Stats,
      [
        lifetimeGamesByUser.get(match.team1Player1Id) ?? 0,
        lifetimeGamesByUser.get(match.team1Player2Id) ?? 0,
        lifetimeGamesByUser.get(match.team2Player1Id) ?? 0,
        lifetimeGamesByUser.get(match.team2Player2Id) ?? 0,
      ],
      rrConfig,
    )

    for (const update of updates) {
      rebuiltChanges.push({
        matchId: match.id,
        userId: update.userId,
        seasonId,
        delta: update.delta,
        rrBefore: update.rrBefore,
        rrAfter: update.rrAfter,
      })
      lifetimeGamesByUser.set(
        update.userId,
        (lifetimeGamesByUser.get(update.userId) ?? 0) + 1,
      )
    }
  }

  await tx.delete(rrChanges).where(eq(rrChanges.seasonId, seasonId))

  const existingFinalStats = Array.from(statsByUser, ([userId, stats]) => ({ userId, stats }))
    .filter(({ userId }) => !newStatsUserIds.has(userId))

  if (existingFinalStats.length > 0) {
    const values = sql.join(
      existingFinalStats.map(({ stats }) => sql`(
        ${stats.id}::uuid,
        ${stats.rr}::integer,
        ${stats.gamesPlayed}::integer,
        ${stats.wins}::integer,
        ${stats.losses}::integer
      )`),
      sql`, `,
    )

    await tx.execute(sql`
      update ${seasonStats}
      set
        rr = rebuilt.rr,
        games_played = rebuilt.games_played,
        wins = rebuilt.wins,
        losses = rebuilt.losses
      from (values ${values}) as rebuilt(id, rr, games_played, wins, losses)
      where ${seasonStats.id} = rebuilt.id
    `)
  }

  const newStats = Array.from(newStatsUserIds, userId => {
    const stats = statsByUser.get(userId)!
    return {
      userId,
      seasonId,
      rr: stats.rr,
      gamesPlayed: stats.gamesPlayed,
      wins: stats.wins,
      losses: stats.losses,
    }
  })

  if (newStats.length > 0) {
    await tx.insert(seasonStats).values(newStats)
  }

  for (let offset = 0; offset < rebuiltChanges.length; offset += 500) {
    await tx.insert(rrChanges).values(rebuiltChanges.slice(offset, offset + 500))
  }
}
