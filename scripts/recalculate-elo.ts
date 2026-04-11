/**
 * Recalculates all confirmed match RR from scratch using the current ELO formula.
 *
 * Safe to run multiple times — clears rr_changes and resets season_stats before replaying.
 *
 * Order: confirmed matches replayed by submittedAt ascending (first submitted = first applied).
 *
 * Usage:
 *   npx tsx scripts/recalculate-elo.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, asc, and, ne, desc, inArray } from 'drizzle-orm'
import * as schema from '../drizzle/schema'
import {
  calculateRrChange,
  applySeasonDecay,
  K,
  PLACEMENT_GAMES,
  PLACEMENT_RR_CAP,
  LIFETIME_PLACEMENT_MULTIPLIER,
  SEASONAL_PLACEMENT_MULTIPLIER,
} from '../lib/elo'

const { matches, seasonStats, rrChanges, seasons } = schema

const client = postgres(process.env.DATABASE_URL!, { prepare: false })
const db = drizzle(client, { schema })

// ─── helpers (mirrors verify/route.ts logic) ─────────────────────────────────

function getPlacementInfo(lifetimeGames: number, seasonGamesPlayed: number) {
  if (lifetimeGames < PLACEMENT_GAMES) {
    return { kOverride: K * LIFETIME_PLACEMENT_MULTIPLIER, isInitialPlacement: true, noLoss: true }
  }
  if (seasonGamesPlayed < PLACEMENT_GAMES) {
    return { kOverride: K * SEASONAL_PLACEMENT_MULTIPLIER, isInitialPlacement: false, noLoss: true }
  }
  return { kOverride: undefined, isInitialPlacement: false, noLoss: false }
}

function applyNoLoss(delta: number, noLoss: boolean) {
  return noLoss ? Math.max(0, delta) : delta
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching confirmed matches...')

  const confirmedMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.status, 'CONFIRMED'))
    .orderBy(asc(matches.submittedAt))

  console.log(`Found ${confirmedMatches.length} confirmed matches.`)

  if (confirmedMatches.length === 0) {
    console.log('Nothing to recalculate.')
    await client.end()
    return
  }

  // ── Step 1: wipe existing rr_changes and reset all season_stats ─────────────
  console.log('Clearing rr_changes...')
  await db.delete(rrChanges)

  console.log('Resetting season_stats (rr=0, gamesPlayed=0, wins=0, losses=0)...')
  await db.update(seasonStats).set({ rr: 0, gamesPlayed: 0, wins: 0, losses: 0 })

  // ── Step 2: replay each match in order ──────────────────────────────────────

  // In-memory tracking of each player's current state per season.
  // key: `${userId}:${seasonId}`
  const statsCache = new Map<string, typeof seasonStats.$inferSelect>()

  async function getOrCreate(userId: string, seasonId: string) {
    const cacheKey = `${userId}:${seasonId}`
    if (statsCache.has(cacheKey)) return statsCache.get(cacheKey)!

    const [existing] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, seasonId)))

    if (existing) {
      statsCache.set(cacheKey, existing)
      return existing
    }

    // New player in this season — find previous season RR for decay
    const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.startedAt))
    const seasonIndex = allSeasons.findIndex(s => s.id === seasonId)
    const prevSeasons = allSeasons.slice(seasonIndex + 1)

    let startingRR = 0
    for (const prev of prevSeasons) {
      const [prevStats] = await db
        .select()
        .from(seasonStats)
        .where(and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, prev.id)))
      if (prevStats) {
        startingRR = applySeasonDecay(prevStats.rr)
        break
      }
    }

    const [created] = await db
      .insert(seasonStats)
      .values({ userId, seasonId, rr: startingRR, gamesPlayed: 0, wins: 0, losses: 0 })
      .returning()

    statsCache.set(cacheKey, created)
    return created
  }

  // Lifetime game counter tracked in memory (rr_changes count per user, capped at PLACEMENT_GAMES)
  const lifetimeGamesMap = new Map<string, number>()

  function getLifetimeGames(userId: string) {
    return Math.min(lifetimeGamesMap.get(userId) ?? 0, PLACEMENT_GAMES)
  }

  function incrementLifetimeGames(userId: string) {
    lifetimeGamesMap.set(userId, (lifetimeGamesMap.get(userId) ?? 0) + 1)
  }

  for (let i = 0; i < confirmedMatches.length; i++) {
    const match = confirmedMatches[i]
    const { id, seasonId, team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id, team1Sets, team2Sets, setScores, submittedAt } = match

    process.stdout.write(`[${i + 1}/${confirmedMatches.length}] match ${id.slice(0, 8)} (${submittedAt?.toISOString().slice(0, 10)}) ... `)

    const playerIds = [team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id]

    const [t1p1Stats, t1p2Stats, t2p1Stats, t2p2Stats] = await Promise.all(
      playerIds.map(uid => getOrCreate(uid, seasonId))
    )

    const t1p1Lifetime = getLifetimeGames(team1Player1Id)
    const t1p2Lifetime = getLifetimeGames(team1Player2Id)
    const t2p1Lifetime = getLifetimeGames(team2Player1Id)
    const t2p2Lifetime = getLifetimeGames(team2Player2Id)

    const t1p1Info = getPlacementInfo(t1p1Lifetime, t1p1Stats.gamesPlayed)
    const t1p2Info = getPlacementInfo(t1p2Lifetime, t1p2Stats.gamesPlayed)
    const t2p1Info = getPlacementInfo(t2p1Lifetime, t2p1Stats.gamesPlayed)
    const t2p2Info = getPlacementInfo(t2p2Lifetime, t2p2Stats.gamesPlayed)

    const totalSets = team1Sets + team2Sets
    const team1Won = team1Sets > team2Sets

    let pointDiff: number | undefined
    if (setScores && Array.isArray(setScores)) {
      const sets = setScores as Array<{ team1: number; team2: number }>
      const t1Total = sets.reduce((s, r) => s + r.team1, 0)
      const t2Total = sets.reduce((s, r) => s + r.team2, 0)
      pointDiff = Math.abs(t1Total - t2Total)
    }

    const t1p1Delta = applyNoLoss(calculateRrChange(t1p1Stats.rr, t1p2Stats.rr, t2p1Stats.rr, t2p2Stats.rr, team1Sets, totalSets, pointDiff, t1p1Info.kOverride, t1p1Info.isInitialPlacement), t1p1Info.noLoss)
    const t1p2Delta = applyNoLoss(calculateRrChange(t1p2Stats.rr, t1p1Stats.rr, t2p1Stats.rr, t2p2Stats.rr, team1Sets, totalSets, pointDiff, t1p2Info.kOverride, t1p2Info.isInitialPlacement), t1p2Info.noLoss)
    const t2p1Delta = applyNoLoss(calculateRrChange(t2p1Stats.rr, t2p2Stats.rr, t1p1Stats.rr, t1p2Stats.rr, team2Sets, totalSets, pointDiff, t2p1Info.kOverride, t2p1Info.isInitialPlacement), t2p1Info.noLoss)
    const t2p2Delta = applyNoLoss(calculateRrChange(t2p2Stats.rr, t2p1Stats.rr, t1p1Stats.rr, t1p2Stats.rr, team2Sets, totalSets, pointDiff, t2p2Info.kOverride, t2p2Info.isInitialPlacement), t2p2Info.noLoss)

    const updates = [
      { stats: t1p1Stats, delta: t1p1Delta, won: team1Won,  lifetime: t1p1Lifetime },
      { stats: t1p2Stats, delta: t1p2Delta, won: team1Won,  lifetime: t1p2Lifetime },
      { stats: t2p1Stats, delta: t2p1Delta, won: !team1Won, lifetime: t2p1Lifetime },
      { stats: t2p2Stats, delta: t2p2Delta, won: !team1Won, lifetime: t2p2Lifetime },
    ]

    for (const { stats, delta, won, lifetime } of updates) {
      let newRr = Math.max(0, stats.rr + delta)
      if (lifetime < PLACEMENT_GAMES) newRr = Math.min(newRr, PLACEMENT_RR_CAP)

      const newStats = {
        ...stats,
        rr: newRr,
        gamesPlayed: stats.gamesPlayed + 1,
        wins: won ? stats.wins + 1 : stats.wins,
        losses: won ? stats.losses : stats.losses + 1,
      }

      await db.update(seasonStats).set({
        rr: newStats.rr,
        gamesPlayed: newStats.gamesPlayed,
        wins: newStats.wins,
        losses: newStats.losses,
      }).where(eq(seasonStats.id, stats.id))

      await db.insert(rrChanges).values({
        matchId: id,
        userId: stats.userId,
        seasonId,
        delta,
        rrBefore: stats.rr,
        rrAfter: newRr,
      })

      // Update cache with new state
      statsCache.set(`${stats.userId}:${seasonId}`, newStats)

      incrementLifetimeGames(stats.userId)
    }

    const names = [
      `t1p1:${t1p1Stats.userId.slice(0, 6)} ${t1p1Delta > 0 ? '+' : ''}${t1p1Delta}`,
      `t1p2:${t1p2Stats.userId.slice(0, 6)} ${t1p2Delta > 0 ? '+' : ''}${t1p2Delta}`,
      `t2p1:${t2p1Stats.userId.slice(0, 6)} ${t2p1Delta > 0 ? '+' : ''}${t2p1Delta}`,
      `t2p2:${t2p2Stats.userId.slice(0, 6)} ${t2p2Delta > 0 ? '+' : ''}${t2p2Delta}`,
    ]
    console.log(names.join('  '))
  }

  console.log('\nDone. Final RR standings:')
  const final = await db
    .select({ userId: seasonStats.userId, rr: seasonStats.rr, gamesPlayed: seasonStats.gamesPlayed })
    .from(seasonStats)
    .orderBy(desc(seasonStats.rr))

  for (const row of final) {
    console.log(`  ${row.userId.slice(0, 8)}  ${row.rr} RR  (${row.gamesPlayed} games)`)
  }

  await client.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
