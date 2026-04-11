import { describe, it, expect } from 'vitest'
import {
  calculateRrChange,
  expectedScore,
  pointDiffMultiplier,
  applySeasonDecay,
  gainSoftCapMultiplier,
  LIFETIME_PLACEMENT_MULTIPLIER,
  SEASONAL_PLACEMENT_MULTIPLIER,
  PLACEMENT_RR_CAP,
  MIN_WIN_GAIN,
  ELO_SCALE,
  K,
} from './elo'

// Helper: 2-0 sweep win/loss shorthands for equal-RR tests (teammate same RR)
const sweep = (rr: number) => calculateRrChange(rr, rr, rr, rr, 2, 2)
const sweepLoss = (rr: number) => calculateRrChange(rr, rr, rr, rr, 0, 2)
const closeWin = (rr: number) => calculateRrChange(rr, rr, rr, rr, 2, 3)
const closeLoss = (rr: number) => calculateRrChange(rr, rr, rr, rr, 1, 3)

// ─── expectedScore ───────────────────────────────────────────────────────────

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

// ─── pointDiffMultiplier ─────────────────────────────────────────────────────

describe('pointDiffMultiplier', () => {
  it('returns 1.0 when pointDiff is undefined', () => {
    expect(pointDiffMultiplier(undefined)).toBe(1.0)
  })

  it('returns 1.0 for zero point diff', () => {
    expect(pointDiffMultiplier(0)).toBe(1.0)
  })

  it('returns > 1.0 for positive point diff', () => {
    expect(pointDiffMultiplier(20)).toBeGreaterThan(1.0)
  })

  it('caps at 1.1 for large point diffs', () => {
    expect(pointDiffMultiplier(1000)).toBeCloseTo(1.1, 5)
    expect(pointDiffMultiplier(20)).toBeCloseTo(1.1, 5)
  })

  it('is monotonically increasing with point diff', () => {
    expect(pointDiffMultiplier(10)).toBeLessThan(pointDiffMultiplier(20))
  })
})

// ─── calculateRrChange — equal matchups ──────────────────────────────────────

describe('calculateRrChange — equal RR matchups', () => {
  it('2-0 sweep gives +K/2 to winner', () => {
    expect(sweep(800)).toBe(K / 2) // K=40 → 20
  })

  it('0-2 loss gives −K/2 to loser', () => {
    expect(sweepLoss(800)).toBe(-(K / 2))
  })

  it('2-1 close win gives smaller positive than sweep', () => {
    expect(closeWin(800)).toBeGreaterThan(0)
    expect(closeWin(800)).toBeLessThan(sweep(800))
  })

  it('1-2 close loss gives smaller negative than sweep loss', () => {
    expect(closeLoss(800)).toBeLessThan(0)
    expect(Math.abs(closeLoss(800))).toBeLessThan(Math.abs(sweepLoss(800)))
  })

  it('sweep is symmetric: winner gain = |loser loss|', () => {
    expect(sweep(800)).toBe(Math.abs(sweepLoss(800)))
  })

  it('close match is symmetric: |2-1 win| = |1-2 loss|', () => {
    expect(Math.abs(closeWin(800))).toBe(Math.abs(closeLoss(800)))
  })

  it('output is always an integer', () => {
    expect(Number.isInteger(calculateRrChange(850, 850, 780, 920, 2, 3))).toBe(true)
  })
})

// ─── calculateRrChange — RR gap effects ──────────────────────────────────────

