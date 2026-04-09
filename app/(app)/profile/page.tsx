import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, and, gt, count, desc } from 'drizzle-orm'
import type { Season, AllTimeStats } from '@/lib/types'
import ProfileClient from './profile-client'

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Batch 1: profile + all seasons + all-time stats — parallel
  const [[profile], allSeasons, allTimeRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)),
    db.select().from(seasons).orderBy(desc(seasons.startedAt)),
    db.select().from(seasonStats).where(eq(seasonStats.userId, user.id)),
  ])
  if (!profile) redirect('/login')

  const seasonList: Season[] = allSeasons.map(s => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  const allTime: AllTimeStats = {
    totalGames: allTimeRows.reduce((s, r) => s + r.gamesPlayed, 0),
    totalWins: allTimeRows.reduce((s, r) => s + r.wins, 0),
    totalLosses: allTimeRows.reduce((s, r) => s + r.losses, 0),
    peakRR: allTimeRows.reduce((max, r) => Math.max(max, r.rr), 0),
    seasonsPlayed: allTimeRows.filter(r => r.gamesPlayed > 0).length,
  }

  const seasonId = allSeasons.find(s => s.isActive)?.id ?? null

  let stats = null
  let rank: number | null = null

  if (seasonId) {
    const [stat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, seasonId)))

    if (stat) {
      stats = {
        rr: stat.rr,
        gamesPlayed: stat.gamesPlayed,
        wins: stat.wins,
        losses: stat.losses,
      }

      const [{ value }] = await db
        .select({ value: count() })
        .from(seasonStats)
        .where(
          and(
            eq(seasonStats.seasonId, seasonId),
            gt(seasonStats.rr, stat.rr),
          ),
        )
      rank = Number(value) + 1
    }
  }

  return (
    <ProfileClient
      initialProfile={{
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        stats,
        rank,
      }}
      initialSeasonId={seasonId}
      initialSeasons={seasonList}
      initialAllTime={allTime}
    />
  )
}
