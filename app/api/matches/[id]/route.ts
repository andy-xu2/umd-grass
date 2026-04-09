// DELETE /api/matches/[id] — admin only
// Deletes a CONFIRMED match and reverses all RR changes for the 4 players.
// Also decrements gamesPlayed and the appropriate win/loss counter.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const [match] = await db.select().from(matches).where(eq(matches.id, id))
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  if (match.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: 'Only confirmed matches can be deleted' },
      { status: 400 },
    )
  }

  const playerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
  ]

  const team1Won = match.team1Sets > match.team2Sets

  await db.transaction(async tx => {
    const changes = await tx
      .select()
      .from(rrChanges)
      .where(and(eq(rrChanges.matchId, id), inArray(rrChanges.userId, playerIds)))

    // Use rrBefore (exact pre-match value) rather than stat.rr - delta.
    // stat.rr - delta is wrong when the player's RR was floored at 0 on confirmation.
    const preRrMap = new Map(changes.map(c => [c.userId, c.rrBefore]))

    const stats = await tx
      .select()
      .from(seasonStats)
      .where(
        and(
          eq(seasonStats.seasonId, match.seasonId),
          inArray(seasonStats.userId, playerIds),
        ),
      )

    for (const stat of stats) {
      const onTeam1 = stat.userId === match.team1Player1Id || stat.userId === match.team1Player2Id
      const won = onTeam1 ? team1Won : !team1Won
      const restoredRr = preRrMap.get(stat.userId) ?? stat.rr

      await tx
        .update(seasonStats)
        .set({
          rr: restoredRr,
          gamesPlayed: Math.max(0, stat.gamesPlayed - 1),
          wins: won ? Math.max(0, stat.wins - 1) : stat.wins,
          losses: won ? stat.losses : Math.max(0, stat.losses - 1),
        })
        .where(eq(seasonStats.id, stat.id))
    }

    await tx.delete(rrChanges).where(eq(rrChanges.matchId, id))
    await tx.delete(matches).where(eq(matches.id, id))
  })

  return NextResponse.json({ ok: true })
}
