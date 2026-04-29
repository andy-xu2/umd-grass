import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentPlayoffGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const score = await req.json() as { team1: number; team2: number }

  if (score.team1 === score.team2) {
    return NextResponse.json({ error: 'Score cannot be tied' }, { status: 400 })
  }

  const [game] = await db
    .select()
    .from(tournamentPlayoffGames)
    .where(eq(tournamentPlayoffGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const setScores = [...(game.setScores ?? []), score]

  await db
    .update(tournamentPlayoffGames)
    .set({
      status: 'complete',
      setScores,
      liveScore: null,
    })
    .where(eq(tournamentPlayoffGames.id, id))

  return NextResponse.json({ ok: true })
}