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
 * Margin-of-victory multipliers applied on top of the base ELO delta.
 *
 * setMargin = winnerSets - loserSets (always positive, from the winner's perspective)
 *
 * Close game (margin = 1, e.g. 2-1):
 *   - Winner gains the normal amount  (×1.0)
 *   - Loser loses less                (×0.75)
 *
 * Blowout (margin ≥ 2, e.g. 2-0):
 *   - Winner gains more               (×1.2)
 *   - Loser loses more                (×1.2)
 *
 * If setMargin is not provided the multiplier is 1.0 for both sides.
 */
export function marginMultiplier(won: boolean, setMargin: number | undefined): number {
  if (setMargin === undefined) return 1.0
  if (setMargin >= 2) return 1.2          // blowout — both sides amplified
  return won ? 1.0 : 0.75                 // close game — winner normal, loser softened
}

/**
 * Calculate RR change for a single player after a match.
 *
 * @param playerRR   - Player's current RR
 * @param oppRR1     - First opponent's current RR
 * @param oppRR2     - Second opponent's current RR
 * @param won        - Whether the player's team won
 * @param setMargin  - (optional) winnerSets − loserSets; enables margin-of-victory scaling
 * @returns          - Signed integer RR delta (positive = gain, negative = loss)
 */
export function calculateRrChange(
  playerRR: number,
  oppRR1: number,
  oppRR2: number,
  won: boolean,
  setMargin?: number,
): number {
  const actual = won ? 1 : 0
  const expected = expectedScore(playerRR, oppRR1, oppRR2)
  const base = K * (actual - expected)
  return Math.round(base * marginMultiplier(won, setMargin))
}
