// GET /api/leaderboard — season_stats joined with users, sorted by RR
// Query params:
//   ?seasonId=<uuid>  — defaults to the active season

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
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

  // Revealed players first (true sorts after false in pg, so DESC), then by RR desc
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
    .where(eq(seasonStats.seasonId, seasonId))
    .orderBy(desc(seasonStats.isRevealed), desc(seasonStats.rr))

  // Assign sequential ranks only to revealed players (they come first in the sorted list)
  let rankCounter = 0
  const entries: LeaderboardEntry[] = rows.map(row => {
    if (row.isRevealed) {
      rankCounter++
      return { ...row, rank: rankCounter }
    }
    return { ...row, rank: null }
  })

  return NextResponse.json({ entries, seasonId } satisfies LeaderboardResponse)
}
