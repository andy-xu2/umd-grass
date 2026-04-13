import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, seasonStats, rrChanges, seasons } from '@/drizzle/schema'
import { eq, and, ne, desc, asc, inArray } from 'drizzle-orm'
import {
  calculateRrChange,
  applySeasonDecay,
  K,
  PLACEMENT_GAMES,
  PLACEMENT_RR_CAP,
  LIFETIME_PLACEMENT_MULTIPLIER,
  SEASONAL_PLACEMENT_MULTIPLIER,
} from '@/lib/elo'
import { isAdmin } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  let seasonId = searchParams.get('seasonId')

  if (!seasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    seasonId = activeSeason?.id ?? null
  }

  if (!seasonId) {
    return NextResponse.json({ error: 'No season found' }, { status: 400 })
  }

  await db.transaction(async tx => {
    // Load all confirmed matches for the season in current canonical order.
    // Later you can swap submittedAt for playedAt/order fields.
    const confirmedMatches = await tx
      .select()
      .from(matches)
      .where(and(eq(matches.seasonId, seasonId), eq(matches.status, 'CONFIRMED')))
      .orderBy(asc(matches.playedAt), asc(matches.submittedAt))

    // Gather all players involved in this season's confirmed matches.
    const playerIds = Array.from(
      new Set(
        confirmedMatches.flatMap(m => [
          m.team1Player1Id,
          m.team1Player2Id,
          m.team2Player1Id,
          m.team2Player2Id,
        ]),
      ),
    )

    // Remove all RR history for this season.
    await tx.delete(rrChanges).where(eq(rrChanges.seasonId, seasonId))

    // Load all season stats rows for this season.
    const existingSeasonStats = await tx
      .select()
      .from(seasonStats)
      .where(eq(seasonStats.seasonId, seasonId))

    // Deduplicate season_stats rows if needed: keep one row per user.
    const keepByUser = new Map<string, (typeof existingSeasonStats)[number]>()
    const dupIdsToDelete: string[] = []

    for (const row of existingSeasonStats) {
      const existing = keepByUser.get(row.userId)
      if (!existing) {
        keepByUser.set(row.userId, row)
      } else {
        dupIdsToDelete.push(row.id)
      }
    }

    for (const dupId of dupIdsToDelete) {
      await tx.delete(seasonStats).where(eq(seasonStats.id, dupId))
    }

    // Ensure every involved player has exactly one season_stats row,
    // and reset it the same way live verification would start them.
    const statsByUser = new Map<string, (typeof existingSeasonStats)[number]>()

    for (const userId of playerIds) {
      const existing = keepByUser.get(userId)

      // Find most recent previous season RR for this player.
      const [prevStats] = await tx
        .select({ rr: seasonStats.rr })
        .from(seasonStats)
        .innerJoin(seasons, eq(seasonStats.seasonId, seasons.id))
        .where(and(eq(seasonStats.userId, userId), ne(seasonStats.seasonId, seasonId)))
        .orderBy(desc(seasons.startedAt))
        .limit(1)

      const startingRR = prevStats ? applySeasonDecay(prevStats.rr) : 0

      if (existing) {
        await tx
          .update(seasonStats)
          .set({
            rr: startingRR,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
          })
          .where(eq(seasonStats.id, existing.id))

        statsByUser.set(userId, {
          ...existing,
          rr: startingRR,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
        })
      } else {
        const [created] = await tx
          .insert(seasonStats)
          .values({
            userId,
            seasonId,
            rr: startingRR,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
          })
          .returning()

        statsByUser.set(userId, created)
      }
    }

    // Replay each confirmed match using the same core logic as verify.
    for (const match of confirmedMatches) {
      const matchPlayerIds = [
        match.team1Player1Id,
        match.team1Player2Id,
        match.team2Player1Id,
        match.team2Player2Id,
      ] as const

      async function getLifetimeGames(userId: string): Promise<number> {
        const rows = await tx
          .select({ id: rrChanges.id })
          .from(rrChanges)
          .where(eq(rrChanges.userId, userId))
          .limit(PLACEMENT_GAMES)

        return rows.length
      }

      function getPlacementInfo(lifetimeGames: number, seasonGamesPlayed: number) {
        if (lifetimeGames < PLACEMENT_GAMES) {
          return {
            kOverride: K * LIFETIME_PLACEMENT_MULTIPLIER,
            isInitialPlacement: true,
            noLoss: true,
          }
        }

        if (seasonGamesPlayed < PLACEMENT_GAMES) {
          return {
            kOverride: K * SEASONAL_PLACEMENT_MULTIPLIER,
            isInitialPlacement: false,
            noLoss: true,
          }
        }

        return {
          kOverride: undefined,
          isInitialPlacement: false,
          noLoss: false,
        }
      }

      const t1p1Stats = statsByUser.get(match.team1Player1Id)
      const t1p2Stats = statsByUser.get(match.team1Player2Id)
      const t2p1Stats = statsByUser.get(match.team2Player1Id)
      const t2p2Stats = statsByUser.get(match.team2Player2Id)

      if (!t1p1Stats || !t1p2Stats || !t2p1Stats || !t2p2Stats) {
        continue
      }

      const [t1p1Lifetime, t1p2Lifetime, t2p1Lifetime, t2p2Lifetime] = await Promise.all(
        matchPlayerIds.map(getLifetimeGames),
      )

      const team1Won = match.team1Sets > match.team2Sets
      const totalSets = match.team1Sets + match.team2Sets

      let pointDiff: number | undefined
      if (match.setScores && Array.isArray(match.setScores)) {
        const sets = match.setScores as Array<{ team1: number; team2: number }>
        const team1Total = sets.reduce((s, r) => s + r.team1, 0)
        const team2Total = sets.reduce((s, r) => s + r.team2, 0)
        pointDiff = Math.abs(team1Total - team2Total)
      }

      const t1p1Info = getPlacementInfo(t1p1Lifetime, t1p1Stats.gamesPlayed)
      const t1p2Info = getPlacementInfo(t1p2Lifetime, t1p2Stats.gamesPlayed)
      const t2p1Info = getPlacementInfo(t2p1Lifetime, t2p1Stats.gamesPlayed)
      const t2p2Info = getPlacementInfo(t2p2Lifetime, t2p2Stats.gamesPlayed)

      const noLoss = (
        delta: number,
        info: { noLoss: boolean },
      ) => (info.noLoss ? Math.max(0, delta) : delta)

      const t1p1Delta = noLoss(
        calculateRrChange(
          t1p1Stats.rr,
          t1p2Stats.rr,
          t2p1Stats.rr,
          t2p2Stats.rr,
          match.team1Sets,
          totalSets,
          pointDiff,
          t1p1Info.kOverride,
          t1p1Info.isInitialPlacement,
        ),
        t1p1Info,
      )

      const t1p2Delta = noLoss(
        calculateRrChange(
          t1p2Stats.rr,
          t1p1Stats.rr,
          t2p1Stats.rr,
          t2p2Stats.rr,
          match.team1Sets,
          totalSets,
          pointDiff,
          t1p2Info.kOverride,
          t1p2Info.isInitialPlacement,
        ),
        t1p2Info,
      )

      const t2p1Delta = noLoss(
        calculateRrChange(
          t2p1Stats.rr,
          t2p2Stats.rr,
          t1p1Stats.rr,
          t1p2Stats.rr,
          match.team2Sets,
          totalSets,
          pointDiff,
          t2p1Info.kOverride,
          t2p1Info.isInitialPlacement,
        ),
        t2p1Info,
      )

      const t2p2Delta = noLoss(
        calculateRrChange(
          t2p2Stats.rr,
          t2p1Stats.rr,
          t1p1Stats.rr,
          t1p2Stats.rr,
          match.team2Sets,
          totalSets,
          pointDiff,
          t2p2Info.kOverride,
          t2p2Info.isInitialPlacement,
        ),
        t2p2Info,
      )

      const updates = [
        {
          stats: t1p1Stats,
          userId: match.team1Player1Id,
          delta: t1p1Delta,
          won: team1Won,
          lifetimeGames: t1p1Lifetime,
        },
        {
          stats: t1p2Stats,
          userId: match.team1Player2Id,
          delta: t1p2Delta,
          won: team1Won,
          lifetimeGames: t1p2Lifetime,
        },
        {
          stats: t2p1Stats,
          userId: match.team2Player1Id,
          delta: t2p1Delta,
          won: !team1Won,
          lifetimeGames: t2p1Lifetime,
        },
        {
          stats: t2p2Stats,
          userId: match.team2Player2Id,
          delta: t2p2Delta,
          won: !team1Won,
          lifetimeGames: t2p2Lifetime,
        },
      ]

      for (const { stats, userId, delta, won, lifetimeGames } of updates) {
        const rrBefore = stats.rr

        let newRr = Math.max(0, rrBefore + delta)

        if (lifetimeGames < PLACEMENT_GAMES) {
          newRr = Math.min(newRr, PLACEMENT_RR_CAP)
        }

        const newGames = stats.gamesPlayed + 1
        const newWins = won ? stats.wins + 1 : stats.wins
        const newLosses = won ? stats.losses : stats.losses + 1

        await tx
          .update(seasonStats)
          .set({
            rr: newRr,
            gamesPlayed: newGames,
            wins: newWins,
            losses: newLosses,
          })
          .where(eq(seasonStats.id, stats.id))

        await tx.insert(rrChanges).values({
          matchId: match.id,
          userId,
          seasonId,
          delta,
          rrBefore,
          rrAfter: newRr,
        })

        stats.rr = newRr
        stats.gamesPlayed = newGames
        stats.wins = newWins
        stats.losses = newLosses
      }
    }
  })

  return NextResponse.json({ ok: true })
}