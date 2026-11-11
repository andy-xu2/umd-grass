// Validation for user-submitted match fields. Each helper returns an error
// message for a 400 response, or null when the input is acceptable.

// Allows for clock skew and a time picked a minute or two ahead.
const FUTURE_GRACE_MS = 5 * 60 * 1000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a well-formed UUID string; Postgres rejects anything else with a 500. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export const MAX_SETS = 7
export const MAX_SET_POINTS = 99

/**
 * Sets must be 1–MAX_SETS objects with whole-number scores from 0 to
 * MAX_SET_POINTS, no tied set, and no tied match.
 */
export function setScoresError(sets: unknown): string | null {
  if (!Array.isArray(sets) || sets.length === 0) return 'At least one set is required'
  if (sets.length > MAX_SETS) return `A match can have at most ${MAX_SETS} sets`

  let team1Sets = 0
  let team2Sets = 0
  for (const set of sets) {
    const { team1, team2 } = (set ?? {}) as { team1?: unknown; team2?: unknown }
    if (!isPoints(team1) || !isPoints(team2)) {
      return `Set scores must be whole numbers from 0 to ${MAX_SET_POINTS}`
    }
    if (team1 === team2) return 'Individual sets cannot end in a tie'
    if (team1 > team2) team1Sets++
    else team2Sets++
  }

  if (team1Sets === team2Sets) return 'Match cannot end in a tie'
  return null
}

function isPoints(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SET_POINTS
}

/** A match must be played inside the season and not in the future. */
export function playedAtError(playedAt: Date, seasonStartedAt: Date, now: Date): string | null {
  if (playedAt < seasonStartedAt) return 'Played date is before the season started'
  if (playedAt.getTime() > now.getTime() + FUTURE_GRACE_MS) return 'Played date cannot be in the future'
  return null
}
