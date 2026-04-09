import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, desc, gt, gte, and, count, inArray, sql } from 'drizzle-orm'
import { Loader2 } from 'lucide-react'
import type { LeaderboardEntry, Season } from '@/lib/types'
import LeaderboardClient from './leaderboard-client'

async function LeaderboardData({ userId }: { userId: string }) {
  // Batch 1: all seasons (need seasonId)
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.startedAt))
  const seasonList: Season[] = allSeasons.map(s => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  const seasonId = allSeasons.find(s => s.isActive)?.id ?? null

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
      })
        .from(seasonStats)
        .innerJoin(users, eq(seasonStats.userId, users.id))
        .where(and(eq(seasonStats.seasonId, seasonId), gte(seasonStats.gamesPlayed, 5)))
        .orderBy(desc(seasonStats.rr)),
      db.select().from(users).where(eq(users.id, userId)),
      db.select().from(seasonStats)
        .where(and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, seasonId))),
    ])

    const stat = myStatsRows[0] ?? null

    let rankCounter = 0
    entries = leaderboardRows.map(row => ({
      ...row,
      rank: ++rankCounter,
      rankTrend: null,
    }))

    // Batch 3: rr trends + my rank count — both in parallel
    const playerIds = entries.map(e => e.userId)

    const [recentChanges, rankCountResult] = await Promise.all([
      playerIds.length > 0
        ? db.select({ userId: rrChanges.userId, rrBefore: rrChanges.rrBefore })
            .from(rrChanges)
            .where(and(eq(rrChanges.seasonId, seasonId), inArray(rrChanges.userId, playerIds)))
            .orderBy(desc(rrChanges.createdAt))
        : Promise.resolve([]),
      stat && stat.gamesPlayed >= 5
        ? db.select({ value: count() })
            .from(seasonStats)
            .where(and(
              eq(seasonStats.seasonId, seasonId),
              gte(seasonStats.gamesPlayed, 5),
              gt(seasonStats.rr, stat.rr),
            ))
        : Promise.resolve(null),
    ])

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

    const rank = rankCountResult ? Number(rankCountResult[0].value) + 1 : null
    me = {
      id: userId,
      name: profile?.name ?? '',
      stats: stat ? { rr: stat.rr, gamesPlayed: stat.gamesPlayed } : null,
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

function LeaderboardFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default async function LeaderboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <Suspense fallback={<LeaderboardFallback />}>
      <LeaderboardData userId={user.id} />
    </Suspense>
  )
}
