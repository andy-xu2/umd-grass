import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, desc, gt, gte, and, count } from 'drizzle-orm'
import { Loader2 } from 'lucide-react'
import type { Season, LeaderboardEntry } from '@/lib/types'
import { fetchCachedLeaderboardRows } from '@/lib/leaderboard'
import LeaderboardClient from './leaderboard-client'

async function LeaderboardData({ userId }: { userId: string }) {
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
    const [profile] = await db.select().from(users).where(eq(users.id, userId))
    const [stat] = await db.select().from(seasonStats)
      .where(and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, seasonId)))

    entries = await fetchCachedLeaderboardRows(seasonId)

    const rankCountResult = stat && stat.gamesPlayed >= 5
      ? await db.select({ value: count() })
          .from(seasonStats)
          .where(and(
            eq(seasonStats.seasonId, seasonId),
            gte(seasonStats.gamesPlayed, 5),
            gt(seasonStats.rr, stat.rr),
          ))
      : null

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
