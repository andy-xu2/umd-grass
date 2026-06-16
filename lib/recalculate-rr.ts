import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import {
  eq,
  and,
  ne,
  desc,
  asc,
  count,
  inArray,
  notInArray,
  lt,
  or,
  not,
  sql,
} from 'drizzle-orm'
import { applySeasonDecay } from '@/lib/elo'
import { applyMatchDeltasInMemory, type MutableStats } from '@/lib/match-engine'
import { DEFAULT_RR_CONFIG } from '@/lib/rr-config'
import type { RrReplayBoundary } from '@/lib/rr-replay-order'
import type { Tx } from '@/lib/match-engine'

export type RrReplayResult = {
  mode: 'suffix' | 'full'
  replayedMatches: number
}

function isBeforeBoundary(boundary: RrReplayBoundary) {
  return or(
    lt(matches.playedAt, boundary.playedAt),
    and(
      eq(matches.playedAt, boundary.playedAt),
      lt(matches.submittedAt, boundary.submittedAt),
    ),
    and(
      eq(matches.playedAt, boundary.playedAt),
      eq(matches.submittedAt, boundary.submittedAt),
      lt(matches.id, boundary.id),
    ),
  )
}

function collectPlayerIds(
  matchRows: Array<{
    team1Player1Id: string
    team1Player2Id: string
    team2Player1Id: string
    team2Player2Id: string
  }>,
  additionalPlayerIds: readonly string[] = [],
): string[] {
  return Array.from(new Set([
    ...additionalPlayerIds,
    ...matchRows.flatMap(match => [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ]),
  ]))
}

type ReplayMatchRow = Parameters<typeof applyMatchDeltasInMemory>[0]

type RebuiltRrChange = {
  matchId: string
  userId: string
  seasonId: string
  delta: number
  rrBefore: number
  rrAfter: number
}

