// PATCH /api/seasons/[id]/mmr
// Admin: set a player's RR directly for a specific season.
// Body: { userId: string, rr: number }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { seasonStats } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: seasonId } = await params
  const body = await request.json() as { userId?: string; rr?: number }

  if (!body.userId || typeof body.rr !== 'number' || body.rr < 0) {
    return NextResponse.json(
      { error: 'userId and rr (non-negative number) are required' },
      { status: 400 },
    )
  }

  const [existing] = await db
    .select()
    .from(seasonStats)
    .where(and(eq(seasonStats.userId, body.userId), eq(seasonStats.seasonId, seasonId)))

  if (existing) {
    const [updated] = await db
      .update(seasonStats)
      .set({ rr: body.rr })
      .where(eq(seasonStats.id, existing.id))
      .returning()
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(seasonStats)
    .values({
      userId: body.userId,
      seasonId,
      rr: body.rr,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
