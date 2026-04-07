import { describe, it, expect } from 'vitest'
import { calculateRrChange, expectedScore, marginMultiplier } from './elo'

describe('expectedScore', () => {
  it('returns 0.5 when player and opponents are equal RR', () => {
    expect(expectedScore(800, 800, 800)).toBeCloseTo(0.5)
  })

  it('returns > 0.5 when player has higher RR than opponents', () => {
    expect(expectedScore(1000, 800, 800)).toBeGreaterThan(0.5)
  })

  it('returns < 0.5 when player has lower RR than opponents', () => {
    expect(expectedScore(600, 800, 800)).toBeLessThan(0.5)
  })

  it('uses the average of opponent RRs', () => {
    const withAvg = expectedScore(800, 600, 1000)   // avg opp = 800
    const withEqual = expectedScore(800, 800, 800)
    expect(withAvg).toBeCloseTo(withEqual)
  })
})

describe('marginMultiplier', () => {
  it('returns 1.0 when no setMargin is provided', () => {
    expect(marginMultiplier(true, undefined)).toBe(1.0)
    expect(marginMultiplier(false, undefined)).toBe(1.0)
  })

  it('close game (margin 1): winner gets ×1.0', () => {
    expect(marginMultiplier(true, 1)).toBe(1.0)
  })

  it('close game (margin 1): loser gets ×0.75', () => {
    expect(marginMultiplier(false, 1)).toBe(0.75)
  })

  it('blowout (margin 2): winner gets ×1.2', () => {
    expect(marginMultiplier(true, 2)).toBe(1.2)
  })

  it('blowout (margin 2): loser gets ×1.2', () => {
    expect(marginMultiplier(false, 2)).toBe(1.2)
  })
})

describe('calculateRrChange — no score margin', () => {
  it('returns +20 on an evenly matched win', () => {
    expect(calculateRrChange(800, 800, 800, true)).toBe(20)
  })

  it('returns -20 on an evenly matched loss', () => {
    expect(calculateRrChange(800, 800, 800, false)).toBe(-20)
  })

  it('gains fewer points when beating a weaker team', () => {
    const vsWeak = calculateRrChange(1000, 600, 600, true)
    const vsEqual = calculateRrChange(1000, 1000, 1000, true)
    expect(vsWeak).toBeLessThan(vsEqual)
  })

  it('loses fewer points when losing to a stronger team', () => {
    const vsStrong = calculateRrChange(800, 1200, 1200, false)
    const vsEqual = calculateRrChange(800, 800, 800, false)
    expect(Math.abs(vsStrong)).toBeLessThan(Math.abs(vsEqual))
  })

  it('gains more points when upsetting a stronger team', () => {
    expect(calculateRrChange(800, 1200, 1200, true)).toBeGreaterThan(
      calculateRrChange(800, 800, 800, true),
    )
  })

  it('output is always an integer', () => {
    expect(Number.isInteger(calculateRrChange(850, 780, 920, true))).toBe(true)
  })

  it('max gain is bounded by K (40)', () => {
    expect(calculateRrChange(100, 2000, 2000, true)).toBeLessThanOrEqual(40)
  })

  it('max loss is bounded by -K (-40)', () => {
    expect(calculateRrChange(2000, 100, 100, false)).toBeGreaterThanOrEqual(-40)
  })
})

describe('calculateRrChange — close game (setMargin = 1)', () => {
  it('winner gains the same as without a margin', () => {
    expect(calculateRrChange(800, 800, 800, true, 1)).toBe(
      calculateRrChange(800, 800, 800, true),
    )
  })

  it('loser loses less than without a margin (×0.75)', () => {
    const withMargin = calculateRrChange(800, 800, 800, false, 1)
    const baseline = calculateRrChange(800, 800, 800, false)
    expect(Math.abs(withMargin)).toBeLessThan(Math.abs(baseline))
    expect(withMargin).toBe(Math.round(baseline * 0.75))
  })

  it('loser loss is still negative', () => {
    expect(calculateRrChange(800, 800, 800, false, 1)).toBeLessThan(0)
  })
})

describe('calculateRrChange — blowout (setMargin = 2)', () => {
  it('winner gains more than without a margin (×1.2)', () => {
    const withMargin = calculateRrChange(800, 800, 800, true, 2)
    const baseline = calculateRrChange(800, 800, 800, true)
    expect(withMargin).toBeGreaterThan(baseline)
    expect(withMargin).toBe(Math.round(baseline * 1.2))
  })

  it('loser loses more than without a margin (×1.2)', () => {
    const withMargin = calculateRrChange(800, 800, 800, false, 2)
    const baseline = calculateRrChange(800, 800, 800, false)
    expect(Math.abs(withMargin)).toBeGreaterThan(Math.abs(baseline))
    expect(withMargin).toBe(Math.round(baseline * 1.2))
  })

  it('blowout winner gains more than close winner', () => {
    const blowout = calculateRrChange(800, 800, 800, true, 2)
    const close = calculateRrChange(800, 800, 800, true, 1)
    expect(blowout).toBeGreaterThan(close)
  })

  it('blowout loser loses more than close loser', () => {
    const blowout = calculateRrChange(800, 800, 800, false, 2)
    const close = calculateRrChange(800, 800, 800, false, 1)
    expect(Math.abs(blowout)).toBeGreaterThan(Math.abs(close))
  })
})

describe('calculateRrChange — RR gap still matters with margin', () => {
  it('upset blowout (low RR beats high RR 2-0) gains more than upset close win', () => {
    const blowout = calculateRrChange(800, 1200, 1200, true, 2)
    const close = calculateRrChange(800, 1200, 1200, true, 1)
    expect(blowout).toBeGreaterThan(close)
  })

  it('high RR losing a blowout to low RR loses extra', () => {
    const blowout = calculateRrChange(1200, 800, 800, false, 2)
    const close = calculateRrChange(1200, 800, 800, false, 1)
    expect(Math.abs(blowout)).toBeGreaterThan(Math.abs(close))
  })
})
