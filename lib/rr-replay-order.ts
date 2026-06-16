export type RrReplayBoundary = {
  id: string
  playedAt: Date
  submittedAt: Date
}

export function compareRrReplayBoundaries(
  left: RrReplayBoundary,
  right: RrReplayBoundary,
): number {
  const playedAtDifference = left.playedAt.getTime() - right.playedAt.getTime()
  if (playedAtDifference !== 0) return playedAtDifference

  const submittedAtDifference = left.submittedAt.getTime() - right.submittedAt.getTime()
  if (submittedAtDifference !== 0) return submittedAtDifference

  return left.id.localeCompare(right.id)
}

export function earliestRrReplayBoundary(
  left: RrReplayBoundary,
  right: RrReplayBoundary,
): RrReplayBoundary {
  return compareRrReplayBoundaries(left, right) <= 0 ? left : right
}
