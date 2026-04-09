// GET /api/users/me/alltime
// Returns lifetime stats for the current user aggregated across all seasons.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { seasonStats } from '@/drizzle/schema'
import { eq, gt } from 'drizzle-orm'
import type { AllTimeStats } from '@/lib/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select()
    .from(seasonStats)
    .where(eq(seasonStats.userId, user.id))

  const totalGames = rows.reduce((s, r) => s + r.gamesPlayed, 0)
  const totalWins = rows.reduce((s, r) => s + r.wins, 0)
  const totalLosses = rows.reduce((s, r) => s + r.losses, 0)
  const peakRR = rows.reduce((max, r) => Math.max(max, r.rr), 0)
  const seasonsPlayed = rows.filter(r => r.gamesPlayed > 0).length

  const result: AllTimeStats = {
    totalGames,
    totalWins,
    totalLosses,
    peakRR,
    seasonsPlayed,
  }

  return NextResponse.json(result)
}
