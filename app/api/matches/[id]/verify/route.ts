// PATCH /api/matches/[id]/verify
// Body: { action: 'confirm' | 'reject' }
//
// Only a player from the opposing team (team2) may call this.
// On confirm: ELO is calculated for all 4 players, season_stats updated,
//             rr_changes inserted, and isRevealed flipped after 5 games.
// On reject:  match status set to REJECTED.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { calculateRrChange } from '@/lib/elo'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await request.json() as { action?: string }
  const { action } = body

  if (action !== 'confirm' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "confirm" or "reject"' }, { status: 400 })
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, id))
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Only opposing team (team2) can verify
  if (match.team2Player1Id !== user.id && match.team2Player2Id !== user.id) {
    return NextResponse.json(
      { error: 'Only the opposing team can verify this match' },
      { status: 403 },
    )
  }

  if (match.status !== 'PENDING') {
    return NextResponse.json({ error: 'Match is not pending' }, { status: 400 })
  }

  if (action === 'reject') {
    await db.update(matches).set({ status: 'REJECTED' }).where(eq(matches.id, id))
    return NextResponse.json({ ok: true })
  }

  // ── confirm ──────────────────────────────────────────────────────────────

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 400 })
  }

  const playerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id,
  ] as const

  await db.transaction(async tx => {
    // Get or create season_stats for each player
    async function getOrCreate(userId: string) {
      const [existing] = await tx
        .select()
        .from(seasonStats)
        .where(
          and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, activeSeason.id)),
        )
      if (existing) return existing

      const [created] = await tx
        .insert(seasonStats)
        .values({
          userId,
          seasonId: activeSeason.id,
          rr: 800,
          hiddenMmr: 800,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          isRevealed: false,
        })
        .returning()
      return created
    }

    const [t1p1Stats, t1p2Stats, t2p1Stats, t2p2Stats] = await Promise.all(
      playerIds.map(getOrCreate),
    )

    const team1Won = match.team1Sets > match.team2Sets
    const setMargin = Math.abs(match.team1Sets - match.team2Sets)

    const t1p1Delta = calculateRrChange(t1p1Stats.rr, t2p1Stats.rr, t2p2Stats.rr, team1Won, setMargin)
    const t1p2Delta = calculateRrChange(t1p2Stats.rr, t2p1Stats.rr, t2p2Stats.rr, team1Won, setMargin)
    const t2p1Delta = calculateRrChange(t2p1Stats.rr, t1p1Stats.rr, t1p2Stats.rr, !team1Won, setMargin)
    const t2p2Delta = calculateRrChange(t2p2Stats.rr, t1p1Stats.rr, t1p2Stats.rr, !team1Won, setMargin)

    const now = new Date()

    // Update match
    await tx
      .update(matches)
      .set({ status: 'CONFIRMED', verifiedBy: user.id, verifiedAt: now })
      .where(eq(matches.id, id))

    // Apply stats + record rr_changes for each player
    const updates: Array<{ stats: typeof t1p1Stats; delta: number; won: boolean }> = [
      { stats: t1p1Stats, delta: t1p1Delta, won: team1Won },
      { stats: t1p2Stats, delta: t1p2Delta, won: team1Won },
      { stats: t2p1Stats, delta: t2p1Delta, won: !team1Won },
      { stats: t2p2Stats, delta: t2p2Delta, won: !team1Won },
    ]

    for (const { stats, delta, won } of updates) {
      const newRr = Math.max(0, stats.rr + delta)
      const newGames = stats.gamesPlayed + 1

      await tx
        .update(seasonStats)
        .set({
          rr: newRr,
          hiddenMmr: newRr,
          gamesPlayed: newGames,
          wins: won ? stats.wins + 1 : stats.wins,
          losses: won ? stats.losses : stats.losses + 1,
          isRevealed: stats.isRevealed || newGames >= 5,
        })
        .where(eq(seasonStats.id, stats.id))

      await tx.insert(rrChanges).values({
        matchId: id,
        userId: stats.userId,
        seasonId: activeSeason.id,
        delta,
        rrBefore: stats.rr,
        rrAfter: newRr,
      })
    }
  })

  return NextResponse.json({ ok: true })
}
