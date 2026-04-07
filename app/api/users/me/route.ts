// GET  /api/users/me  — current user's profile + active-season stats + rank
// PATCH /api/users/me  — update name and/or avatarUrl (auth required)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasonStats, seasons } from '@/drizzle/schema'
import { eq, and, gt, count } from 'drizzle-orm'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profile] = await db.select().from(users).where(eq(users.id, user.id))
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))

  let stats = null
  let rank: number | null = null

  if (activeSeason) {
    const [seasonStat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, activeSeason.id)))

    if (seasonStat) {
      stats = seasonStat

      // Rank = number of revealed players with a higher rr + 1
      const [{ value }] = await db
        .select({ value: count() })
        .from(seasonStats)
        .where(
          and(
            eq(seasonStats.seasonId, activeSeason.id),
            eq(seasonStats.isRevealed, true),
            gt(seasonStats.rr, seasonStat.rr)
          )
        )
      rank = Number(value) + 1
    }
  }

  return NextResponse.json({ ...profile, stats, rank })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Partial<{ name: string; avatarUrl: string | null }> = {}
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
  if ('avatarUrl' in body) updates.avatarUrl = body.avatarUrl

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning()

  return NextResponse.json(updated)
}
