const K = 40

/**
 * Expected score for a player against the average of two opponents.
 * opponent_avg_rr = (oppRR1 + oppRR2) / 2
 */
export function expectedScore(playerRR: number, oppRR1: number, oppRR2: number): number {
  const opponentAvg = (oppRR1 + oppRR2) / 2
  return 1 / (1 + Math.pow(10, (opponentAvg - playerRR) / 400))
}

/**
 * Margin-of-victory multiplier combining set differential and point differential.
 *
 * setMargin  = winnerSets − loserSets (always positive, from winner's perspective)
 * pointDiff  = winner's total points − loser's total points across all sets (always positive)
 *
 * Base multiplier from sets:
 *   - setMargin ≥ 2 (sweep) → 1.2 for both winner and loser
 *   - setMargin = 1 (close)  → winner ×1.0, loser ×0.75
 *
 * Point differential adds up to +0.1 to the multiplier for both sides:
 *   - Normalised against 20 points as a "significant" gap
 *   - A lopsided point total amplifies the result: winners gain more, losers lose more
 *
 * If setMargin is not provided the multiplier is 1.0 for both sides.
 */
export function marginMultiplier(
  won: boolean,
  setMargin: number | undefined,
  pointDiff?: number,
): number {
  if (setMargin === undefined) return 1.0

  let multiplier: number
  if (setMargin >= 2) {
    multiplier = 1.2
  } else {
    multiplier = won ? 1.0 : 0.75
  }

  if (pointDiff !== undefined) {
    // Normalize point diff: 20-point gap = full 0.1 adjustment.
    // A lopsided point total always increases the multiplier for both sides:
    // winners gain a bit more and losers lose a bit more (less softening).
    const pointAdj = Math.min(Math.abs(pointDiff) / 20, 1) * 0.1
    multiplier += pointAdj
  }

  return Math.round(multiplier * 1000) / 1000
}

/**
 * Calculate RR change for a single player after a match.
 *
 * @param playerRR   - Player's current RR
 * @param oppRR1     - First opponent's current RR
 * @param oppRR2     - Second opponent's current RR
 * @param won        - Whether the player's team won
 * @param setMargin  - (optional) winnerSets − loserSets; enables set-margin scaling
 * @param pointDiff  - (optional) winner total points − loser total points; adds fine-grained scaling
 * @returns          - Signed integer RR delta (positive = gain, negative = loss)
 */
export function calculateRrChange(
  playerRR: number,
  oppRR1: number,
  oppRR2: number,
  won: boolean,
  setMargin?: number,
  pointDiff?: number,
): number {
  const actual = won ? 1 : 0
  const expected = expectedScore(playerRR, oppRR1, oppRR2)
  const base = K * (actual - expected)
  return Math.round(base * marginMultiplier(won, setMargin, pointDiff))
}
