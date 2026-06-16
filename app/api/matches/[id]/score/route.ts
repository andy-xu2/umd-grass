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
import { recalculateSeasonRrTx } from '@/lib/recalculate-rr'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'
import type { SetScore } from '@/lib/types'

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
  if (!Array.isArray(body.setScores) || body.setScores.length === 0) {
    return NextResponse.json({ error: 'setScores array is required' }, { status: 400 })
  }
  for (const s of body.setScores) {
    if (typeof s.team1 !== 'number' || typeof s.team2 !== 'number' || s.team1 === s.team2) {
      return NextResponse.json({ error: 'Each set must have different scores' }, { status: 400 })
    }
  }
  const newTeam1Sets = body.setScores.filter(s => s.team1 > s.team2).length
  const newTeam2Sets = body.setScores.filter(s => s.team2 > s.team1).length
  if (newTeam1Sets === newTeam2Sets) {
    return NextResponse.json({ error: 'Match cannot end in a tie' }, { status: 400 })
  }
  const result = await db.transaction(async tx => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, id))
    if (!match) return { error: 'Match not found', status: 404 } as const
    if (match.status !== 'CONFIRMED') {
      return { error: 'Only confirmed matches can be edited', status: 400 } as const
    }

    await tx
      .update(matches)
      .set({
        setScores: body.setScores,
        team1Sets: newTeam1Sets,
        team2Sets: newTeam2Sets,
      })
      .where(eq(matches.id, id))

    await recalculateSeasonRrTx(tx, match.seasonId)
    return { seasonId: match.seasonId } as const
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  invalidateLeaderboardCache(result.seasonId)
  return NextResponse.json({ ok: true })
}
