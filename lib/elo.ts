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
 * Calculate RR change for a single player after a match.
 *
 * @param playerRR   - Player's current RR
 * @param oppRR1     - First opponent's current RR
 * @param oppRR2     - Second opponent's current RR
 * @param won        - Whether the player's team won
 * @returns          - Signed integer RR delta (positive = gain, negative = loss)
 */
export function calculateRrChange(
  playerRR: number,
  oppRR1: number,
  oppRR2: number,
  won: boolean,
): number {
  const actual = won ? 1 : 0
  const expected = expectedScore(playerRR, oppRR1, oppRR2)
  return Math.round(K * (actual - expected))
}
