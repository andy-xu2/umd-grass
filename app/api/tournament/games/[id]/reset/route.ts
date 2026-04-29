import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const [game] = await db
    .select()
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id))

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  await db
    .update(tournamentGames)
    .set({
      status: 'pending',
      setScores: [],
      liveScore: null,
      scoredBy: null,
    })
    .where(eq(tournamentGames.id, id))

  return NextResponse.json({ ok: true })
}