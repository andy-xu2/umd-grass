import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courtQueueEntries } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courtId: string; entryId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId, entryId } = await params
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

  await db
    .update(courtQueueEntries)
    .set({
      player1Id,
      player2Id,
    })
    .where(
      and(
        eq(courtQueueEntries.courtId, courtId),
        eq(courtQueueEntries.id, entryId),
      ),
    )

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courtId: string; entryId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId, entryId } = await params

  await db
    .delete(courtQueueEntries)
    .where(
      and(
        eq(courtQueueEntries.courtId, courtId),
        eq(courtQueueEntries.id, entryId),
      ),
    )

  return NextResponse.json({ ok: true })
}