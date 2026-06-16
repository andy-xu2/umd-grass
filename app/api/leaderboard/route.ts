// GET /api/leaderboard — season_stats joined with users, sorted by RR desc
// Query params:
//   ?seasonId=<uuid>  — defaults to the active season

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { seasons } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import type { LeaderboardResponse } from '@/lib/types'
import {
  fetchCachedLeaderboardRows,
  fetchCachedLifetimeLeaderboardRows,
  fetchLeaderboardMe,
} from '@/lib/leaderboard'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const seasonIdParam = searchParams.get('seasonId')

  if (seasonIdParam === 'lifetime') {
    const entries = await fetchCachedLifetimeLeaderboardRows()
    return NextResponse.json({ entries, seasonId: 'lifetime', me: null } satisfies LeaderboardResponse)
  }

  let seasonId = seasonIdParam
  if (!seasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    if (!activeSeason) {
      return NextResponse.json({ entries: [], seasonId: null, me: null } satisfies LeaderboardResponse)
    }
    seasonId = activeSeason.id
  }

  const entries = await fetchCachedLeaderboardRows(seasonId)
  const me = await fetchLeaderboardMe(user.id, seasonId, entries)

  return NextResponse.json({ entries, seasonId, me } satisfies LeaderboardResponse)
}
