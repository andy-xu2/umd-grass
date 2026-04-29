import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  tournamentPools,
  tournamentTeams,
  tournamentGames,
} from '@/drizzle/schema'
import { eq, asc, and, inArray } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const division = searchParams.get('division') as 'AA' | 'BB'
  const tournamentId = searchParams.get('tournamentId')

  if (!division || !tournamentId) {
    return NextResponse.json(
      { error: 'division and tournamentId required' },
      { status: 400 }
    )
  }

  // ✅ FIXED
  const pools = await db
    .select()
    .from(tournamentPools)
    .where(
      and(
        eq(tournamentPools.tournamentId, tournamentId),
        eq(tournamentPools.division, division)
      )
    )

  const poolIds = pools.map(p => p.id)

  const [teams, games] = await Promise.all([
    db
      .select()
      .from(tournamentTeams)
      .where(inArray(tournamentTeams.poolId, poolIds)),

    db
      .select()
      .from(tournamentGames)
      .where(inArray(tournamentGames.poolId, poolIds))
      .orderBy(asc(tournamentGames.orderIndex)),
  ])

  return NextResponse.json({ pools, teams, games })
}