import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, desc, gt, and, count, inArray, sql } from 'drizzle-orm'
import { Skeleton } from '@/components/ui/skeleton'
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
        .where(and(eq(seasonStats.seasonId, seasonId), gt(seasonStats.gamesPlayed, 0)))
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
      stat
        ? db.select({ value: count() })
            .from(seasonStats)
            .where(and(
              eq(seasonStats.seasonId, seasonId),
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
      stats: stat ? { rr: stat.rr } : null,
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Top ranked grass volleyball players</p>
        </div>
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
        ))}
      </div>
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
