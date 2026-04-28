// PATCH /api/matches/[id]/score — admin only
// Update a confirmed match's set scores and recalculate RR for all 4 players.
// Body: { setScores: Array<{ team1: number; team2: number }> }
//
// Flow:
//  1. Reverse old RR deltas for all 4 players
//  2. Recalculate ELO using the reversed (pre-match) RR values
//  3. Apply new deltas and update rr_changes rows

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import type { SetScore } from '@/lib/types'
import { recalculateSeasonRr } from '@/lib/recalculate-rr'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      return NextResponse.json({ error: 'Each set must have different non-equal scores' }, { status: 400 })
    }
  }

  const newTeam1Sets = body.setScores.filter(s => s.team1 > s.team2).length
  const newTeam2Sets = body.setScores.filter(s => s.team2 > s.team1).length
  if (newTeam1Sets === newTeam2Sets) {
    return NextResponse.json({ error: 'Match cannot end in a tie' }, { status: 400 })
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, id))
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  if (match.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Only confirmed matches can have their score edited' }, { status: 400 })
  }

  const playerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
  ]

  await db
    .update(matches)
    .set({
      setScores: body.setScores,
      team1Sets: newTeam1Sets,
      team2Sets: newTeam2Sets,
    })
    .where(eq(matches.id, id))

  // 🔥 THIS IS THE KEY FIX
  await recalculateSeasonRr(match.seasonId)

  return NextResponse.json({ ok: true })
}
