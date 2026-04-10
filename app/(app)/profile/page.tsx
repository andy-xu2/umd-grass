import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, and, gt, count, desc, gte } from 'drizzle-orm'
import { PLACEMENT_GAMES } from '@/lib/elo'
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

  // Deduplicate by seasonId — take the row with the most games played per season
  // (guards against duplicate season_stats rows)
  const seasonBest = new Map<string, typeof allTimeRows[number]>()
  for (const row of allTimeRows) {
    const cur = seasonBest.get(row.seasonId)
    if (!cur || row.gamesPlayed > cur.gamesPlayed) seasonBest.set(row.seasonId, row)
  }
  const dedupedRows = Array.from(seasonBest.values())

  const allTime: AllTimeStats = {
    totalGames: dedupedRows.reduce((s, r) => s + r.gamesPlayed, 0),
    totalWins: dedupedRows.reduce((s, r) => s + r.wins, 0),
    totalLosses: dedupedRows.reduce((s, r) => s + r.losses, 0),
    peakRR: dedupedRows.reduce((max, r) => Math.max(max, r.rr), 0),
    seasonsPlayed: dedupedRows.filter(r => r.gamesPlayed > 0).length,
  }

  const seasonId = allSeasons.find(s => s.isActive)?.id ?? null

  let stats = null
  let rank: number | null = null

  if (seasonId) {
    // Take the row with the most games played (guards against duplicate rows)
    const [stat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, seasonId)))
      .orderBy(desc(seasonStats.gamesPlayed))

    if (stat) {
      stats = {
        rr: stat.rr,
        gamesPlayed: stat.gamesPlayed,
        wins: stat.wins,
        losses: stat.losses,
      }

      // Only ranked players (≥ PLACEMENT_GAMES) get a rank number
      if (stat.gamesPlayed >= PLACEMENT_GAMES) {
        const [{ value }] = await db
          .select({ value: count() })
          .from(seasonStats)
          .where(
            and(
              eq(seasonStats.seasonId, seasonId),
              gt(seasonStats.rr, stat.rr),
              gte(seasonStats.gamesPlayed, PLACEMENT_GAMES),
            ),
          )
        rank = Number(value) + 1
      }
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
