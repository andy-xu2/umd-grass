// GET /api/leaderboard — season_stats joined with users, sorted by RR desc
// Query params:
//   ?seasonId=<uuid>  — defaults to the active season

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, desc, gte, and, inArray } from 'drizzle-orm'
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const seasonIdParam = searchParams.get('seasonId')

  let seasonId = seasonIdParam
  if (!seasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    if (!activeSeason) {
      return NextResponse.json({ entries: [], seasonId: null } satisfies LeaderboardResponse)
    }
    seasonId = activeSeason.id
  }

  const rows = await db
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
    .where(and(eq(seasonStats.seasonId, seasonId), gte(seasonStats.gamesPlayed, 5)))
    .orderBy(desc(seasonStats.rr))

  let rankCounter = 0
  const entries: LeaderboardEntry[] = rows.map(row => ({
    ...row,
    rank: ++rankCounter,
    rankTrend: null,
  }))

  // Calculate rank trends from most recent rr_changes
  const playerIds = entries.map(e => e.userId)
  if (playerIds.length > 0) {
    const recentChanges = await db
      .select({ userId: rrChanges.userId, rrBefore: rrChanges.rrBefore })
      .from(rrChanges)
      .where(and(eq(rrChanges.seasonId, seasonId), inArray(rrChanges.userId, playerIds)))
      .orderBy(desc(rrChanges.createdAt))

    const latestRrBefore = new Map<string, number>()
    for (const change of recentChanges) {
      if (!latestRrBefore.has(change.userId)) {
        latestRrBefore.set(change.userId, change.rrBefore)
      }
    }

    for (const entry of entries) {
      const rrBefore = latestRrBefore.get(entry.userId)
      if (rrBefore == null) { entry.rankTrend = 0; continue }
      const prevRank = entries.filter(e => e.userId !== entry.userId && e.rr > rrBefore).length + 1
      entry.rankTrend = prevRank - entry.rank
    }
  }

  return NextResponse.json({ entries, seasonId } satisfies LeaderboardResponse)
}
