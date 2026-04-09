export const K = 40

/**
 * Minimum RR a player can gain on a match win.
 * The soft gain cap near 3000 RR would otherwise reduce wins to 1-2 RR,
 * making high-level play feel pointless. This floor keeps it meaningful.
 * Only applies when the ELO math itself expected a positive gain (base > 0).
 */
export const MIN_WIN_GAIN = 5

/**
 * Number of games that count as "placement" for a brand-new player.
 * Applies to their first PLACEMENT_GAMES confirmed matches ever, regardless of season.
 */
export const PLACEMENT_GAMES = 5

/**
 * K factors during placement games.
 *
 * Wins use a large K so strong players rise quickly.
 * Losses use double the normal K — placement is high-stakes in both directions.
 * This asymmetry rewards confident play while punishing sloppy losses.
 */
export const PLACEMENT_WIN_K = 200
export const PLACEMENT_LOSS_K = K * 2 // 80 — double the normal K

/**
 * Maximum RR a player can reach during their placement games.
 * Prevents a new player from rocketing past veterans on an unlikely perfect run.
 * Gold tier is 1000–1499, so 1399 caps at the top of Gold.
 */
export const PLACEMENT_RR_CAP = 1399

/**
 * Expected score for a player against the average of two opponents.
 * opponent_avg_rr = (oppRR1 + oppRR2) / 2
 */
export function expectedScore(playerRR: number, oppRR1: number, oppRR2: number): number {
  const opponentAvg = (oppRR1 + oppRR2) / 2
  return 1 / (1 + Math.pow(10, (opponentAvg - playerRR) / 400))
}

/**
 * Fine-grained point-differential multiplier.
 *
 * Adds up to ±0.1 to the delta based on total point spread across all sets.
 * A lopsided point total amplifies the result: bigger gains for dominant wins,
 * bigger losses for getting blown out.
 *
 * pointDiff = |team1TotalPoints − team2TotalPoints|
 * A 20-point gap applies the full +0.1 adjustment.
 */
export function pointDiffMultiplier(pointDiff?: number): number {
  if (pointDiff === undefined) return 1.0
  return 1.0 + Math.min(Math.abs(pointDiff) / 20, 1) * 0.1
}

/**
 * Soft gain cap multiplier — reduces RR gains as a player's RR approaches and
 * exceeds 3000. Only applied to positive base deltas; losses remain at full
 * value, creating asymmetric pressure that makes sustaining 3000+ very hard.
 *
 * Behaviour by zone:
 *   ≤ 2500         → 1.0   (no reduction, full gains)
 *   2500 → 3000    → linear from 1.0 down to 0.30
 *   > 3000         → exponential decay from 0.30 toward 0.01
 *
 * At 3000 RR, a sweep against an equal opponent yields ~6 RR gain.
 * Break-even win rates at equal-RR matchups (sweep):
 *   2750 RR → ~67% wins to climb   (mild pressure)
 *   3000 RR → ~87% wins to climb   (very hard)
 *   3200 RR → ~94% wins to climb   (essentially a ceiling)
 */
export function gainSoftCapMultiplier(rr: number): number {
  if (rr <= 2500) return 1.0
  if (rr <= 3000) return 1.0 - 0.70 * ((rr - 2500) / 500) // 1.0 → 0.30 linearly
  // Exponential decay above 3000, floored at 0.01
  return Math.max(0.30 * Math.exp(-(rr - 3000) / 150), 0.01)
}

/**
 * Calculate RR change for a single player after a match.
 *
 * Uses the player's SET FRACTION (setsWon / totalSets) as the "actual" score
 * rather than a binary win/loss. This means:
 *
 *   • A sweep (2-0) against equal opponents yields the full ±K/2 swing.
 *   • A close match (2-1) against equal opponents yields a smaller swing (~K/6).
 *   • A heavy favourite who barely wins 2-1 against a much weaker team gets a
 *     NEGATIVE delta — they underperformed expectations at the set level.
 *   • The underdog who took that set gets a POSITIVE delta despite losing.
 *   • A true upset win (1000 beats 3000 2-0) still yields gains near +K.
 *
 * The floor MIN_WIN_GAIN guarantees a minimum positive reward when the ELO math
 * expected a gain (base > 0) and the player won the majority of sets. This keeps
 * games near the 3000 soft cap meaningful.
 *
 * @param playerRR      - Player's current RR
 * @param oppRR1        - First opponent's current RR
 * @param oppRR2        - Second opponent's current RR
 * @param playerSetsWon - Sets won by this player's team
 * @param totalSets     - Total sets played in the match
 * @param pointDiff     - (optional) |team1Points − team2Points| across all sets
 * @param kOverride     - (optional) override the base K factor (e.g. placement games)
 * @returns               Signed integer RR delta (may be negative even on a match win)
 */
export function calculateRrChange(
  playerRR: number,
  oppRR1: number,
  oppRR2: number,
  playerSetsWon: number,
  totalSets: number,
  pointDiff?: number,
  kOverride?: number,
): number {
  const effectiveK = kOverride ?? K
  const actual = playerSetsWon / totalSets
  const expected = expectedScore(playerRR, oppRR1, oppRR2)
  let base = effectiveK * (actual - expected)

  // Soft gain cap: reduce gains (not losses) as RR approaches 3000+.
  // Losses stay full to create asymmetric pressure above the cap zone.
  if (base > 0) {
    base *= gainSoftCapMultiplier(playerRR)
  }

  const result = Math.round(base * pointDiffMultiplier(pointDiff))

  // Minimum gain floor: if the ELO math expected a positive gain AND the player
  // won the majority of sets, ensure they get at least MIN_WIN_GAIN. This only
  // kicks in when the soft cap (not the set-fraction logic) reduced the gain to
  // near zero.
  const wonMatch = playerSetsWon * 2 > totalSets
  if (wonMatch && base > 0 && result < MIN_WIN_GAIN) {
    return MIN_WIN_GAIN
  }

  return result
}

/**
 * Continuous season-end RR decay based on a player's actual ending RR.
 *
 * Each player retains 60% of their RR, losing 40%. Because the loss is
 * proportional to RR, higher-ranked players always lose more in absolute
 * terms than lower-ranked players — there are no tier thresholds or steps.
 *
 * Examples:
 *   200  → 120  (lose  80)
 *   500  → 300  (lose 200)
 *   800  → 480  (lose 320)
 *   1000 → 600  (lose 400)
 *   1500 → 900  (lose 600)
 *   2000 → 1200 (lose 800)
 *   2500 → 1500 (lose 1000)
 *
 * @param rr - Player's RR at the end of the previous season
 * @returns     Player's starting RR for the new season (≥ 0)
 */
export function applySeasonDecay(rr: number): number {
  return Math.max(0, Math.round(rr * 0.6))
}
