import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(
  req: Request,
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
  const { setScores, status } = await req.json()

  const [game] = await db
    .select()
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const isScorer = game.scoredBy === user.id

  

  await db
    .update(tournamentGames)
    .set({
      setScores,
      status,
      liveScore: { team1: 0, team2: 0 },
    })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}