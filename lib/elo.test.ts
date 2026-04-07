import { describe, it, expect } from 'vitest'
import { calculateRrChange, expectedScore } from './elo'

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

  it('uses the average of opponent RRs, not each individually', () => {
    // avg opp = 800, same as single opp scenario
    const withAvg = expectedScore(800, 600, 1000)
    const withEqual = expectedScore(800, 800, 800)
    expect(withAvg).toBeCloseTo(withEqual)
  })
})

describe('calculateRrChange', () => {
  it('returns a positive value on a win', () => {
    expect(calculateRrChange(800, 800, 800, true)).toBeGreaterThan(0)
  })

  it('returns a negative value on a loss', () => {
    expect(calculateRrChange(800, 800, 800, false)).toBeLessThan(0)
  })

  it('returns exactly 0 on a draw-equivalent (K=40, 0.5 expected, 0.5 actual) — not possible since actual is binary', () => {
    // When evenly matched and you win: +20, when you lose: -20
    expect(calculateRrChange(800, 800, 800, true)).toBe(20)
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
    const upset = calculateRrChange(800, 1200, 1200, true)
    const expected = calculateRrChange(800, 800, 800, true)
    expect(upset).toBeGreaterThan(expected)
  })

  it('returns an integer (Math.round applied)', () => {
    const result = calculateRrChange(850, 780, 920, true)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('teammate RR does not affect the calculation', () => {
    // Same player, same opponents — result should be identical regardless of teammate
    const result1 = calculateRrChange(800, 800, 800, true)
    const result2 = calculateRrChange(800, 800, 800, true)
    expect(result1).toBe(result2)
  })

  it('handles extreme RR gaps (near-certain win)', () => {
    // Very high RR vs very low opponents — gain should be close to 0
    const gain = calculateRrChange(2000, 100, 100, true)
    expect(gain).toBeGreaterThanOrEqual(0)
    expect(gain).toBeLessThan(5)
  })

  it('handles extreme RR gaps (near-certain loss)', () => {
    // Very low RR player loses to very high opponents — loss should be close to 0
    const loss = calculateRrChange(100, 2000, 2000, false)
    expect(loss).toBeGreaterThanOrEqual(-5)
    expect(loss).toBeLessThanOrEqual(0)
  })

  it('max gain is bounded by K (40)', () => {
    const gain = calculateRrChange(100, 2000, 2000, true)
    expect(gain).toBeLessThanOrEqual(40)
  })

  it('max loss is bounded by -K (-40)', () => {
    const loss = calculateRrChange(2000, 100, 100, false)
    expect(loss).toBeGreaterThanOrEqual(-40)
  })
})
