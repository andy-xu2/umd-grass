export const DEFAULT_K = 40

/**
 * Minimum RR a player can gain on a match win.
 * The soft gain cap near 3000 RR would otherwise reduce wins to 1-2 RR,
 * making high-level play feel pointless. This floor keeps it meaningful.
 * Only applies when the ELO math itself expected a positive gain (base > 0).
 */
export const MIN_WIN_GAIN = 5

/**
 * Maximum RR a player can reach during initial career placement.
 * The actual threshold logic now lives in rr-config + match-engine.
 */
export const DEFAULT_PLACEMENT_RR_CAP = 1500

export const PLACEMENT_GAMES = 5

/**
 * ELO scale factor. Controls how steeply expected score diverges with RR difference.
 * Higher values = gentler curve = less harsh gains/losses for mismatched opponents.
 */
export const ELO_SCALE = 1800

/**
 * Expected score for a player against the average of two opponents.
 * opponent_avg_rr = (oppRR1 + oppRR2) / 2
 */
import type { RrConfig } from '@/lib/rr-config'

export function expectedScore(teamARating: number, teamBRating: number, scale: number): number {
  return 1 / (1 + Math.pow(10, (teamBRating - teamARating) / scale))
}

export function marginMultiplier(scoreDiff: number | undefined, movMultiplier: number): number {
  if (!movMultiplier || movMultiplier <= 0) return 1
  return 1 + movMultiplier * Math.log1p(Math.max(scoreDiff ?? 0, 0))
}

/**
 * Exact same core math as the Python test:
 * delta = K * mov_mult * (actual - expected)
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
 * Keep this only if you still want cross-season decay elsewhere.
 * It is NOT used by the Python test path below.
 */
export function applySeasonDecay(rr: number): number {
  return Math.max(0, Math.round(rr * 0.6))
}