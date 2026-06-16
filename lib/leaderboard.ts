import { db } from '@/lib/db'
import { users, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, and, gte, desc, inArray, sql } from 'drizzle-orm'
import { cacheTag, cacheLife, revalidateTag } from 'next/cache'
import type { LeaderboardEntry, LeaderboardMe } from '@/lib/types'
import { PLACEMENT_GAMES } from '@/lib/elo'

const LEADERBOARDS_TAG = 'leaderboards'

function tagLeaderboard(seasonId: string) {
  cacheTag(LEADERBOARDS_TAG)
  cacheTag(`leaderboard-${seasonId}`)
  cacheLife('minutes')
}

export async function fetchCachedLeaderboardRows(seasonId: string): Promise<LeaderboardEntry[]> {
  'use cache'
  tagLeaderboard(seasonId)

  const leaderboardRows = await db
    .select({
      userId: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      rr: seasonStats.rr,
      gamesPlayed: seasonStats.gamesPlayed,
      wins: seasonStats.wins,
      losses: seasonStats.losses,
    })
    .from(seasonStats)
    .innerJoin(users, eq(seasonStats.userId, users.id))
    .where(and(eq(seasonStats.seasonId, seasonId), gte(seasonStats.gamesPlayed, 5), eq(users.isDeleted, false)))
    .orderBy(desc(seasonStats.rr))

  let rankCounter = 0
  const entries: LeaderboardEntry[] = leaderboardRows.map(row => ({
    ...row,
    rank: ++rankCounter,
    rankTrend: null,
  }))

  const playerIds = entries.map(e => e.userId)
  if (playerIds.length > 0) {
    const recentChanges = await db
      .select({ userId: rrChanges.userId, rrBefore: rrChanges.rrBefore })
      .from(rrChanges)
      .where(and(eq(rrChanges.seasonId, seasonId), inArray(rrChanges.userId, playerIds)))
      .orderBy(desc(rrChanges.createdAt))
      .limit(Math.max(500, playerIds.length * 4))

    const latestRrBefore = new Map<string, number>()
    for (const change of recentChanges) {
      if (!latestRrBefore.has(change.userId)) latestRrBefore.set(change.userId, change.rrBefore)
    }
    for (const entry of entries) {
      const rrBefore = latestRrBefore.get(entry.userId)
      if (rrBefore == null) { entry.rankTrend = 0; continue }
      const prevRank = entries.filter(e => e.userId !== entry.userId && e.rr > rrBefore).length + 1
      entry.rankTrend = prevRank - entry.rank
    }
  }

  return entries
}

export async function fetchCachedLifetimeLeaderboardRows(): Promise<LeaderboardEntry[]> {
  'use cache'
  tagLeaderboard('lifetime')

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      totalGames: sql<number>`sum(${seasonStats.gamesPlayed})::int`,
      totalWins: sql<number>`sum(${seasonStats.wins})::int`,
      totalLosses: sql<number>`sum(${seasonStats.losses})::int`,
      peakRR: sql<number>`max(${seasonStats.rr})::int`,
    })
    .from(seasonStats)
    .innerJoin(users, eq(seasonStats.userId, users.id))
    .where(eq(users.isDeleted, false))
    .groupBy(users.id, users.name, users.avatarUrl)
    .having(sql`sum(${seasonStats.gamesPlayed}) >= 1`)
    .orderBy(desc(sql`sum(${seasonStats.wins})`), desc(sql`max(${seasonStats.rr})`))

  return rows.map((row, index) => ({
    userId: row.userId,
    name: row.name ?? '',
    avatarUrl: row.avatarUrl,
    rr: row.peakRR,
    gamesPlayed: row.totalGames,
    wins: row.totalWins,
    losses: row.totalLosses,
    rank: index + 1,
    rankTrend: null,
  }))
}

export async function fetchLeaderboardMe(
  userId: string,
  seasonId: string,
  entries: LeaderboardEntry[],
): Promise<LeaderboardMe | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      rr: seasonStats.rr,
      gamesPlayed: seasonStats.gamesPlayed,
    })
    .from(users)
    .leftJoin(
      seasonStats,
      and(eq(seasonStats.userId, users.id), eq(seasonStats.seasonId, seasonId)),
    )
    .where(eq(users.id, userId))
    .orderBy(desc(seasonStats.gamesPlayed))
    .limit(1)

  if (!row) return null

  const stats = row.rr == null || row.gamesPlayed == null
    ? null
    : { rr: row.rr, gamesPlayed: row.gamesPlayed }

  return {
    id: row.id,
    name: row.name,
    stats,
    rank: stats && stats.gamesPlayed >= PLACEMENT_GAMES
      ? entries.find(entry => entry.userId === userId)?.rank ?? null
      : null,
  }
}

export function invalidateLeaderboardCache(seasonId: string) {
  revalidateTag(`leaderboard-${seasonId}`, { expire: 0 })
  revalidateTag('leaderboard-lifetime', { expire: 0 })
}

export function invalidateAllLeaderboardCaches() {
  revalidateTag(LEADERBOARDS_TAG, { expire: 0 })
}