describe('calculateRrChange — RR gap effects', () => {
  it('higher RR player sweeping weaker opponents gains fewer points than equal matchup', () => {
    const vsWeak = calculateRrChange(1000, 1000, 600, 600, 2, 2)
    const vsEqual = sweep(1000)
    expect(vsWeak).toBeLessThan(vsEqual)
  })

  it('lower RR player loses fewer points when swept by a stronger team', () => {
    const vsStrong = calculateRrChange(800, 800, 1200, 1200, 0, 2)
    const vsEqual = sweepLoss(800)
    expect(Math.abs(vsStrong)).toBeLessThan(Math.abs(vsEqual))
  })

  it('upsets a stronger team to gain more than beating equal', () => {
    expect(calculateRrChange(800, 800, 1200, 1200, 2, 2)).toBeGreaterThan(sweep(800))
  })

  it('max gain is large (but < K with scale=1800) on a clean upset sweep', () => {
    const gain = calculateRrChange(100, 100, 2000, 2000, 2, 2)
    expect(gain).toBeGreaterThan(35)
    expect(gain).toBeLessThanOrEqual(K)
  })

  it('max loss is large (but < K with scale=1800) on a catastrophic upset loss', () => {
    const loss = calculateRrChange(2000, 2000, 100, 100, 0, 2)
    expect(loss).toBeLessThan(-35)
    expect(loss).toBeGreaterThanOrEqual(-K)
  })
})

// ─── calculateRrChange — mismatch set-fraction effect ────────────────────────

describe('calculateRrChange — heavy mismatch set-fraction behaviour', () => {
  it('heavy favourite barely winning 2-1 gets a NEGATIVE delta', () => {
    // 3000 vs 1000: expected to win everything, only won 2/3 sets
    const delta = calculateRrChange(3000, 3000, 1000, 1000, 2, 3)
    expect(delta).toBeLessThan(0)
  })

  it('heavy underdog taking a set despite losing gets a POSITIVE delta', () => {
    // 1000 vs 3000: expected to win nothing, won 1/3 sets
    const delta = calculateRrChange(1000, 1000, 3000, 3000, 1, 3)
    expect(delta).toBeGreaterThan(0)
  })

  it('heavy favourite sweeping gets near-zero (as expected)', () => {
    // 3000 vs 1000: expected to win everything, did exactly that
    const delta = calculateRrChange(3000, 3000, 1000, 1000, 2, 2)
    // Should be near 0 or floored to MIN_WIN_GAIN since won + base > 0
    expect(Math.abs(delta)).toBeLessThanOrEqual(MIN_WIN_GAIN)
  })

  it('mismatch deltas are zero-sum per team (underdog gains ≈ favourite loses)', () => {
    const favDelta = calculateRrChange(3000, 3000, 1000, 1000, 2, 3)   // favourite wins 2-1
    const undDelta = calculateRrChange(1000, 1000, 3000, 3000, 1, 3)   // underdog loses 1-2
    // Should sum near 0 (zero-sum economy)
    expect(Math.abs(favDelta + undDelta)).toBeLessThanOrEqual(2)
  })

  it('upset WIN gives large gain for the underdog', () => {
    const gain = calculateRrChange(1000, 1000, 3000, 3000, 2, 2) // 1000 sweeps 3000
    expect(gain).toBeGreaterThan(35)
    expect(gain).toBeLessThanOrEqual(K)
  })

  it('upset WIN costs the favourite large RR', () => {
    const loss = calculateRrChange(3000, 3000, 1000, 1000, 0, 2) // 3000 gets swept by 1000
    expect(loss).toBeLessThan(-35)
    expect(loss).toBeGreaterThanOrEqual(-K)
  })
})

// ─── calculateRrChange — pointDiff multiplier interaction ────────────────────

describe('calculateRrChange — pointDiff interaction', () => {
  it('dominant sweep (large pointDiff) gains more than a tight sweep', () => {
    const dominant = calculateRrChange(800, 800, 800, 800, 2, 2, 30)
    const tight    = calculateRrChange(800, 800, 800, 800, 2, 2, 2)
    expect(dominant).toBeGreaterThan(tight)
  })

  it('getting blown out (large pointDiff) loses more than losing tightly', () => {
    const blowout = calculateRrChange(800, 800, 800, 800, 0, 2, 30)
    const tight   = calculateRrChange(800, 800, 800, 800, 0, 2, 2)
    expect(Math.abs(blowout)).toBeGreaterThan(Math.abs(tight))
  })

  it('output is always an integer with pointDiff', () => {
    expect(Number.isInteger(calculateRrChange(850, 850, 780, 920, 2, 3, 15))).toBe(true)
  })
})

// ─── calculateRrChange — kOverride (placement multipliers) ───────────────────

