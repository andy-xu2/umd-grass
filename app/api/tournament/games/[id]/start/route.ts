import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [started] = await db.update(tournamentGames)
    .set({ status: 'live', liveScore: { team1: 0, team2: 0 }, scoredBy: user.id })
    .where(and(eq(tournamentGames.id, id), eq(tournamentGames.status, 'pending')))
    .returning({ id: tournamentGames.id })

  if (!started) {
    return NextResponse.json(
      { error: 'Game is not available to score' },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true })
}
