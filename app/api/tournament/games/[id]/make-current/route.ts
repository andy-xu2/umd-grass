import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { tournamentGames } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
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

  await db.transaction(async tx => {
    await tx
      .update(tournamentGames)
      .set({
        status: 'pending',
        liveScore: null,
      })
      .where(
        and(
          eq(tournamentGames.poolId, game.poolId),
          eq(tournamentGames.status, 'live'),
        ),
      )

    await tx
      .update(tournamentGames)
      .set({
        status: 'live',
        liveScore: game.liveScore ?? { team1: 0, team2: 0 },
      })
      .where(eq(tournamentGames.id, id))
  })

  return NextResponse.json({ ok: true })
}