import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courts, courtQueueEntries } from '@/drizzle/schema'
import { eq, asc } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courtId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId } = await params
  const body = (await request.json()) as {
    winner?: 'team1' | 'team2'
  }

  if (body.winner !== 'team1' && body.winner !== 'team2') {
    return NextResponse.json(
      { error: 'winner must be "team1" or "team2"' },
      { status: 400 },
    )
  }

  const [court] = await db
    .select()
    .from(courts)
    .where(eq(courts.id, courtId))

  if (!court) {
    return NextResponse.json({ error: 'Court not found' }, { status: 404 })
  }

  const [nextTeam] = await db
    .select()
    .from(courtQueueEntries)
    .where(eq(courtQueueEntries.courtId, courtId))
    .orderBy(asc(courtQueueEntries.position))
    .limit(1)

  if (!nextTeam) {
    return NextResponse.json({ error: 'Queue is empty' }, { status: 400 })
  }

  if (body.winner === 'team1') {
    await db
      .update(courts)
      .set({
        team2Player1Id: nextTeam.player1Id,
        team2Player2Id: nextTeam.player2Id,
      })
      .where(eq(courts.id, courtId))
  } else {
    await db
      .update(courts)
      .set({
        team1Player1Id: nextTeam.player1Id,
        team1Player2Id: nextTeam.player2Id,
      })
      .where(eq(courts.id, courtId))
  }

  await db
    .delete(courtQueueEntries)
    .where(eq(courtQueueEntries.id, nextTeam.id))

  const remaining = await db
    .select()
    .from(courtQueueEntries)
    .where(eq(courtQueueEntries.courtId, courtId))
    .orderBy(asc(courtQueueEntries.position))

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(courtQueueEntries)
      .set({ position: i + 1 })
      .where(eq(courtQueueEntries.id, remaining[i].id))
  }

  return NextResponse.json({ ok: true })
}