// PATCH /api/matches/[id]/score — admin only
// Update a confirmed match's set scores and recalculate RR for all 4 players.
// Body: { setScores: Array<{ team1: number; team2: number }> }
//
// Updates the stored point/set result, then replays the match's season so all
// order-dependent season_stats and rr_changes remain consistent.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import { recalculateSeasonRrFromTx } from '@/lib/recalculate-rr'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'
import type { SetScore } from '@/lib/types'
import { setScoresError } from '@/lib/match-input'

export async function PATCH(
  request: Request,
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
  const body = await request.json() as { setScores?: SetScore[] }
  const setsProblem = setScoresError(body.setScores)
  if (setsProblem) {
    return NextResponse.json({ error: setsProblem }, { status: 400 })
  }
  // Store only the two score fields, never extra keys from the request body.
  const cleanSets = (body.setScores as SetScore[]).map(({ team1, team2 }) => ({ team1, team2 }))
  const newTeam1Sets = cleanSets.filter(s => s.team1 > s.team2).length
  const newTeam2Sets = cleanSets.length - newTeam1Sets
  const result = await db.transaction(async tx => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, id))
    if (!match) return { error: 'Match not found', status: 404 } as const
    if (match.status !== 'CONFIRMED') {
      return { error: 'Only confirmed matches can be edited', status: 400 } as const
    }

    await tx
      .update(matches)
      .set({
        setScores: cleanSets,
        team1Sets: newTeam1Sets,
        team2Sets: newTeam2Sets,
      })
      .where(eq(matches.id, id))

    await recalculateSeasonRrFromTx(tx, match.seasonId, match)
    return { seasonId: match.seasonId } as const
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  invalidateLeaderboardCache(result.seasonId)
  return NextResponse.json({ ok: true })
}
