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
import { matches, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { calculateRrChange } from '@/lib/elo'
import { isAdmin } from '@/lib/utils'
import type { SetScore } from '@/lib/types'

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

  await db.transaction(async tx => {
    const oldChanges = await tx
      .select()
      .from(rrChanges)
      .where(and(eq(rrChanges.matchId, id), inArray(rrChanges.userId, playerIds)))

    const oldDeltaMap = new Map(oldChanges.map(c => [c.userId, c.delta]))

    const statRows = await tx
      .select()
      .from(seasonStats)
      .where(
        and(
          eq(seasonStats.seasonId, match.seasonId),
          inArray(seasonStats.userId, playerIds),
        ),
      )

    const statsMap = new Map(statRows.map(s => [s.userId, s]))

    // Step 1: reverse old deltas to recover pre-match RR for each player
    const preMatchRr = new Map<string, number>()
    for (const pid of playerIds) {
      const stat = statsMap.get(pid)
      const oldDelta = oldDeltaMap.get(pid) ?? 0
      preMatchRr.set(pid, Math.max(0, (stat?.rr ?? 800) - oldDelta))
    }

    const newTeam1Won = newTeam1Sets > newTeam2Sets
    const totalSets = newTeam1Sets + newTeam2Sets
    const team1Total = body.setScores!.reduce((s, r) => s + r.team1, 0)
    const team2Total = body.setScores!.reduce((s, r) => s + r.team2, 0)
    const pointDiff = Math.abs(team1Total - team2Total)

    const t1p1Pre = preMatchRr.get(match.team1Player1Id)!
    const t1p2Pre = preMatchRr.get(match.team1Player2Id)!
    const t2p1Pre = preMatchRr.get(match.team2Player1Id)!
    const t2p2Pre = preMatchRr.get(match.team2Player2Id)!

    const newDeltas: Record<string, number> = {
      [match.team1Player1Id]: calculateRrChange(t1p1Pre, t2p1Pre, t2p2Pre, newTeam1Sets, totalSets, pointDiff),
      [match.team1Player2Id]: calculateRrChange(t1p2Pre, t2p1Pre, t2p2Pre, newTeam1Sets, totalSets, pointDiff),
      [match.team2Player1Id]: calculateRrChange(t2p1Pre, t1p1Pre, t1p2Pre, newTeam2Sets, totalSets, pointDiff),
      [match.team2Player2Id]: calculateRrChange(t2p2Pre, t1p1Pre, t1p2Pre, newTeam2Sets, totalSets, pointDiff),
    }

    const oldTeam1Won = match.team1Sets > match.team2Sets

    for (const pid of playerIds) {
      const stat = statsMap.get(pid)
      if (!stat) continue

      const onTeam1 = pid === match.team1Player1Id || pid === match.team1Player2Id
      const oldWon = onTeam1 ? oldTeam1Won : !oldTeam1Won
      const newWon = onTeam1 ? newTeam1Won : !newTeam1Won
      const pre = preMatchRr.get(pid)!
      const newDelta = newDeltas[pid]
      const newRr = Math.max(0, pre + newDelta)

      // Adjust wins/losses only if winner changed
      let { wins, losses } = stat
      if (oldWon && !newWon) { wins = Math.max(0, wins - 1); losses += 1 }
      else if (!oldWon && newWon) { losses = Math.max(0, losses - 1); wins += 1 }

      await tx
        .update(seasonStats)
        .set({ rr: newRr, wins, losses })
        .where(eq(seasonStats.id, stat.id))

      // Update rr_change record
      const oldChange = oldChanges.find(c => c.userId === pid)
      if (oldChange) {
        await tx
          .update(rrChanges)
          .set({ delta: newDelta, rrBefore: pre, rrAfter: newRr })
          .where(eq(rrChanges.id, oldChange.id))
      }
    }

    await tx
      .update(matches)
      .set({
        setScores: body.setScores,
        team1Sets: newTeam1Sets,
        team2Sets: newTeam2Sets,
      })
      .where(eq(matches.id, id))
  })

  return NextResponse.json({ ok: true })
}
