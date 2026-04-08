// GET  /api/users/me            — current user's profile + active-season stats + rank
// GET  /api/users/me?seasonId=  — same but for the specified season
// PATCH /api/users/me           — update avatarUrl and/or email (auth required)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { users, seasonStats, seasons } from '@/drizzle/schema'
import { eq, and, gt, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profile] = await db.select().from(users).where(eq(users.id, user.id))
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
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
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, resolvedSeasonId)))

    if (seasonStat) {
      stats = seasonStat

      if (seasonStat.isRevealed) {
        const [{ value }] = await db
          .select({ value: count() })
          .from(seasonStats)
          .where(
            and(
              eq(seasonStats.seasonId, resolvedSeasonId),
              eq(seasonStats.isRevealed, true),
              gt(seasonStats.rr, seasonStat.rr),
            ),
          )
        rank = Number(value) + 1
      }
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Email change — admin API bypasses Supabase's "already registered" guard
  // (which fires on ghost/unconfirmed users) and updates immediately
  if (typeof body.email === 'string' && body.email.trim()) {
    const newEmail = body.email.trim()
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    })
    if (authError) {
      console.error('[email update] Supabase admin error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    // Keep the public users table in sync
    await db.update(users).set({ email: newEmail }).where(eq(users.id, user.id))
    return NextResponse.json({ ok: true })
  }

  // Password change — verify old password first, then update
  if (typeof body.newPassword === 'string') {
    if (typeof body.oldPassword !== 'string' || !body.oldPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }

    // Verify old password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: body.oldPassword,
    })
    if (signInError) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: body.newPassword,
    })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  const updates: Partial<{ avatarUrl: string | null }> = {}
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
