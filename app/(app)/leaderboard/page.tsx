import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, desc, gt, and, count } from 'drizzle-orm'
import type { LeaderboardEntry, Season } from '@/lib/types'
import LeaderboardClient from './leaderboard-client'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
  if (seasonId) {
    const rows = await db
      .select({
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
      .orderBy(desc(seasonStats.isRevealed), desc(seasonStats.rr))

    let rankCounter = 0
    entries = rows.map(row => {
      if (row.isRevealed) {
        rankCounter++
        return { ...row, rank: rankCounter }
      }
      return { ...row, rank: null }
    })
  }

  let me = null
  if (seasonId) {
    const [profile] = await db.select().from(users).where(eq(users.id, user.id))
    const [stat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, seasonId)))

    let rank: number | null = null
    if (stat?.isRevealed) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(seasonStats)
        .where(
          and(
            eq(seasonStats.seasonId, seasonId),
            eq(seasonStats.isRevealed, true),
            gt(seasonStats.rr, stat.rr),
          ),
        )
      rank = Number(value) + 1
    }

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
