// Validation for user-submitted match fields. Each helper returns an error
// message for a 400 response, or null when the input is acceptable.

// Allows for clock skew and a time picked a minute or two ahead.
const FUTURE_GRACE_MS = 5 * 60 * 1000

/** A match must be played inside the season and not in the future. */
export function playedAtError(playedAt: Date, seasonStartedAt: Date, now: Date): string | null {
  if (playedAt < seasonStartedAt) return 'Played date is before the season started'
  if (playedAt.getTime() > now.getTime() + FUTURE_GRACE_MS) return 'Played date cannot be in the future'
  return null
}
