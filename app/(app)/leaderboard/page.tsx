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
        return { ...row, rank: rankCounter, rankTrend: null }
      }
      return { ...row, rank: null, rankTrend: null }
    })

    // Calculate rank trends from most recent rr_changes
    const playerIds = entries.map(e => e.userId)
    if (playerIds.length > 0) {
      const recentChanges = await db
        .select({ userId: rrChanges.userId, rrBefore: rrChanges.rrBefore, createdAt: rrChanges.createdAt })
        .from(rrChanges)
        .where(and(eq(rrChanges.seasonId, seasonId), inArray(rrChanges.userId, playerIds)))
        .orderBy(desc(rrChanges.createdAt))

      // Keep only the most recent change per player
      const latestRrBefore = new Map<string, number>()
      for (const change of recentChanges) {
        if (!latestRrBefore.has(change.userId)) {
          latestRrBefore.set(change.userId, change.rrBefore)
        }
      }

      const revealedEntries = entries.filter(e => e.rank != null)
      for (const entry of entries) {
        if (entry.rank == null) continue
        const rrBefore = latestRrBefore.get(entry.userId)
        if (rrBefore == null) { entry.rankTrend = 0; continue }
        // How many revealed peers (excluding this player) had higher RR than rrBefore?
        const prevRank = revealedEntries.filter(e => e.userId !== entry.userId && e.rr > rrBefore).length + 1
        entry.rankTrend = prevRank - entry.rank // positive = moved up
      }
    }
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
