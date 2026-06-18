import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentPlayoffGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const liveScore = await req.json() as { team1: number; team2: number }

  await db
    .update(tournamentPlayoffGames)
    .set({ liveScore })
    .where(eq(tournamentPlayoffGames.id, id))

  return NextResponse.json({ ok: true })
}