describe('calculateRrChange — placement multipliers', () => {
  it('LIFETIME_PLACEMENT_MULTIPLIER is 13', () => {
    expect(LIFETIME_PLACEMENT_MULTIPLIER).toBe(13)
  })

  it('SEASONAL_PLACEMENT_MULTIPLIER is 3', () => {
    expect(SEASONAL_PLACEMENT_MULTIPLIER).toBe(3)
  })

  it('SEASONAL_PLACEMENT_MULTIPLIER < LIFETIME_PLACEMENT_MULTIPLIER', () => {
    expect(SEASONAL_PLACEMENT_MULTIPLIER).toBeLessThan(LIFETIME_PLACEMENT_MULTIPLIER)
  })

  it('lifetime placement gain scales 15× vs normal', () => {
    const normal    = sweep(800)
    const placement = calculateRrChange(800, 800, 800, 800, 2, 2, undefined, K * LIFETIME_PLACEMENT_MULTIPLIER)
    expect(placement / normal).toBeCloseTo(LIFETIME_PLACEMENT_MULTIPLIER, 0)
  })

  it('seasonal placement gain scales 3× vs normal', () => {
    const normal    = sweep(800)
    const placement = calculateRrChange(800, 800, 800, 800, 2, 2, undefined, K * SEASONAL_PLACEMENT_MULTIPLIER)
    expect(placement / normal).toBeCloseTo(SEASONAL_PLACEMENT_MULTIPLIER, 0)
  })
})

// ─── calculateRrChange — isInitialPlacement ──────────────────────────────────

describe('calculateRrChange — isInitialPlacement', () => {
  const lifetimeK = K * LIFETIME_PLACEMENT_MULTIPLIER // 600

  it('5 clean 1-set wins from 0 RR at equal opponents reaches ~1300 RR', () => {
    let rr = 0
    for (let i = 0; i < 5; i++) {
      const delta = calculateRrChange(rr, rr, rr, rr, 1, 1, undefined, lifetimeK, true)
      rr = Math.min(PLACEMENT_RR_CAP, rr + delta)
    }
    expect(rr).toBeGreaterThanOrEqual(1200)
    expect(rr).toBeLessThanOrEqual(PLACEMENT_RR_CAP)
  })

  it('loss during placement yields 0 RR change', () => {
    const delta = calculateRrChange(0, 0, 800, 800, 0, 1, undefined, lifetimeK, true)
    expect(delta).toBe(0)
  })

  it('win against higher-RR opponent gains more than equal-RR win (no clamp, bigger E gap)', () => {
    const vsEqual   = calculateRrChange(0, 0, 0, 0, 1, 1, undefined, lifetimeK, true)
    const vsStronger = calculateRrChange(0, 0, 1500, 1500, 1, 1, undefined, lifetimeK, true)
    expect(vsStronger).toBeGreaterThan(vsEqual)
  })

  it('win against lower-RR opponent clamps expected to 0.5, giving full K×0.5 gain', () => {
    const withoutPlacement = calculateRrChange(1200, 1200, 200, 200, 1, 1, undefined, lifetimeK, false)
    const withPlacement    = calculateRrChange(1200, 1200, 200, 200, 1, 1, undefined, lifetimeK, true)
    expect(withPlacement).toBeGreaterThan(withoutPlacement)
    expect(withPlacement).toBe(Math.round(lifetimeK * 0.5))
  })

  it('unranked vs unranked (both 0 RR) gain = lifetimeK × 0.5', () => {
    const delta = calculateRrChange(0, 0, 0, 0, 1, 1, undefined, lifetimeK, true)
    expect(delta).toBe(Math.round(lifetimeK * 0.5))
  })

  it('isInitialPlacement=false does not clamp (reduced but still positive gain as favourite)', () => {
    const withoutPlacement = calculateRrChange(1200, 1200, 200, 200, 1, 1, undefined, lifetimeK, false)
    expect(withoutPlacement).toBeLessThan(Math.round(lifetimeK * 0.5))
    expect(withoutPlacement).toBeGreaterThan(0)
  })
})

// ─── gainSoftCapMultiplier ───────────────────────────────────────────────────

