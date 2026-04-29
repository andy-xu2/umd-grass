import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [game] = await db
    .select()
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (game.status === 'complete') {
    return NextResponse.json({ error: 'Game already complete' }, { status: 400 })
  }

  await db
    .update(tournamentGames)
    .set({
      status: 'live',
      liveScore: { team1: 0, team2: 0 },
    })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}