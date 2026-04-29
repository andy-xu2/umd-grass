import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { team1, team2 } = await req.json() as {
    team1: number
    team2: number
  }

  if (team1 === team2) {
    return NextResponse.json(
      { error: 'Set cannot end in tie' },
      { status: 400 }
    )
  }

  const [game] = await db
    .select()
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updatedSets = [...(game.setScores ?? []), { team1, team2 }]

  await db
    .update(tournamentGames)
    .set({
      status: 'complete',
      setScores: updatedSets,
      liveScore: null,
    })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}