function replayMatchesInMemory(
  matchRows: readonly ReplayMatchRow[],
  statsByUser: Map<string, MutableStats>,
  lifetimeGamesByUser: Map<string, number>,
  seasonId: string,
): RebuiltRrChange[] {
  const rebuiltChanges: RebuiltRrChange[] = []

  for (const match of matchRows) {
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
      DEFAULT_RR_CONFIG,
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

  return rebuiltChanges
}

async function persistReplayedStateTx(
  tx: Tx,
  seasonId: string,
  statsByUser: Map<string, MutableStats>,
  startingRrByUser: Map<string, number>,
  newStatsUserIds: Set<string>,
  rebuiltChanges: RebuiltRrChange[],
) {
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
      startingRr: startingRrByUser.get(userId)!,
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

export async function recalculateSeasonRr(seasonId: string) {
  await db.transaction(tx => recalculateSeasonRrTx(tx, seasonId))
}

/**
 * Replays only matches at or after the affected chronological boundary. RR
 * checkpoints before the boundary remain authoritative and are left untouched.
 */
export async function recalculateSeasonRrFromTx(
  tx: Tx,
  seasonId: string,
  boundary: RrReplayBoundary,
  additionalAffectedPlayerIds: readonly string[] = [],
): Promise<RrReplayResult> {
  const rrConfig = DEFAULT_RR_CONFIG
  const beforeBoundary = isBeforeBoundary(boundary)!

  const suffixMatches = await tx
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.seasonId, seasonId),
        eq(matches.status, 'CONFIRMED'),
        not(beforeBoundary),
      ),
    )
    .orderBy(asc(matches.playedAt), asc(matches.submittedAt), asc(matches.id))

  const playerIds = collectPlayerIds(suffixMatches, additionalAffectedPlayerIds)
  if (playerIds.length === 0) return { mode: 'suffix', replayedMatches: 0 }

  const [existingStats, prefixMatches, prefixChanges, historicalGameCounts] = await Promise.all([
    tx
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.seasonId, seasonId), inArray(seasonStats.userId, playerIds))),
    tx
      .select({
        team1Player1Id: matches.team1Player1Id,
        team1Player2Id: matches.team1Player2Id,
        team2Player1Id: matches.team2Player1Id,
        team2Player2Id: matches.team2Player2Id,
        team1Sets: matches.team1Sets,
        team2Sets: matches.team2Sets,
      })
      .from(matches)
      .where(
        and(
          eq(matches.seasonId, seasonId),
          eq(matches.status, 'CONFIRMED'),
          beforeBoundary,
        ),
      ),
    tx
      .select({
        userId: rrChanges.userId,
        rrAfter: rrChanges.rrAfter,
      })
      .from(rrChanges)
      .innerJoin(matches, eq(rrChanges.matchId, matches.id))
      .where(
        and(
          eq(rrChanges.seasonId, seasonId),
          inArray(rrChanges.userId, playerIds),
          beforeBoundary,
        ),
      )
      .orderBy(asc(matches.playedAt), asc(matches.submittedAt), asc(matches.id)),
    tx
      .select({ userId: rrChanges.userId, games: count(rrChanges.id) })
      .from(rrChanges)
      .where(and(inArray(rrChanges.userId, playerIds), ne(rrChanges.seasonId, seasonId)))
      .groupBy(rrChanges.userId),
  ])

  const existingByUser = new Map<string, (typeof existingStats)[number]>()
  for (const row of existingStats) {
    if (existingByUser.has(row.userId)) {
      const replayedMatches = await recalculateSeasonRrTx(tx, seasonId)
      return { mode: 'full', replayedMatches }
    }
    existingByUser.set(row.userId, row)
  }

  const prefixStatsByUser = new Map<string, Pick<MutableStats, 'gamesPlayed' | 'wins' | 'losses'>>()
  for (const userId of playerIds) {
    prefixStatsByUser.set(userId, { gamesPlayed: 0, wins: 0, losses: 0 })
  }

  const recordPrefixResult = (userId: string, won: boolean) => {
    const stats = prefixStatsByUser.get(userId)
    if (!stats) return
    stats.gamesPlayed += 1
    stats.wins += won ? 1 : 0
    stats.losses += won ? 0 : 1
  }

  for (const match of prefixMatches) {
    const team1Won = match.team1Sets > match.team2Sets
    recordPrefixResult(match.team1Player1Id, team1Won)
    recordPrefixResult(match.team1Player2Id, team1Won)
    recordPrefixResult(match.team2Player1Id, !team1Won)
    recordPrefixResult(match.team2Player2Id, !team1Won)
  }

  const checkpointRrByUser = new Map<string, number>()
  for (const change of prefixChanges) {
    checkpointRrByUser.set(change.userId, change.rrAfter)
  }

  // Missing checkpoint history means the prefix cannot be trusted. The full
  // replay is slower, but guarantees a correct repair.
  for (const userId of playerIds) {
    const prefixStats = prefixStatsByUser.get(userId)!
    if (prefixStats.gamesPlayed > 0 && !checkpointRrByUser.has(userId)) {
      const replayedMatches = await recalculateSeasonRrTx(tx, seasonId)
      return { mode: 'full', replayedMatches }
    }
  }

  const missingStatsUserIds = playerIds.filter(userId => !existingByUser.has(userId))
  const priorRrByUser = new Map<string, number>()
  if (missingStatsUserIds.length > 0) {
    const priorSeasonStats = await tx
      .select({
        userId: seasonStats.userId,
        rr: seasonStats.rr,
        startedAt: seasons.startedAt,
      })
      .from(seasonStats)
      .innerJoin(seasons, eq(seasonStats.seasonId, seasons.id))
      .where(
        and(
          inArray(seasonStats.userId, missingStatsUserIds),
          ne(seasonStats.seasonId, seasonId),
        ),
      )
      .orderBy(desc(seasons.startedAt))

    for (const row of priorSeasonStats) {
      if (!priorRrByUser.has(row.userId)) priorRrByUser.set(row.userId, row.rr)
    }
  }

  const statsByUser = new Map<string, MutableStats>()
  const startingRrByUser = new Map<string, number>()
  const newStatsUserIds = new Set<string>()
  const lifetimeGamesByUser = new Map(
    historicalGameCounts.map(row => [row.userId, Number(row.games)]),
  )

  for (const userId of playerIds) {
    const existing = existingByUser.get(userId)
    const priorRr = priorRrByUser.get(userId)
    const startingRr = existing?.startingRr ?? (priorRr !== undefined
      ? applySeasonDecay(priorRr)
      : rrConfig.baseStartingRr)
    const prefixStats = prefixStatsByUser.get(userId)!

    startingRrByUser.set(userId, startingRr)
    statsByUser.set(userId, {
      id: existing?.id ?? '',
      rr: checkpointRrByUser.get(userId) ?? startingRr,
      gamesPlayed: prefixStats.gamesPlayed,
      wins: prefixStats.wins,
      losses: prefixStats.losses,
    })
    lifetimeGamesByUser.set(
      userId,
      (lifetimeGamesByUser.get(userId) ?? 0) + prefixStats.gamesPlayed,
    )
    if (!existing) newStatsUserIds.add(userId)
  }

  const rebuiltChanges = replayMatchesInMemory(
    suffixMatches,
    statsByUser,
    lifetimeGamesByUser,
    seasonId,
  )

  const suffixMatchIds = suffixMatches.map(match => match.id)
  if (suffixMatchIds.length > 0) {
    await tx.delete(rrChanges).where(inArray(rrChanges.matchId, suffixMatchIds))
  }

  await persistReplayedStateTx(
    tx,
    seasonId,
    statsByUser,
    startingRrByUser,
    newStatsUserIds,
    rebuiltChanges,
  )

  return { mode: 'suffix', replayedMatches: suffixMatches.length }
}

