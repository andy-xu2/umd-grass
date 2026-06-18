import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase-server'
import { canManageTournament } from '@/lib/tournament-admin'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const liveScore = await req.json() as { team1: number; team2: number }

  const [game] = await db
    .select()
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (game.status !== 'live') {
    return NextResponse.json(
      { error: 'Game is not live' },
      { status: 400 }
    )
  }

  const canEdit = game.scoredBy === user.id || await canManageTournament(user.id)
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db
    .update(tournamentGames)
    .set({ liveScore })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}
