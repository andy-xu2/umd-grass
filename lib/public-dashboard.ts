import { cacheLife, cacheTag } from 'next/cache'
import { and, count, countDistinct, desc, eq, gt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { matches, seasonStats, users } from '@/drizzle/schema'
import { db } from '@/lib/db'
import type { PlayerInfo, SetScore } from '@/lib/types'

export type PublicMatchResult = {
  id: string
  playedAt: string
  team1Player1: PlayerInfo
  team1Player2: PlayerInfo
  team2Player1: PlayerInfo
  team2Player2: PlayerInfo
  team1Sets: number
  team2Sets: number
  setScores: SetScore[] | null
}

export type PublicDashboardData = {
  activePlayers: number
  confirmedMatches: number
  recentMatches: PublicMatchResult[]
}

export async function fetchCachedPublicDashboardData(
  seasonId: string,
): Promise<PublicDashboardData> {
  'use cache'
  // Confirmations and ranking repairs already invalidate this season tag.
  cacheTag(`leaderboard-${seasonId}`)
  cacheLife('minutes')

  const t1p1 = alias(users, 'public_t1p1')
  const t1p2 = alias(users, 'public_t1p2')
  const t2p1 = alias(users, 'public_t2p1')
  const t2p2 = alias(users, 'public_t2p2')

  const [activePlayerRows, confirmedMatchRows, recentRows] = await Promise.all([
    db
      .select({ value: countDistinct(seasonStats.userId) })
      .from(seasonStats)
      .innerJoin(users, eq(seasonStats.userId, users.id))
      .where(
        and(
          eq(seasonStats.seasonId, seasonId),
          gt(seasonStats.gamesPlayed, 0),
          eq(users.isDeleted, false),
        ),
      ),
    db
      .select({ value: count() })
      .from(matches)
      .where(and(eq(matches.seasonId, seasonId), eq(matches.status, 'CONFIRMED'))),
    db
      .select({
        id: matches.id,
        playedAt: matches.playedAt,
        team1Player1Id: matches.team1Player1Id,
        team1Player1Name: t1p1.name,
        team1Player1Avatar: t1p1.avatarUrl,
        team1Player1Deleted: t1p1.isDeleted,
        team1Player2Id: matches.team1Player2Id,
        team1Player2Name: t1p2.name,
        team1Player2Avatar: t1p2.avatarUrl,
        team1Player2Deleted: t1p2.isDeleted,
        team2Player1Id: matches.team2Player1Id,
        team2Player1Name: t2p1.name,
        team2Player1Avatar: t2p1.avatarUrl,
        team2Player1Deleted: t2p1.isDeleted,
        team2Player2Id: matches.team2Player2Id,
        team2Player2Name: t2p2.name,
        team2Player2Avatar: t2p2.avatarUrl,
        team2Player2Deleted: t2p2.isDeleted,
        team1Sets: matches.team1Sets,
        team2Sets: matches.team2Sets,
        setScores: matches.setScores,
      })
      .from(matches)
      .innerJoin(t1p1, eq(matches.team1Player1Id, t1p1.id))
      .innerJoin(t1p2, eq(matches.team1Player2Id, t1p2.id))
      .innerJoin(t2p1, eq(matches.team2Player1Id, t2p1.id))
      .innerJoin(t2p2, eq(matches.team2Player2Id, t2p2.id))
      .where(and(eq(matches.seasonId, seasonId), eq(matches.status, 'CONFIRMED')))
      .orderBy(desc(matches.playedAt), desc(matches.submittedAt), desc(matches.id))
      .limit(5),
  ])

  const toPlayer = (
    id: string,
    name: string,
    avatarUrl: string | null,
    isDeleted: boolean,
  ): PlayerInfo => ({
    id,
    name: isDeleted ? 'Deleted User' : name,
    avatarUrl: isDeleted ? null : avatarUrl,
  })

  return {
    activePlayers: Number(activePlayerRows[0]?.value ?? 0),
    confirmedMatches: Number(confirmedMatchRows[0]?.value ?? 0),
    recentMatches: recentRows.map(row => ({
      id: row.id,
      playedAt: row.playedAt.toISOString(),
      team1Player1: toPlayer(
        row.team1Player1Id,
        row.team1Player1Name,
        row.team1Player1Avatar,
        row.team1Player1Deleted,
      ),
      team1Player2: toPlayer(
        row.team1Player2Id,
        row.team1Player2Name,
        row.team1Player2Avatar,
        row.team1Player2Deleted,
      ),
      team2Player1: toPlayer(
        row.team2Player1Id,
        row.team2Player1Name,
        row.team2Player1Avatar,
        row.team2Player1Deleted,
      ),
      team2Player2: toPlayer(
        row.team2Player2Id,
        row.team2Player2Name,
        row.team2Player2Avatar,
        row.team2Player2Deleted,
      ),
      team1Sets: row.team1Sets,
      team2Sets: row.team2Sets,
      setScores: row.setScores,
    })),
  }
}
