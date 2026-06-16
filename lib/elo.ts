import { DEFAULT_RR_CONFIG, type RrConfig } from './rr-config'

/**
 * Maximum RR a player can reach during initial career placement.
 * The actual threshold logic now lives in rr-config + match-engine.
 */
export const DEFAULT_PLACEMENT_RR_CAP = 1500

export const PLACEMENT_GAMES = 5

const NEUTRAL_POINT_DIFFERENTIAL = 8
const MIN_MARGIN_MULTIPLIER = 0.9
const MAX_MARGIN_MULTIPLIER = 1.1

/**
 * Expected score for one team against another.
 */
export function expectedScore(teamARating: number, teamBRating: number, scale: number): number {
  return 1 / (1 + Math.pow(10, (teamBRating - teamARating) / scale))
}

export function marginMultiplier(scoreDiff: number | undefined, movMultiplier: number): number {
  if (!movMultiplier || movMultiplier <= 0) return 1
  if (scoreDiff === undefined) return 1

  const centeredMargin = Math.log(
    (Math.max(scoreDiff, 0) + 1) / (NEUTRAL_POINT_DIFFERENTIAL + 1),
  )
  const multiplier = 1 + movMultiplier * centeredMargin

  return Math.min(MAX_MARGIN_MULTIPLIER, Math.max(MIN_MARGIN_MULTIPLIER, multiplier))
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
 * Retains 60% of a player's distance from the configured starting RR between
 * seasons. This regresses ratings toward the baseline rather than toward zero.
 */
export function applySeasonDecay(rr: number): number {
  const baseline = DEFAULT_RR_CONFIG.baseStartingRr
  return Math.max(0, Math.round(baseline + 0.6 * (rr - baseline)))
}
