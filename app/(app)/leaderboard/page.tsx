import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, desc, gt, and, count, inArray } from 'drizzle-orm'
import type { LeaderboardEntry, Season } from '@/lib/types'
import LeaderboardClient from './leaderboard-client'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Batch 1: all seasons (need seasonId before anything else)
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.startedAt))
  const seasonList: Season[] = allSeasons.map(s => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  const activeSeason = allSeasons.find(s => s.isActive) ?? null
  const seasonId = activeSeason?.id ?? null

  let entries: LeaderboardEntry[] = []
  let me = null

  if (seasonId) {
    // Batch 2: leaderboard rows + my profile + my stats — all in parallel
    const [leaderboardRows, [profile], myStatsRows] = await Promise.all([
      db.select({
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        rr: seasonStats.rr,
        gamesPlayed: seasonStats.gamesPlayed,
        wins: seasonStats.wins,
        losses: seasonStats.losses,
        isRevealed: seasonStats.isRevealed,
      })
        .from(seasonStats)
        .innerJoin(users, eq(seasonStats.userId, users.id))
        .where(and(eq(seasonStats.seasonId, seasonId), gt(seasonStats.gamesPlayed, 0)))
        .orderBy(desc(seasonStats.isRevealed), desc(seasonStats.rr)),
      db.select().from(users).where(eq(users.id, user.id)),
      db.select().from(seasonStats)
        .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, seasonId))),
    ])

    const stat = myStatsRows[0] ?? null

    let rankCounter = 0
    entries = leaderboardRows.map(row => {
      if (row.isRevealed) {
        rankCounter++
        return { ...row, rank: rankCounter, rankTrend: null }
      }
      return { ...row, rank: null, rankTrend: null }
    })

    // Batch 3: rr trends + my rank count — both in parallel
    const playerIds = entries.map(e => e.userId)

    const [recentChanges, rankCountResult] = await Promise.all([
      playerIds.length > 0
        ? db.select({ userId: rrChanges.userId, rrBefore: rrChanges.rrBefore })
            .from(rrChanges)
            .where(and(eq(rrChanges.seasonId, seasonId), inArray(rrChanges.userId, playerIds)))
            .orderBy(desc(rrChanges.createdAt))
        : Promise.resolve([]),
      stat?.isRevealed
        ? db.select({ value: count() })
            .from(seasonStats)
            .where(and(
              eq(seasonStats.seasonId, seasonId),
              eq(seasonStats.isRevealed, true),
              gt(seasonStats.rr, stat.rr),
            ))
        : Promise.resolve(null),
    ])

    // Apply rank trends
    const latestRrBefore = new Map<string, number>()
    for (const change of recentChanges) {
      if (!latestRrBefore.has(change.userId)) latestRrBefore.set(change.userId, change.rrBefore)
    }
    const revealedEntries = entries.filter(e => e.rank != null)
    for (const entry of entries) {
      if (entry.rank == null) continue
      const rrBefore = latestRrBefore.get(entry.userId)
      if (rrBefore == null) { entry.rankTrend = 0; continue }
      const prevRank = revealedEntries.filter(e => e.userId !== entry.userId && e.rr > rrBefore).length + 1
      entry.rankTrend = prevRank - entry.rank
    }

    // Build "me" object
    const rank = rankCountResult ? Number(rankCountResult[0].value) + 1 : null
    me = {
      id: user.id,
      name: profile?.name ?? '',
      stats: stat ? { rr: stat.rr, isRevealed: stat.isRevealed } : null,
      rank,
    }
  }

  return (
    <LeaderboardClient
      initialEntries={entries}
      initialMe={me}
      initialSeasonId={seasonId}
      initialSeasons={seasonList}
    />
  )
}
