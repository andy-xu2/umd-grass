import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import { eq, and, ne, desc, asc, inArray } from 'drizzle-orm'
import {
  calculateRrChange,
  applySeasonDecay,
  K,
  PLACEMENT_GAMES,
  PLACEMENT_RR_CAP,
  LIFETIME_PLACEMENT_MULTIPLIER,
  SEASONAL_PLACEMENT_MULTIPLIER,
} from '@/lib/elo'
import { isAdmin } from '@/lib/utils'
import { recalculateSeasonRr } from '@/lib/recalculate-rr'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  let seasonId = searchParams.get('seasonId')

  if (!seasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    seasonId = activeSeason?.id ?? null
  }

  if (!seasonId) {
    return NextResponse.json({ error: 'No season found' }, { status: 400 })
  }

  await recalculateSeasonRr(seasonId)
  return NextResponse.json({ ok: true })
}