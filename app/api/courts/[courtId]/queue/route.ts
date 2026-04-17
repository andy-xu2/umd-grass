import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courtQueueEntries } from '@/drizzle/schema'
import { eq, desc, or } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courtId: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId } = await params
  const body = (await request.json()) as {
    player1Id?: string
    player2Id?: string
  }

  const { player1Id, player2Id } = body

  if (!player1Id || !player2Id) {
    return NextResponse.json({ error: 'Both players are required' }, { status: 400 })
  }

  if (player1Id === player2Id) {
    return NextResponse.json({ error: 'Players must be different' }, { status: 400 })
  }

  const alreadyQueued = await db
    .select({ id: courtQueueEntries.id })
    .from(courtQueueEntries)
    .where(
      or(
        eq(courtQueueEntries.player1Id, player1Id),
        eq(courtQueueEntries.player2Id, player1Id),
        eq(courtQueueEntries.player1Id, player2Id),
        eq(courtQueueEntries.player2Id, player2Id),
      ),
    )
    .limit(1)

  if (alreadyQueued.length > 0) {
    return NextResponse.json(
      { error: 'One or both players are already in a queue' },
      { status: 409 },
    )
  }

  const existing = await db
    .select({ position: courtQueueEntries.position })
    .from(courtQueueEntries)
    .where(eq(courtQueueEntries.courtId, courtId))
    .orderBy(desc(courtQueueEntries.position))
    .limit(1)

  const nextPosition = existing.length > 0 ? existing[0].position + 1 : 1

  const [created] = await db
    .insert(courtQueueEntries)
    .values({
      courtId,
      player1Id,
      player2Id,
      position: nextPosition,
    })
    .returning()

  return NextResponse.json(created)
}