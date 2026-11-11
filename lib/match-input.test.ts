import { describe, expect, it } from 'vitest'
import { playedAtError } from './match-input'

describe('playedAtError', () => {
  const seasonStart = new Date('2026-06-01T04:00:00.000Z')
  const now = new Date('2026-07-01T18:00:00.000Z')

  it('accepts a time inside the season', () => {
    expect(playedAtError(new Date('2026-06-20T18:00:00.000Z'), seasonStart, now)).toBeNull()
  })

  it('accepts the exact season start and the current time', () => {
    expect(playedAtError(seasonStart, seasonStart, now)).toBeNull()
    expect(playedAtError(now, seasonStart, now)).toBeNull()
  })

  it('rejects a time before the season started', () => {
    expect(playedAtError(new Date('2026-05-31T23:59:00.000Z'), seasonStart, now)).toMatch(/before the season/)
  })

  it('allows up to 5 minutes ahead but rejects later times', () => {
    expect(playedAtError(new Date(now.getTime() + 5 * 60 * 1000), seasonStart, now)).toBeNull()
    expect(playedAtError(new Date(now.getTime() + 5 * 60 * 1000 + 1), seasonStart, now)).toMatch(/future/)
  })
})
