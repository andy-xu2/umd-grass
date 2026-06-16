import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import { recalculateSeasonRrFromTx } from '@/lib/recalculate-rr'
import { earliestRrReplayBoundary } from '@/lib/rr-replay-order'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'
import { fromZonedTime } from 'date-fns-tz'

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

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = (await request.json()) as {
    playedDate?: string
    playedTime?: string
  }

  const { playedDate, playedTime } = body

  if (!playedDate || !playedTime) {
    return NextResponse.json(
      { error: 'Played date and time are required' },
      { status: 400 },
    )
  }

  const playedAt = fromZonedTime(
    `${playedDate} ${playedTime}:00`,
    'America/New_York',
  )

  if (Number.isNaN(playedAt.getTime())) {
    return NextResponse.json(
      { error: 'Invalid played date or time' },
      { status: 400 },
    )
  }

  const result = await db.transaction(async tx => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, id))
    if (!match) return { error: 'Match not found', status: 404 } as const

    const replayBoundary = earliestRrReplayBoundary(match, {
      id: match.id,
      playedAt,
      submittedAt: match.submittedAt,
    })

    await tx
      .update(matches)
      .set({ playedAt })
      .where(eq(matches.id, id))

    await recalculateSeasonRrFromTx(tx, match.seasonId, replayBoundary)
    return { seasonId: match.seasonId } as const
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  invalidateLeaderboardCache(result.seasonId)

  return NextResponse.json({ ok: true })
}