describe('gainSoftCapMultiplier', () => {
  it('returns exactly 1.0 at and below 2500', () => {
    expect(gainSoftCapMultiplier(0)).toBe(1.0)
    expect(gainSoftCapMultiplier(800)).toBe(1.0)
    expect(gainSoftCapMultiplier(2500)).toBe(1.0)
  })

  it('returns ~0.30 at exactly 3000', () => {
    expect(gainSoftCapMultiplier(3000)).toBeCloseTo(0.30, 5)
  })

  it('is strictly decreasing above 2500', () => {
    const rrs = [2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3400]
    for (let i = 1; i < rrs.length; i++) {
      expect(gainSoftCapMultiplier(rrs[i])).toBeLessThan(gainSoftCapMultiplier(rrs[i - 1]))
    }
  })

  it('is always positive', () => {
    for (const rr of [0, 1000, 2500, 3000, 3500, 5000]) {
      expect(gainSoftCapMultiplier(rr)).toBeGreaterThan(0)
    }
  })

  it('is continuous at 3000 (no jump)', () => {
    expect(gainSoftCapMultiplier(2999)).toBeGreaterThan(gainSoftCapMultiplier(3000))
    expect(gainSoftCapMultiplier(3000)).toBeGreaterThan(gainSoftCapMultiplier(3001))
  })
})

// ─── calculateRrChange — soft gain cap ───────────────────────────────────────

describe('calculateRrChange — soft gain cap', () => {
  it('sweep gain at 2600 RR is less than at 2400 RR against equal opponents', () => {
    expect(sweep(2600)).toBeLessThan(sweep(2400))
  })

  it('sweep gain at 3000 RR is in the 5–8 range for equal matchup', () => {
    const gain = sweep(3000)
    expect(gain).toBeGreaterThanOrEqual(5)
    expect(gain).toBeLessThanOrEqual(8)
  })

  it('loss at 3000 RR is NOT reduced by the soft cap', () => {
    const normalLoss = sweepLoss(800)
    const capLoss    = sweepLoss(3000)
    expect(capLoss).toBe(normalLoss)
  })

  it('gains below 2500 are not affected by the cap', () => {
    expect(sweep(2000)).toBe(sweep(800))
  })
})

// ─── calculateRrChange — MIN_WIN_GAIN floor ───────────────────────────────────

describe('calculateRrChange — MIN_WIN_GAIN floor', () => {
  it('close win at 3000 RR (soft-capped to near 0) is floored to MIN_WIN_GAIN', () => {
    const gain = closeWin(3000) // 2-1 win, cap reduces to ~2
    expect(gain).toBeGreaterThanOrEqual(MIN_WIN_GAIN)
  })

  it('floor does NOT apply to losses', () => {
    expect(closeLoss(3000)).toBeLessThan(0)
  })

  it('floor does NOT apply when mismatch set-fraction rightfully gives negative delta', () => {
    // 3000 wins 2-1 against 1000 but underperformed (actual 2/3 < expected ~1)
    const delta = calculateRrChange(3000, 3000, 1000, 1000, 2, 3)
    expect(delta).toBeLessThan(MIN_WIN_GAIN)
  })

  it('normal wins well above MIN_WIN_GAIN are not affected', () => {
    expect(sweep(800)).toBeGreaterThan(MIN_WIN_GAIN)
  })
})

// ─── gainSoftCapMultiplier — 3000 break-even rates ───────────────────────────

describe('calculateRrChange — 3000+ break-even rates', () => {
  it('at 3000 RR, losses are much larger than gains against equal opponent', () => {
    const gain = sweep(3000)
    const loss = Math.abs(sweepLoss(3000))
    expect(loss).toBeGreaterThan(gain * 2) // need >2× wins to compensate losses
  })
})

// ─── calculateRrChange — mismatched team (team-average ELO) ──────────────────

