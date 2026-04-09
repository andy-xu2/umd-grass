// GET  /api/seasons — list all seasons, newest first (auth required)
// POST /api/seasons — create a new active season (admin only)
//
// Season creation:
//  1. Deactivate the current active season (set isActive=false, endedAt=now)
//  2. Collect every player's rr from the old season
//  3. Decay: newHiddenMmr = round(800 + 0.8 * (prevRR - 800))
//  4. Create the new season (isActive=true)
//  5. Pre-seed season_stats rows with decayed hiddenMmr (rr starts at 800, hidden until 5 games)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import type { Season } from '@/lib/types'
import { isAdmin } from '@/lib/utils'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.startedAt))

  const result: Season[] = rows.map(s => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { name?: string }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Season name is required' }, { status: 400 })
  }

  const now = new Date()
  let newSeasonId: string | null = null

  await db.transaction(async tx => {
    // Deactivate the current active season
    const [activeSeason] = await tx
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true))

    let prevStats: Array<{ userId: string; rr: number }> = []

    if (activeSeason) {
      await tx
        .update(seasons)
        .set({ isActive: false, endedAt: now })
        .where(eq(seasons.id, activeSeason.id))

      prevStats = await tx
        .select({ userId: seasonStats.userId, rr: seasonStats.rr })
        .from(seasonStats)
        .where(eq(seasonStats.seasonId, activeSeason.id))
    }

    // Create the new active season
    const [newSeason] = await tx
      .insert(seasons)
      .values({ name: body.name!.trim(), isActive: true, startedAt: now })
      .returning()

    newSeasonId = newSeason.id

    if (prevStats.length > 0) {
      // Seed stats with decayed hiddenMmr for players from last season
      await tx.insert(seasonStats).values(
        prevStats.map(s => ({
          userId: s.userId,
          seasonId: newSeason.id,
          rr: 800,
          hiddenMmr: Math.max(0, Math.round(800 + 0.8 * (s.rr - 800))),
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          isRevealed: false,
        })),
      )
    } else {
      // First season ever — seed all existing users at 800
      const allUsers = await tx.select({ id: users.id }).from(users)
      if (allUsers.length > 0) {
        await tx.insert(seasonStats).values(
          allUsers.map(u => ({
            userId: u.id,
            seasonId: newSeason.id,
            rr: 800,
            hiddenMmr: 800,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            isRevealed: false,
          })),
        )
      }
    }
  })

  const [created] = await db.select().from(seasons).where(eq(seasons.id, newSeasonId!))
  const result: Season = {
    id: created.id,
    name: created.name,
    isActive: created.isActive,
    startedAt: created.startedAt.toISOString(),
    endedAt: created.endedAt?.toISOString() ?? null,
  }

  return NextResponse.json(result, { status: 201 })
}
