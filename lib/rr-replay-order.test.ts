import { describe, expect, it } from 'vitest'
import {
  compareRrReplayBoundaries,
  earliestRrReplayBoundary,
  type RrReplayBoundary,
} from './rr-replay-order'

const base: RrReplayBoundary = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  playedAt: new Date('2026-06-15T18:00:00.000Z'),
  submittedAt: new Date('2026-06-15T19:00:00.000Z'),
}

describe('RR replay ordering', () => {
  it('orders matches by played time, submitted time, then id', () => {
    expect(compareRrReplayBoundaries(
      { ...base, playedAt: new Date('2026-06-15T17:00:00.000Z') },
      base,
    )).toBeLessThan(0)

    expect(compareRrReplayBoundaries(
      { ...base, submittedAt: new Date('2026-06-15T18:30:00.000Z') },
      base,
    )).toBeLessThan(0)

    expect(compareRrReplayBoundaries(
      { ...base, id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      base,
    )).toBeLessThan(0)
  })

  it('uses the earlier old position when a match moves later', () => {
    const movedLater = {
      ...base,
      playedAt: new Date('2026-06-16T18:00:00.000Z'),
    }

    expect(earliestRrReplayBoundary(base, movedLater)).toBe(base)
  })

  it('uses the new position when a match moves earlier', () => {
    const movedEarlier = {
      ...base,
      playedAt: new Date('2026-06-14T18:00:00.000Z'),
    }

    expect(earliestRrReplayBoundary(base, movedEarlier)).toBe(movedEarlier)
  })
})
