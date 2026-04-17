import { seasonStats, rrChanges } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import {
  calculateRrChange,
  K,
  PLACEMENT_GAMES,
  PLACEMENT_RR_CAP,
  LIFETIME_PLACEMENT_MULTIPLIER,
  SEASONAL_PLACEMENT_MULTIPLIER,
} from '@/lib/elo'
import type { db } from '@/lib/db'

// Transaction callback receives PgTransaction, not the outer db instance
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type PlacementInfo = {
  kOverride: number | undefined
  isInitialPlacement: boolean
  noLoss: boolean
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

export function getPlacementInfo(lifetimeGames: number, seasonGamesPlayed: number): PlacementInfo {
  if (lifetimeGames < PLACEMENT_GAMES) {
    return { kOverride: K * LIFETIME_PLACEMENT_MULTIPLIER, isInitialPlacement: true, noLoss: true }
  }
  if (seasonGamesPlayed < PLACEMENT_GAMES) {
    return { kOverride: K * SEASONAL_PLACEMENT_MULTIPLIER, isInitialPlacement: false, noLoss: true }
  }
  return { kOverride: undefined, isInitialPlacement: false, noLoss: false }
}

export async function countLifetimeGames(tx: Tx, userId: string): Promise<number> {
  const rows = await tx
    .select({ id: rrChanges.id })
    .from(rrChanges)
    .where(eq(rrChanges.userId, userId))
    .limit(PLACEMENT_GAMES)
  return rows.length
}

export function computePointDiff(setScores: unknown): number | undefined {
  if (!setScores || !Array.isArray(setScores)) return undefined
  const sets = setScores as Array<{ team1: number; team2: number }>
  const team1Total = sets.reduce((s, r) => s + r.team1, 0)
  const team2Total = sets.reduce((s, r) => s + r.team2, 0)
  return Math.abs(team1Total - team2Total)
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
 * Compute and write RR deltas for all four players in a single confirmed match.
 * Each stats object is mutated in-place so callers processing multiple matches
 * in sequence see correct running totals without re-querying the database.
 */
export async function applyMatchDeltas(
  tx: Tx,
  match: MatchRow,
  t1p1Stats: MutableStats,
  t1p2Stats: MutableStats,
  t2p1Stats: MutableStats,
  t2p2Stats: MutableStats,
  seasonId: string,
): Promise<void> {
  const [t1p1Lifetime, t1p2Lifetime, t2p1Lifetime, t2p2Lifetime] = await Promise.all([
    countLifetimeGames(tx, match.team1Player1Id),
    countLifetimeGames(tx, match.team1Player2Id),
    countLifetimeGames(tx, match.team2Player1Id),
    countLifetimeGames(tx, match.team2Player2Id),
  ])

  const team1Won = match.team1Sets > match.team2Sets
  const totalSets = match.team1Sets + match.team2Sets
  const pointDiff = computePointDiff(match.setScores)

  const t1p1Info = getPlacementInfo(t1p1Lifetime, t1p1Stats.gamesPlayed)
  const t1p2Info = getPlacementInfo(t1p2Lifetime, t1p2Stats.gamesPlayed)
  const t2p1Info = getPlacementInfo(t2p1Lifetime, t2p1Stats.gamesPlayed)
  const t2p2Info = getPlacementInfo(t2p2Lifetime, t2p2Stats.gamesPlayed)

  const clamp = (delta: number, info: PlacementInfo) =>
    info.noLoss ? Math.max(0, delta) : delta

  const t1p1Delta = clamp(calculateRrChange(t1p1Stats.rr, t1p2Stats.rr, t2p1Stats.rr, t2p2Stats.rr, match.team1Sets, totalSets, pointDiff, t1p1Info.kOverride, t1p1Info.isInitialPlacement), t1p1Info)
  const t1p2Delta = clamp(calculateRrChange(t1p2Stats.rr, t1p1Stats.rr, t2p1Stats.rr, t2p2Stats.rr, match.team1Sets, totalSets, pointDiff, t1p2Info.kOverride, t1p2Info.isInitialPlacement), t1p2Info)
  const t2p1Delta = clamp(calculateRrChange(t2p1Stats.rr, t2p2Stats.rr, t1p1Stats.rr, t1p2Stats.rr, match.team2Sets, totalSets, pointDiff, t2p1Info.kOverride, t2p1Info.isInitialPlacement), t2p1Info)
  const t2p2Delta = clamp(calculateRrChange(t2p2Stats.rr, t2p1Stats.rr, t1p1Stats.rr, t1p2Stats.rr, match.team2Sets, totalSets, pointDiff, t2p2Info.kOverride, t2p2Info.isInitialPlacement), t2p2Info)

  const updates = [
    { stats: t1p1Stats, userId: match.team1Player1Id, delta: t1p1Delta, won: team1Won,  lifetimeGames: t1p1Lifetime },
    { stats: t1p2Stats, userId: match.team1Player2Id, delta: t1p2Delta, won: team1Won,  lifetimeGames: t1p2Lifetime },
    { stats: t2p1Stats, userId: match.team2Player1Id, delta: t2p1Delta, won: !team1Won, lifetimeGames: t2p1Lifetime },
    { stats: t2p2Stats, userId: match.team2Player2Id, delta: t2p2Delta, won: !team1Won, lifetimeGames: t2p2Lifetime },
  ]

  for (const { stats, userId, delta, won, lifetimeGames } of updates) {
    const rrBefore = stats.rr
    let newRr = Math.max(0, rrBefore + delta)
    if (lifetimeGames < PLACEMENT_GAMES) newRr = Math.min(newRr, PLACEMENT_RR_CAP)

    const newGames = stats.gamesPlayed + 1
    const newWins  = won ? stats.wins + 1  : stats.wins
    const newLosses = won ? stats.losses   : stats.losses + 1

    await tx
      .update(seasonStats)
      .set({ rr: newRr, gamesPlayed: newGames, wins: newWins, losses: newLosses })
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