export async function recalculateSeasonRrTx(tx: Tx, seasonId: string) {
  const rrConfig = DEFAULT_RR_CONFIG

  const confirmedMatches = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.seasonId, seasonId), eq(matches.status, 'CONFIRMED')))
    .orderBy(asc(matches.playedAt), asc(matches.submittedAt), asc(matches.id))

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
    await tx
      .update(seasonStats)
      .set({
        rr: sql`${seasonStats.startingRr}`,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
      })
      .where(eq(seasonStats.seasonId, seasonId))
    return 0
  }

  // A deleted match may have been a player's only match in the season. Reset
  // any such non-participants instead of leaving their deleted result in stats.
  await tx
    .update(seasonStats)
    .set({
      rr: sql`${seasonStats.startingRr}`,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    })
    .where(
      and(
        eq(seasonStats.seasonId, seasonId),
        notInArray(seasonStats.userId, playerIds),
      ),
    )

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
  const startingRrByUser = new Map<string, number>()
  const newStatsUserIds = new Set<string>()

  for (const userId of playerIds) {
    const existing = keepByUser.get(userId)
    const priorRr = priorRrByUser.get(userId)
    const startingRR = existing?.startingRr ?? (priorRr !== undefined
      ? applySeasonDecay(priorRr)
      : rrConfig.baseStartingRr)

    startingRrByUser.set(userId, startingRR)
    statsByUser.set(userId, {
      id: existing?.id ?? '',
      rr: startingRR,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    })
    if (!existing) newStatsUserIds.add(userId)
  }

  const rebuiltChanges = replayMatchesInMemory(
    confirmedMatches,
    statsByUser,
    lifetimeGamesByUser,
    seasonId,
  )

  await tx.delete(rrChanges).where(eq(rrChanges.seasonId, seasonId))
  await persistReplayedStateTx(
    tx,
    seasonId,
    statsByUser,
    startingRrByUser,
    newStatsUserIds,
    rebuiltChanges,
  )

  return confirmedMatches.length
}
