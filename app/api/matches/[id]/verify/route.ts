// PATCH /api/matches/[id]/verify
// Body: { action: 'confirm' | 'reject' }
//
// Only a player from the opposing team (team2) may call this.
// On confirm: ELO is calculated for all 4 players, season_stats updated,
//             rr_changes inserted.
// On reject:  match status set to REJECTED.

import { NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import { recalculateSeasonRr } from '@/lib/recalculate-rr'
import { applyConfirmedMatchIncremental } from '@/lib/apply-confirmed-match'
import { isMostRecentConfirmedMatch } from '@/lib/is-most-recent-match'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as { action?: string }
  const { action } = body

  if (action !== 'confirm' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "confirm" or "reject"' },
      { status: 400 },
    )
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, id))
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  const admin = isAdmin(user.id)

  if (
    !admin &&
    match.team2Player1Id !== user.id &&
    match.team2Player2Id !== user.id
  ) {
    return NextResponse.json(
      { error: 'Only the opposing team can verify this match' },
      { status: 403 },
    )
  }

  if (match.status !== 'PENDING') {
    return NextResponse.json({ error: 'Match is not pending' }, { status: 400 })
  }

  if (action === 'reject') {
    await db
      .update(matches)
      .set({ status: 'REJECTED' })
      .where(eq(matches.id, id))

    return NextResponse.json({ ok: true })
  }

  const now = new Date()

  const [claimed] = await db
    .update(matches)
    .set({
      status: 'CONFIRMED',
      verifiedBy: user.id,
      verifiedAt: now,
    })
    .where(and(eq(matches.id, id), eq(matches.status, 'PENDING')))
    .returning({
      id: matches.id,
      seasonId: matches.seasonId,
    })

  if (!claimed) {
    return NextResponse.json({ error: 'Match was already processed' }, { status: 409 })
  }

  const isNewest = await isMostRecentConfirmedMatch(claimed.id)

  after(async () => {
    if (isNewest) {
      await applyConfirmedMatchIncremental(claimed.id)
    } else {
      await recalculateSeasonRr(claimed.seasonId)
    }
    revalidateTag(`leaderboard-${claimed.seasonId}`, 'minutes')
    revalidateTag('leaderboard-lifetime', 'minutes')
  })

  return NextResponse.json({ ok: true })
}