import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import { recalculateSeasonRr } from '@/lib/recalculate-rr'

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

  const playedAt = new Date(`${playedDate}T${playedTime}:00`)
  if (Number.isNaN(playedAt.getTime())) {
    return NextResponse.json(
      { error: 'Invalid played date or time' },
      { status: 400 },
    )
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, id))
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  await db
    .update(matches)
    .set({ playedAt })
    .where(eq(matches.id, id))

  await recalculateSeasonRr(match.seasonId)

  return NextResponse.json({ ok: true })
}