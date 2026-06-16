import { describe, it, expect } from 'vitest'
import {
  calculateRrChange,
  expectedScore,
  marginMultiplier,
  applySeasonDecay,
} from './elo'
import { DEFAULT_RR_CONFIG } from './rr-config'

describe('expectedScore', () => {
  it('returns 0.5 when teams have equal RR', () => {
    expect(expectedScore(800, 800, 400)).toBeCloseTo(0.5)
  })

  it('returns greater than 0.5 when team A is higher rated', () => {
    expect(expectedScore(1200, 800, 400)).toBeGreaterThan(0.5)
  })

  it('returns less than 0.5 when team A is lower rated', () => {
    expect(expectedScore(800, 1200, 400)).toBeLessThan(0.5)
  })
})

describe('marginMultiplier', () => {
  it('returns 1 when MOV is disabled', () => {
    expect(marginMultiplier(20, 0)).toBe(1)
  })

  it('reduces close results and increases decisive results', () => {
    expect(marginMultiplier(2, 0.05)).toBeLessThan(1)
    expect(marginMultiplier(8, 0.05)).toBeCloseTo(1)
    expect(marginMultiplier(20, 0.05)).toBeGreaterThan(1)
  })

  it('increases as score diff increases', () => {
    expect(marginMultiplier(10, 0.05)).toBeGreaterThan(
      marginMultiplier(2, 0.05),
    )
  })

  it('keeps the adjustment within ten percent', () => {
    expect(marginMultiplier(0, 0.05)).toBeGreaterThanOrEqual(0.9)
    expect(marginMultiplier(1000, 0.05)).toBeLessThanOrEqual(1.1)
  })
})

describe('calculateRrChange', () => {
  it('equal teams give +20 to winner with K=40', () => {
    const delta = calculateRrChange(
      800,
      800,
      1,
      8,
      DEFAULT_RR_CONFIG,
    )

    expect(delta).toBeCloseTo(20)
  })

  it('equal teams give -20 to loser with K=40', () => {
    const delta = calculateRrChange(
      800,
      800,
      0,
      8,
      DEFAULT_RR_CONFIG,
    )

    expect(delta).toBeCloseTo(-20)
  })

  it('favorite gains fewer points for winning', () => {
    const delta = calculateRrChange(
      1200,
      800,
      1,
      0,
      DEFAULT_RR_CONFIG,
    )

    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeLessThan(20)
  })

  it('underdog gains more points for winning', () => {
    const delta = calculateRrChange(
      800,
      1200,
      1,
      0,
      DEFAULT_RR_CONFIG,
    )

    expect(delta).toBeGreaterThan(20)
  })

  it('supports K override for placement', () => {
    const normal = calculateRrChange(
      800,
      800,
      1,
      0,
      DEFAULT_RR_CONFIG,
    )

    const placement = calculateRrChange(
      800,
      800,
      1,
      0,
      DEFAULT_RR_CONFIG,
      DEFAULT_RR_CONFIG.baseK * DEFAULT_RR_CONFIG.lifetimePlacementMultiplier,
    )

    expect(placement).toBeCloseTo(
      normal * DEFAULT_RR_CONFIG.lifetimePlacementMultiplier,
    )
  })

  it('MOV increases delta size when enabled', () => {
    const noMov = calculateRrChange(
      800,
      800,
      1,
      20,
      {
        ...DEFAULT_RR_CONFIG,
        movMultiplier: 0,
      },
    )

    const withMov = calculateRrChange(
      800,
      800,
      1,
      20,
      {
        ...DEFAULT_RR_CONFIG,
        movMultiplier: 0.05,
      },
    )

    expect(withMov).toBeGreaterThan(noMov)
  })

  it('moves less RR for close games and more for blowouts', () => {
    const close = calculateRrChange(800, 800, 1, 2, DEFAULT_RR_CONFIG)
    const neutral = calculateRrChange(800, 800, 1, 8, DEFAULT_RR_CONFIG)
    const blowout = calculateRrChange(800, 800, 1, 20, DEFAULT_RR_CONFIG)

    expect(close).toBeLessThan(neutral)
    expect(neutral).toBeCloseTo(20)
    expect(blowout).toBeGreaterThan(neutral)
  })
})

describe('applySeasonDecay', () => {
  it('retains 60% of the distance from the 800 RR baseline', () => {
    expect(applySeasonDecay(1000)).toBe(920)
    expect(applySeasonDecay(800)).toBe(800)
    expect(applySeasonDecay(1500)).toBe(1220)
  })

  it('moves ratings below the baseline upward toward it', () => {
    expect(applySeasonDecay(0)).toBe(320)
  })
})
