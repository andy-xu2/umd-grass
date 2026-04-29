import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournamentPlayoffGames } from '@/drizzle/schema'
import { and, asc, eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')
  const division = searchParams.get('division') as 'AA' | 'BB'

  if (!tournamentId || !division) {
    return NextResponse.json({ error: 'tournamentId and division required' }, { status: 400 })
  }

  const games = await db
    .select()
    .from(tournamentPlayoffGames)
    .where(
      and(
        eq(tournamentPlayoffGames.tournamentId, tournamentId),
        eq(tournamentPlayoffGames.division, division),
      ),
    )
    .orderBy(asc(tournamentPlayoffGames.orderIndex))

  return NextResponse.json({ games })
}