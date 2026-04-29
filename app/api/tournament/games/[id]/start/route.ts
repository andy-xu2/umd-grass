import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await db.update(tournamentGames)
    .set({ status: 'live', liveScore: { team1: 0, team2: 0 }, scoredBy: user.id })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}