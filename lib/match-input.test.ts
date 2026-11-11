import { describe, expect, it } from 'vitest'
import { isUuid, playedAtError, setScoresError } from './match-input'

describe('setScoresError', () => {
  it('accepts normal results', () => {
    expect(setScoresError([{ team1: 21, team2: 18 }, { team1: 21, team2: 14 }])).toBeNull()
    expect(setScoresError([{ team1: 0, team2: 99 }])).toBeNull()
    expect(setScoresError([
      { team1: 21, team2: 1 }, { team1: 1, team2: 21 }, { team1: 21, team2: 1 },
      { team1: 1, team2: 21 }, { team1: 15, team2: 13 },
    ])).toBeNull()
    // Best of 7 that goes the distance.
    expect(setScoresError([
      { team1: 21, team2: 1 }, { team1: 1, team2: 21 }, { team1: 21, team2: 1 },
      { team1: 1, team2: 21 }, { team1: 21, team2: 1 }, { team1: 1, team2: 21 },
      { team1: 15, team2: 13 },
    ])).toBeNull()
  })

  it('rejects missing, empty, and too many sets', () => {
    expect(setScoresError(undefined)).toMatch(/at least one/i)
    expect(setScoresError([])).toMatch(/at least one/i)
    expect(setScoresError(Array.from({ length: 8 }, () => ({ team1: 21, team2: 1 })))).toMatch(/at most 7/)
  })

  it('rejects non-integer, negative, oversized, and malformed scores', () => {
    for (const bad of [
      { team1: 21.5, team2: 3 },
      { team1: -1, team2: 21 },
      { team1: 100, team2: 0 },
      { team1: '21', team2: 3 },
      { team1: 21 },
      null,
      'x',
    ]) {
      expect(setScoresError([bad])).toMatch(/whole numbers/)
    }
  })

  it('rejects tied sets and tied matches', () => {
    expect(setScoresError([{ team1: 21, team2: 21 }])).toMatch(/sets cannot end in a tie/)
    expect(setScoresError([{ team1: 21, team2: 1 }, { team1: 1, team2: 21 }])).toMatch(/Match cannot end in a tie/)
  })
})

describe('isUuid', () => {
  it('accepts a UUID in either case', () => {
    expect(isUuid('394b1992-6584-4be8-baca-9fe9a7fbbb32')).toBe(true)
    expect(isUuid('394B1992-6584-4BE8-BACA-9FE9A7FBBB32')).toBe(true)
  })

  it('rejects malformed strings and non-strings', () => {
    expect(isUuid('394b1992-6584-4be8-baca-9fe9a7fbbb3')).toBe(false)
    expect(isUuid("394b1992-6584-4be8-baca-9fe9a7fbbb32' OR 1=1")).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(123)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})

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
