import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentPlayoffGames } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  await db
    .update(tournamentPlayoffGames)
    .set({
      status: 'pending',
      liveScore: null,
    })
    .where(eq(tournamentPlayoffGames.id, id))

  return NextResponse.json({ ok: true })
}