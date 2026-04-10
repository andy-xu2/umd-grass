// POST /api/admin/recalculate-stats?seasonId=  — admin only
// Recomputes gamesPlayed, wins, losses for every player in the season
// from the actual confirmed matches table. Self-healing for duplicate
// season_stats rows that cause inflated game counts.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, seasonStats, seasons } from '@/drizzle/schema'
import { eq, and, or } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  let seasonId = searchParams.get('seasonId')

  if (!seasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    if (!activeSeason) return NextResponse.json({ error: 'No active season' }, { status: 400 })
    seasonId = activeSeason.id
  }

  // Count actual confirmed matches per player from the source-of-truth matches table
  const confirmedMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.status, 'CONFIRMED'), eq(matches.seasonId, seasonId)))

  const computed = new Map<string, { games: number; wins: number; losses: number }>()

  for (const m of confirmedMatches) {
    const team1Won = m.team1Sets > m.team2Sets
    const players = [
      { id: m.team1Player1Id, won: team1Won },
      { id: m.team1Player2Id, won: team1Won },
      { id: m.team2Player1Id, won: !team1Won },
      { id: m.team2Player2Id, won: !team1Won },
    ]
    for (const p of players) {
      const s = computed.get(p.id) ?? { games: 0, wins: 0, losses: 0 }
      s.games++
      if (p.won) s.wins++
      else s.losses++
      computed.set(p.id, s)
    }
  }

  // Get all season_stats rows for this season (may include duplicates)
  const allStats = await db
    .select()
    .from(seasonStats)
    .where(eq(seasonStats.seasonId, seasonId))

  // Deduplicate: keep only the row with the highest RR per user, delete the rest
  const bestRowPerUser = new Map<string, typeof allStats[number]>()
  const toDelete: string[] = []

  for (const row of allStats) {
    const existing = bestRowPerUser.get(row.userId)
    if (!existing || row.rr > existing.rr) {
      if (existing) toDelete.push(existing.id)
      bestRowPerUser.set(row.userId, row)
    } else {
      toDelete.push(row.id)
    }
  }

  await db.transaction(async tx => {
    // Delete duplicate rows
    if (toDelete.length > 0) {
      for (const dupId of toDelete) {
        await tx.delete(seasonStats).where(eq(seasonStats.id, dupId))
      }
    }

    // Update each remaining row with correct computed stats
    for (const [userId, row] of bestRowPerUser) {
      const correct = computed.get(userId) ?? { games: 0, wins: 0, losses: 0 }
      await tx
        .update(seasonStats)
        .set({
          gamesPlayed: correct.games,
          wins: correct.wins,
          losses: correct.losses,
        })
        .where(eq(seasonStats.id, row.id))
    }
  })

  return NextResponse.json({
    ok: true,
    playersFixed: bestRowPerUser.size,
    duplicatesRemoved: toDelete.length,
  })
}
