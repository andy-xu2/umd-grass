// PATCH /api/matches/[id]/verify
// Body: { action: 'confirm' | 'reject' }
//
// Only a player from the opposing team (team2) may call this.
// On confirm: ELO is calculated for all 4 players, season_stats updated,
//             rr_changes inserted.
// On reject:  match status set to REJECTED.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import {
  calculateRrChange,
  PLACEMENT_GAMES,
  PLACEMENT_WIN_K,
  PLACEMENT_LOSS_K,
  PLACEMENT_RR_CAP,
} from '@/lib/elo'

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
    // Determine if this is the very first season (no ended seasons yet).
    // First-season: everyone starts at 0 RR.
    // Future seasons: players new to the app start at 800.
    const endedSeasons = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.isActive, false))
    const isFirstSeason = endedSeasons.length === 0
    const startingRR = isFirstSeason ? 0 : 800

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
          rr: startingRR,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
        })
        .returning()
      return created
    }

    // Count a player's total confirmed games across ALL seasons by looking at
    // rr_changes (one row per player per confirmed match). We stop scanning at
    // PLACEMENT_GAMES rows since we only need to know whether they've finished
    // placement or not.
    async function getLifetimeGames(userId: string): Promise<number> {
      const rows = await tx
        .select({ id: rrChanges.id })
        .from(rrChanges)
        .where(eq(rrChanges.userId, userId))
        .limit(PLACEMENT_GAMES)
      return rows.length
    }

    const [t1p1Stats, t1p2Stats, t2p1Stats, t2p2Stats] = await Promise.all(
      playerIds.map(getOrCreate),
    )

    // Lifetime games are queried BEFORE this match's rr_changes are inserted,
    // so the count correctly represents games played prior to this one.
    const [t1p1Lifetime, t1p2Lifetime, t2p1Lifetime, t2p2Lifetime] = await Promise.all(
      playerIds.map(getLifetimeGames),
    )

    // Placement K: new players (< PLACEMENT_GAMES career games) get a large K
    // on wins so they rise quickly, and double the normal K on losses so placement
    // is high-stakes. Returns undefined once placement is complete (uses default K).
    function placementK(lifetimeGames: number, won: boolean): number | undefined {
      if (lifetimeGames >= PLACEMENT_GAMES) return undefined
      return won ? PLACEMENT_WIN_K : PLACEMENT_LOSS_K
    }

    const team1Won = match.team1Sets > match.team2Sets
    const totalSets = match.team1Sets + match.team2Sets

    // Compute point differential from per-set scores (|team1Total − team2Total|)
    let pointDiff: number | undefined
    if (match.setScores && Array.isArray(match.setScores)) {
      const sets = match.setScores as Array<{ team1: number; team2: number }>
      const team1Total = sets.reduce((s, r) => s + r.team1, 0)
      const team2Total = sets.reduce((s, r) => s + r.team2, 0)
      pointDiff = Math.abs(team1Total - team2Total)
    }

    // Each player's delta uses their team's sets won as the "actual" score.
    // This means heavy favourites who barely win 2-1 get penalised (negative delta),
    // while the underdog who took that set gets rewarded even in defeat.
    const t1p1Delta = calculateRrChange(t1p1Stats.rr, t2p1Stats.rr, t2p2Stats.rr, match.team1Sets, totalSets, pointDiff, placementK(t1p1Lifetime, team1Won))
    const t1p2Delta = calculateRrChange(t1p2Stats.rr, t2p1Stats.rr, t2p2Stats.rr, match.team1Sets, totalSets, pointDiff, placementK(t1p2Lifetime, team1Won))
    const t2p1Delta = calculateRrChange(t2p1Stats.rr, t1p1Stats.rr, t1p2Stats.rr, match.team2Sets, totalSets, pointDiff, placementK(t2p1Lifetime, !team1Won))
    const t2p2Delta = calculateRrChange(t2p2Stats.rr, t1p1Stats.rr, t1p2Stats.rr, match.team2Sets, totalSets, pointDiff, placementK(t2p2Lifetime, !team1Won))

    const now = new Date()

    // Update match
    await tx
      .update(matches)
      .set({ status: 'CONFIRMED', verifiedBy: user.id, verifiedAt: now })
      .where(eq(matches.id, id))

    // Apply stats + record rr_changes for each player
    const updates: Array<{
      stats: typeof t1p1Stats
      delta: number
      won: boolean
      lifetimeGames: number
    }> = [
      { stats: t1p1Stats, delta: t1p1Delta, won: team1Won,  lifetimeGames: t1p1Lifetime },
      { stats: t1p2Stats, delta: t1p2Delta, won: team1Won,  lifetimeGames: t1p2Lifetime },
      { stats: t2p1Stats, delta: t2p1Delta, won: !team1Won, lifetimeGames: t2p1Lifetime },
      { stats: t2p2Stats, delta: t2p2Delta, won: !team1Won, lifetimeGames: t2p2Lifetime },
    ]

    for (const { stats, delta, won, lifetimeGames } of updates) {
      let newRr = Math.max(0, stats.rr + delta)

      // During placement, cap RR at the top of Gold so a new player can't
      // rocket past veterans on a lucky placement run.
      if (lifetimeGames < PLACEMENT_GAMES) {
        newRr = Math.min(newRr, PLACEMENT_RR_CAP)
      }

      const newGames = stats.gamesPlayed + 1

      await tx
        .update(seasonStats)
        .set({
          rr: newRr,
          gamesPlayed: newGames,
          wins: won ? stats.wins + 1 : stats.wins,
          losses: won ? stats.losses : stats.losses + 1,
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
