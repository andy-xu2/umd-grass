import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { tournamentPlayoffGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { canManageTournament } from '@/lib/tournament-admin'

type SetScore = {
  team1: number
  team2: number
}

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

  const allowed = await canManageTournament(user.id)

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as {
    setScores?: SetScore[]
    status?: 'pending' | 'live' | 'complete'
  }

  const setScores = body.setScores ?? []

  for (const set of setScores) {
    if (
      typeof set.team1 !== 'number' ||
      typeof set.team2 !== 'number' ||
      set.team1 < 0 ||
      set.team2 < 0 ||
      set.team1 === set.team2
    ) {
      return NextResponse.json(
        { error: 'Each set must have non-negative, non-tied scores' },
        { status: 400 },
      )
    }
  }

  const status = body.status ?? (setScores.length > 0 ? 'complete' : 'pending')

  await db
    .update(tournamentPlayoffGames)
    .set({
      status,
      setScores,
      liveScore: status === 'live' ? { team1: 0, team2: 0 } : null,
    })
    .where(eq(tournamentPlayoffGames.id, id))

  return NextResponse.json({ ok: true })
}