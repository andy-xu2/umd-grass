import { db } from '@/lib/db'
import { users, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, and, gte, desc, inArray } from 'drizzle-orm'
import { cacheTag, cacheLife } from 'next/cache'
import type { LeaderboardEntry } from '@/lib/types'

export async function fetchCachedLeaderboardRows(seasonId: string): Promise<LeaderboardEntry[]> {
  'use cache'
  cacheTag(`leaderboard-${seasonId}`)
  cacheLife('minutes')

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
