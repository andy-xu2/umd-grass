import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [game] = await db
    .select()
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (game.status !== 'live') {
    return NextResponse.json({ error: 'Game is not live' }, { status: 400 })
  }

  await db
    .update(tournamentGames)
    .set({
      status: 'pending',
      liveScore: null,
      scoredBy: null,
    })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}