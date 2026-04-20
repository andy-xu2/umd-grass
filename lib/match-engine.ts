import { seasonStats, rrChanges } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { calculateRrChange } from '@/lib/elo'
import type { db } from '@/lib/db'
import type { PlacementType, RrConfig } from '@/lib/rr-config'

// Transaction callback receives PgTransaction, not the outer db instance
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type PlacementInfo = {
  kOverride: number | undefined
  placementType: PlacementType
}

// Mutable subset of a seasonStats row — mutated in-place so callers processing
// multiple matches in sequence see the correct running totals.
export type MutableStats = {
  id: string
  rr: number
  gamesPlayed: number
  wins: number
  losses: number
}

export function getPlacementInfo(
  lifetimeGames: number,
  seasonGamesPlayed: number,
  rrConfig: RrConfig,
): PlacementInfo {
  if (lifetimeGames < rrConfig.placementGames) {
    return {
      kOverride: rrConfig.baseK * rrConfig.lifetimePlacementMultiplier,
      placementType: 'lifetime',
    }
  }

  if (seasonGamesPlayed < rrConfig.placementGames) {
    return {
      kOverride: rrConfig.baseK * rrConfig.seasonalPlacementMultiplier,
      placementType: 'seasonal',
    }
  }

  return {
    kOverride: undefined,
    placementType: 'none',
  }
}

export async function countLifetimeGames(
  tx: Tx,
  userId: string,
  placementGames: number,
): Promise<number> {
  const rows = await tx
    .select({ id: rrChanges.id })
    .from(rrChanges)
    .where(eq(rrChanges.userId, userId))
    .limit(placementGames)

  return rows.length
}

export function computePointDiff(setScores: unknown): number | undefined {
  if (!setScores || !Array.isArray(setScores)) return undefined

  const sets = setScores as Array<{ team1: number; team2: number }>
  const team1Total = sets.reduce((s, r) => s + r.team1, 0)
  const team2Total = sets.reduce((s, r) => s + r.team2, 0)

  return Math.abs(team1Total - team2Total)
}

function applyResultMultiplier(
  delta: number,
  placementType: PlacementType,
  won: boolean,
  rrConfig: RrConfig,
): number {
  if (placementType === 'lifetime') {
    return won
      ? delta * rrConfig.lifetimePlacementWinMultiplier
      : delta * rrConfig.lifetimePlacementLossMultiplier
  }

  if (placementType === 'seasonal') {
    return won
      ? delta * rrConfig.seasonalPlacementWinMultiplier
      : delta * rrConfig.seasonalPlacementLossMultiplier
  }

  return won
    ? delta * rrConfig.nonPlacementWinMultiplier
    : delta * rrConfig.nonPlacementLossMultiplier
}

type MatchRow = {
  id: string
  team1Player1Id: string
  team1Player2Id: string
  team2Player1Id: string
  team2Player2Id: string
  team1Sets: number
  team2Sets: number
  setScores: unknown
}

/**
 * Exact same logic as the Python test:
 * - team rating = average of two players
 * - expected = team-vs-team Elo expected
 * - per-player kOverride from placement state
 * - per-player win/loss multipliers
 * - losses during placement are allowed
 * - no cap, no clamp, no mismatch rules
 */
export async function applyMatchDeltas(
  tx: Tx,
  match: MatchRow,
  t1p1Stats: MutableStats,
  t1p2Stats: MutableStats,
  t2p1Stats: MutableStats,
  t2p2Stats: MutableStats,
  seasonId: string,
  rrConfig: RrConfig,
): Promise<void> {
  const [t1p1Lifetime, t1p2Lifetime, t2p1Lifetime, t2p2Lifetime] = await Promise.all([
    countLifetimeGames(tx, match.team1Player1Id, rrConfig.placementGames),
    countLifetimeGames(tx, match.team1Player2Id, rrConfig.placementGames),
    countLifetimeGames(tx, match.team2Player1Id, rrConfig.placementGames),
    countLifetimeGames(tx, match.team2Player2Id, rrConfig.placementGames),
  ])

  const team1Won = match.team1Sets > match.team2Sets
  const totalSets = match.team1Sets + match.team2Sets
  const actualA = team1Won ? 1 : 0
  const pointDiff = computePointDiff(match.setScores)

  const teamARating = (t1p1Stats.rr + t1p2Stats.rr) / 2
  const teamBRating = (t2p1Stats.rr + t2p2Stats.rr) / 2

  const t1p1Info = getPlacementInfo(t1p1Lifetime, t1p1Stats.gamesPlayed, rrConfig)
  const t1p2Info = getPlacementInfo(t1p2Lifetime, t1p2Stats.gamesPlayed, rrConfig)
  const t2p1Info = getPlacementInfo(t2p1Lifetime, t2p1Stats.gamesPlayed, rrConfig)
  const t2p2Info = getPlacementInfo(t2p2Lifetime, t2p2Stats.gamesPlayed, rrConfig)

  let t1p1Delta = calculateRrChange(
    teamARating,
    teamBRating,
    actualA,
    pointDiff,
    rrConfig,
    t1p1Info.kOverride,
  )

  let t1p2Delta = calculateRrChange(
    teamARating,
    teamBRating,
    actualA,
    pointDiff,
    rrConfig,
    t1p2Info.kOverride,
  )

  let t2p1Delta = -calculateRrChange(
    teamARating,
    teamBRating,
    actualA,
    pointDiff,
    rrConfig,
    t2p1Info.kOverride,
  )

  let t2p2Delta = -calculateRrChange(
    teamARating,
    teamBRating,
    actualA,
    pointDiff,
    rrConfig,
    t2p2Info.kOverride,
  )

  t1p1Delta = applyResultMultiplier(t1p1Delta, t1p1Info.placementType, team1Won, rrConfig)
  t1p2Delta = applyResultMultiplier(t1p2Delta, t1p2Info.placementType, team1Won, rrConfig)
  t2p1Delta = applyResultMultiplier(t2p1Delta, t2p1Info.placementType, !team1Won, rrConfig)
  t2p2Delta = applyResultMultiplier(t2p2Delta, t2p2Info.placementType, !team1Won, rrConfig)

  const updates = [
    {
      stats: t1p1Stats,
      userId: match.team1Player1Id,
      delta: t1p1Delta,
      won: team1Won,
    },
    {
      stats: t1p2Stats,
      userId: match.team1Player2Id,
      delta: t1p2Delta,
      won: team1Won,
    },
    {
      stats: t2p1Stats,
      userId: match.team2Player1Id,
      delta: t2p1Delta,
      won: !team1Won,
    },
    {
      stats: t2p2Stats,
      userId: match.team2Player2Id,
      delta: t2p2Delta,
      won: !team1Won,
    },
  ]

  for (const { stats, userId, delta, won } of updates) {
    const rrBefore = stats.rr
    const roundedDelta = Math.round(delta)
    const newRr = Math.max(0, rrBefore + roundedDelta)

    const newGames = stats.gamesPlayed + 1
    const newWins = won ? stats.wins + 1 : stats.wins
    const newLosses = won ? stats.losses : stats.losses + 1

    await tx
      .update(seasonStats)
      .set({ rr: newRr, gamesPlayed: newGames, wins: newWins, losses: newLosses })
      .where(eq(seasonStats.id, stats.id))

    await tx.insert(rrChanges).values({
      matchId: match.id,
      userId,
      seasonId,
      delta: roundedDelta,
      rrBefore,
      rrAfter: newRr,
    })

    stats.rr = newRr
    stats.gamesPlayed = newGames
    stats.wins = newWins
    stats.losses = newLosses
  }
}