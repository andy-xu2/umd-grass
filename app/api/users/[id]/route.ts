// GET /api/users/[id]            — public profile for any user + active-season stats + rank
// GET /api/users/[id]?seasonId=  — same but for the specified season
// PATCH /api/users/[id]          — admin: update user's name
// DELETE /api/users/[id]         — admin: soft-delete user + revoke Supabase Auth

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasonStats, seasons, matches } from '@/drizzle/schema'
import { eq, and, gt, count, or } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [profile] = await db.select().from(users).where(eq(users.id, id))
  if (!profile || profile.isDeleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const seasonIdParam = searchParams.get('seasonId')

  let resolvedSeasonId: string | null = seasonIdParam
  if (!resolvedSeasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    resolvedSeasonId = activeSeason?.id ?? null
  }

  let stats = null
  let rank: number | null = null

  if (resolvedSeasonId) {
    const [seasonStat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, id), eq(seasonStats.seasonId, resolvedSeasonId)))

    if (seasonStat) {
      stats = seasonStat

      const [{ value }] = await db
        .select({ value: count() })
        .from(seasonStats)
        .where(
          and(
            eq(seasonStats.seasonId, resolvedSeasonId),
            gt(seasonStats.rr, seasonStat.rr),
          ),
        )
      rank = Number(value) + 1
    }
  }

  return NextResponse.json({
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    stats,
    rank,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : null
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const [updated] = await db.update(users).set({ name }).where(eq(users.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ ...updated, createdAt: updated.createdAt.toISOString() })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const [target] = await db.select().from(users).where(eq(users.id, id))
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.isDeleted) return NextResponse.json({ error: 'User already deleted' }, { status: 409 })

  // Auto-reject any pending matches involving this user so they don't linger
  await db
    .update(matches)
    .set({ status: 'REJECTED' })
    .where(
      and(
        eq(matches.status, 'PENDING'),
        or(
          eq(matches.team1Player1Id, id),
          eq(matches.team1Player2Id, id),
          eq(matches.team2Player1Id, id),
          eq(matches.team2Player2Id, id),
        ),
      ),
    )

  // Soft-delete the user row
  await db.update(users).set({ isDeleted: true }).where(eq(users.id, id))

  // Delete from Supabase Auth so they can't log in
  const adminSupabase = createAdminClient()
  await adminSupabase.auth.admin.deleteUser(id)

  return NextResponse.json({ ok: true })
}