describe('calculateRrChange — mismatched teammate', () => {
  it('high-RR player loses less when dragged down by a weak teammate', () => {
    // 2000 (high) + 600 (low) vs 1200 + 1400. High player uses team avg (1300 vs 1300).
    const withWeakTeammate = calculateRrChange(2000, 600, 1200, 1400, 0, 2)
    // 2000 with equal teammate vs same opponents — team avg 2000 vs 1300, higher expected
    const withStrongTeammate = calculateRrChange(2000, 2000, 1200, 1400, 0, 2)
    expect(Math.abs(withWeakTeammate)).toBeLessThan(Math.abs(withStrongTeammate))
  })

  it('high-RR player loss uses team avg, not solo RR', () => {
    // 2500 (high) + 200 (low) vs 700 + 900 (avg 800). Team avg = 1350.
    const delta = calculateRrChange(2500, 200, 700, 900, 0, 2)
    const teamExpected = 1 / (1 + Math.pow(10, (800 - 1350) / ELO_SCALE))
    expect(delta).toBeCloseTo(Math.round(-K * teamExpected), 0)
  })

  it('lower-ranked player loss uses their own RR, not team avg', () => {
    // 200 (low) + 2500 (high) vs 700 + 900 (avg 800). Individual: 200 vs 800.
    const delta = calculateRrChange(200, 2500, 700, 900, 0, 2)
    const individualExpected = 1 / (1 + Math.pow(10, (800 - 200) / ELO_SCALE))
    expect(delta).toBeCloseTo(Math.round(-K * individualExpected), 0)
  })

  it('lower-ranked player loses less than higher-ranked teammate on a shared loss', () => {
    // 2500 + 1500 vs 1750 + 1750 (avg 1750). 2500 uses team avg, 1500 uses own RR.
    const highDelta = calculateRrChange(2500, 1500, 1750, 1750, 0, 2)
    const lowDelta  = calculateRrChange(1500, 2500, 1750, 1750, 0, 2)
    expect(Math.abs(highDelta)).toBeGreaterThan(Math.abs(lowDelta))
  })

  it('equal-RR teammates both use team avg (same as own RR when equal)', () => {
    const p1Delta = calculateRrChange(1000, 1000, 1200, 1200, 0, 2)
    const p2Delta = calculateRrChange(1000, 1000, 1200, 1200, 0, 2)
    expect(p1Delta).toBe(p2Delta)
  })

  it('placement player (low RR) sweeping 2300+2300 team gains massive RR', () => {
    // 0 RR player (lower) with 800 RR teammate vs 2300+2300. Uses own RR (0 vs 2300).
    const gain = calculateRrChange(0, 800, 2300, 2300, 2, 2, undefined, K * LIFETIME_PLACEMENT_MULTIPLIER)
    expect(gain).toBeGreaterThan(400) // near-full lifetime K since huge underdog
  })
})

// ─── applySeasonDecay ────────────────────────────────────────────────────────

describe('applySeasonDecay', () => {
  it('retains 60% of RR (loses 40%)', () => {
    expect(applySeasonDecay(1000)).toBe(600)
    expect(applySeasonDecay(500)).toBe(300)
    expect(applySeasonDecay(800)).toBe(480)
    expect(applySeasonDecay(1500)).toBe(900)
    expect(applySeasonDecay(2000)).toBe(1200)
    expect(applySeasonDecay(2500)).toBe(1500)
  })

  it('floors at 0', () => {
    expect(applySeasonDecay(0)).toBe(0)
    expect(applySeasonDecay(1)).toBe(1)
  })

  it('higher-ranked players always lose more absolute RR', () => {
    const rrs = [200, 500, 800, 1200, 1700, 2500]
    const decays = rrs.map(rr => rr - applySeasonDecay(rr))
    for (let i = 1; i < decays.length; i++) {
      expect(decays[i]).toBeGreaterThan(decays[i - 1])
    }
  })

  it('result is always non-negative', () => {
    for (const rr of [0, 50, 100, 499, 500, 999, 1000, 1499, 1500, 1999, 2000, 5000]) {
      expect(applySeasonDecay(rr)).toBeGreaterThanOrEqual(0)
    }
  })

  it('decay scales proportionally — same percentage at all RR levels', () => {
    const rrs = [200, 600, 1000, 1600, 2400]
    for (const rr of rrs) {
      const retained = applySeasonDecay(rr) / rr
      expect(retained).toBeCloseTo(0.6, 1)
    }
  })
})
