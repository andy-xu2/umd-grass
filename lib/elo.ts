import type { RrConfig } from '@/lib/rr-config'

/**
 * Maximum RR a player can reach during initial career placement.
 * The actual threshold logic now lives in rr-config + match-engine.
 */
export const DEFAULT_PLACEMENT_RR_CAP = 1500

export const PLACEMENT_GAMES = 5

/**
 * Expected score for one team against another.
 */
export function expectedScore(teamARating: number, teamBRating: number, scale: number): number {
  return 1 / (1 + Math.pow(10, (teamBRating - teamARating) / scale))
}

export function marginMultiplier(scoreDiff: number | undefined, movMultiplier: number): number {
  if (!movMultiplier || movMultiplier <= 0) return 1
  return 1 + movMultiplier * Math.log1p(Math.max(scoreDiff ?? 0, 0))
}

/**
 * Computes the unrounded RR delta before per-result multipliers and the
 * non-negative RR floor are applied by the match engine.
 */
export function calculateRrChange(
  teamARating: number,
  teamBRating: number,
  actualA: number,
  scoreDiff: number | undefined,
  rrConfig: RrConfig,
  kOverride?: number,
): number {
  const expA = expectedScore(teamARating, teamBRating, rrConfig.scale)
  const mult = marginMultiplier(scoreDiff, rrConfig.movMultiplier)
  const kUsed = kOverride ?? rrConfig.baseK
  return kUsed * mult * (actualA - expA)
}

/**
 * Retains 60% of a player's RR between seasons.
 */
export function applySeasonDecay(rr: number): number {
  return Math.max(0, Math.round(rr * 0.6))
}
