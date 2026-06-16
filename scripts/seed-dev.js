#!/usr/bin/env node

const crypto = require('crypto')
const postgres = require('postgres')
const dotenv = require('dotenv')

dotenv.config({ path: ['.env.local', '.env'] })

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'
const PLAYER_COUNT = 40
const MATCHES_PER_SEASON = 200
const BASE_RR = 1000
const SEED_RR_CONFIG = {
  baseStartingRr: 800,
  baseK: 40,
  scale: 1800,
  movMultiplier: 0.03,
}

let rrHelpers = null
let appUtils = null

const APP_TABLES = [
  'tournament_playoff_games',
  'tournament_games',
  'tournament_teams',
  'tournament_pools',
  'tournaments',
  'court_queue_entries',
  'courts',
  'rr_changes',
  'matches',
  'season_stats',
  'seasons',
  'users',
]

const FIRST_NAMES = [
  'Alex', 'Taylor', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Jamie', 'Avery',
  'Cameron', 'Drew', 'Quinn', 'Parker', 'Reese', 'Rowan', 'Skyler', 'Emerson',
  'Hayden', 'Kendall', 'Logan', 'Finley', 'Dakota', 'Harper', 'Blake', 'Sage',
  'Micah', 'Tatum', 'Kai', 'Remy', 'Noah', 'Maya', 'Nina', 'Owen',
  'Lena', 'Eli', 'Mila', 'Theo', 'Iris', 'Caleb', 'Zoe', 'Julian',
]

const LAST_NAMES = [
  'Nguyen', 'Patel', 'Johnson', 'Kim', 'Garcia', 'Smith', 'Chen', 'Brown',
  'Davis', 'Rodriguez', 'Martinez', 'Lee', 'Wilson', 'Anderson', 'Thomas',
  'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Young',
  'Walker', 'Hall', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Green',
  'Baker', 'Adams', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts',
  'Turner', 'Phillips', 'Campbell',
]

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error('Refusing to seed while NODE_ENV or VERCEL_ENV is production.')
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }
  assertDevelopmentDatabaseUrl()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function adminUserId() {
  const configured = process.env.ADMIN_USER_ID
  if (!configured || !isUuid(configured)) {
    throw new Error('ADMIN_USER_ID must be set to a valid UUID for the seeded admin user.')
  }
  return configured
}

async function loadRrHelpers() {
  if (rrHelpers) return rrHelpers

  const originalEmitWarning = process.emitWarning
  process.emitWarning = function emitWarningWithoutTypelessPackageJson(warning, ...args) {
    const message = typeof warning === 'string' ? warning : warning?.message
    const code = warning?.code || args.find(arg => arg?.code)?.code
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || message?.includes('MODULE_TYPELESS_PACKAGE_JSON')) return
    return originalEmitWarning.call(process, warning, ...args)
  }

  try {
    rrHelpers = await import('../lib/elo.ts')
  } finally {
    process.emitWarning = originalEmitWarning
  }

  return rrHelpers
}

async function loadAppUtils() {
  if (appUtils) return appUtils

  const originalEmitWarning = process.emitWarning
  process.emitWarning = function emitWarningWithoutTypelessPackageJson(warning, ...args) {
    const message = typeof warning === 'string' ? warning : warning?.message
    const code = warning?.code || args.find(arg => arg?.code)?.code
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || message?.includes('MODULE_TYPELESS_PACKAGE_JSON')) return
    return originalEmitWarning.call(process, warning, ...args)
  }

  try {
    appUtils = await import('../lib/utils.ts')
  } finally {
    process.emitWarning = originalEmitWarning
  }

  return appUtils
}

function supabaseProjectRefFromUrl(value) {
  if (!value) return null

  try {
    const url = new URL(value)
    const hostParts = url.hostname.split('.')

    if (url.hostname.endsWith('.supabase.co')) {
      return hostParts[0] === 'db' ? hostParts[1] : hostParts[0]
    }

    if (url.hostname.endsWith('.pooler.supabase.com')) {
      const [databaseUser, projectRef] = decodeURIComponent(url.username).split('.')
      return databaseUser === 'postgres' && projectRef ? projectRef : null
    }
  } catch {
    return null
  }

  return null
}

function assertDevelopmentDatabaseUrl() {
  const appProjectRef = supabaseProjectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const databaseProjectRef = supabaseProjectRefFromUrl(process.env.DATABASE_URL)

  if (!appProjectRef || !databaseProjectRef || appProjectRef !== databaseProjectRef) {
    throw new Error(
      'Refusing to seed: DATABASE_URL does not match NEXT_PUBLIC_SUPABASE_URL. Point both at the same development Supabase project.',
    )
  }
}

function uuid(label) {
  const hash = crypto.createHash('sha1').update(`umd-grass-seed:${label}`).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function mulberry32(seed) {
  return function next() {
    let t = seed += 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickDistinct(rng, items, count) {
  const copy = [...items]
  const picked = []
  while (picked.length < count) {
    const index = Math.floor(rng() * copy.length)
    picked.push(copy.splice(index, 1)[0])
  }
  return picked
}

function pointDiff(sets) {
  return Math.abs(
    sets.reduce((total, set) => total + set.team1 - set.team2, 0),
  )
}

function makeSetScores(rng, team1Won) {
  const loserTakesSet = rng() < 0.28
  const winnerSetPattern = loserTakesSet
    ? (rng() < 0.5 ? [true, false, true] : [false, true, true])
    : [true, true]

  return winnerSetPattern.map(winnerWonSet => {
    const setWonByTeam1 = team1Won ? winnerWonSet : !winnerWonSet
    const deuce = rng() < 0.12
    const winnerScore = deuce ? 22 + Math.floor(rng() * 4) : 21
    const loserScore = deuce
      ? winnerScore - 2
      : 12 + Math.floor(rng() * 8)

    return setWonByTeam1
      ? { team1: winnerScore, team2: loserScore }
      : { team1: loserScore, team2: winnerScore }
  })
}

function dateBetween(startIso, endIso, index, total, rng) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const spacing = (end - start) / total
  const jitter = (rng() - 0.5) * spacing * 0.55
  return new Date(start + spacing * index + jitter)
}

function createPlayers() {
  const adminId = adminUserId()
  const { isAdmin } = appUtils
  const players = []

  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    const isSeedAdmin = i === 0
    const id = isSeedAdmin ? adminId : uuid(`player-${i}`)

    players.push({
      id,
      name: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
      email: `player${String(i).padStart(2, '0')}@umdgrass.test`,
      avatar_url: null,
      is_deleted: false,
      is_tournament_admin: isAdmin(id) || i === 1 || i === 2,
      created_at: new Date(Date.UTC(2025, 11, 15 + (i % 10), 14, i)),
      seed_skill: BASE_RR + Math.round(Math.sin(i * 1.7) * 155 + Math.cos(i * 0.63) * 105),
    })
  }

  return players
}

function createSeasons() {
  return [
    {
      id: uuid('season-spring-2026'),
      name: 'Spring 2026',
      is_active: false,
      started_at: new Date('2026-01-15T05:00:00.000Z'),
      ended_at: new Date('2026-05-20T04:00:00.000Z'),
      matchStart: '2026-01-18T18:00:00.000Z',
      matchEnd: '2026-05-10T23:00:00.000Z',
    },
    {
      id: uuid('season-summer-2026'),
      name: 'Summer 2026',
      is_active: true,
      started_at: new Date('2026-06-01T04:00:00.000Z'),
      ended_at: new Date('2026-08-20T04:00:00.000Z'),
      matchStart: '2026-06-03T18:00:00.000Z',
      matchEnd: '2026-07-18T23:00:00.000Z',
    },
  ]
}

function freshStats(players, seasonId, previousStatsByUserId) {
  const { applySeasonDecay } = rrHelpers
  const stats = new Map()
  for (const player of players) {
    const previous = previousStatsByUserId?.get(player.id)
    const startingRr = previous
      ? applySeasonDecay(previous.rr)
      : Math.max(700, Math.round(player.seed_skill))

    stats.set(player.id, {
      id: uuid(`season-stat-${seasonId}-${player.id}`),
      user_id: player.id,
      season_id: seasonId,
      starting_rr: startingRr,
      rr: startingRr,
      games_played: 0,
      wins: 0,
      losses: 0,
    })
  }
  return stats
}

function simulateSeason({ rng, players, season, statsByUserId, matchOffset }) {
  const { calculateRrChange, expectedScore } = rrHelpers
  const matches = []
  const rrChanges = []

  for (let i = 0; i < MATCHES_PER_SEASON; i += 1) {
    const [a, b, c, d] = pickDistinct(rng, players, 4)
    const team1 = [a, b]
    const team2 = [c, d]
    const team1Stats = team1.map(player => statsByUserId.get(player.id))
    const team2Stats = team2.map(player => statsByUserId.get(player.id))
    const team1Rr = (team1Stats[0].rr + team1Stats[1].rr) / 2
    const team2Rr = (team2Stats[0].rr + team2Stats[1].rr) / 2
    const team1Skill = (a.seed_skill + b.seed_skill) / 2
    const team2Skill = (c.seed_skill + d.seed_skill) / 2
    const winProbability = expectedScore(team1Skill, team2Skill, SEED_RR_CONFIG.scale)
    const team1Won = rng() < winProbability
    const setScores = makeSetScores(rng, team1Won)
    const team1Sets = setScores.filter(set => set.team1 > set.team2).length
    const team2Sets = setScores.length - team1Sets
    const actualA = team1Won ? 1 : 0
    // The match schedule, teams, and outcomes are synthetic seed data, but RR
    // deltas reuse the app's Elo helper so formula changes stay in sync.
    const rawDelta = calculateRrChange(
      team1Rr,
      team2Rr,
      actualA,
      pointDiff(setScores),
      SEED_RR_CONFIG,
    )
    const playedAt = dateBetween(season.matchStart, season.matchEnd, i + 1, MATCHES_PER_SEASON + 1, rng)
    const submittedAt = new Date(playedAt.getTime() + 1000 * 60 * (20 + Math.floor(rng() * 180)))
    const verifiedAt = new Date(submittedAt.getTime() + 1000 * 60 * (15 + Math.floor(rng() * 240)))
    const matchId = uuid(`match-${season.id}-${i}`)

    matches.push({
      id: matchId,
      season_id: season.id,
      submitted_by: a.id,
      team1_player1_id: a.id,
      team1_player2_id: b.id,
      team2_player1_id: c.id,
      team2_player2_id: d.id,
      set_scores: setScores,
      team1_sets: team1Sets,
      team2_sets: team2Sets,
      status: 'CONFIRMED',
      verified_by: c.id,
      verified_at: verifiedAt,
      submitted_at: submittedAt,
      expires_at: new Date(submittedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      played_at: playedAt,
    })

    const updates = [
      { player: a, stats: team1Stats[0], won: team1Won, delta: rawDelta },
      { player: b, stats: team1Stats[1], won: team1Won, delta: rawDelta },
      { player: c, stats: team2Stats[0], won: !team1Won, delta: -rawDelta },
      { player: d, stats: team2Stats[1], won: !team1Won, delta: -rawDelta },
    ]

    for (const update of updates) {
      const rrBefore = update.stats.rr
      const roundedDelta = Math.round(update.delta)
      const rrAfter = Math.max(0, rrBefore + roundedDelta)

      update.stats.rr = rrAfter
      update.stats.games_played += 1
      update.stats.wins += update.won ? 1 : 0
      update.stats.losses += update.won ? 0 : 1

      rrChanges.push({
        id: uuid(`rr-change-${season.id}-${i}-${update.player.id}`),
        match_id: matchId,
        user_id: update.player.id,
        season_id: season.id,
        delta: roundedDelta,
        rr_before: rrBefore,
        rr_after: rrAfter,
        created_at: verifiedAt,
      })
    }
  }

  return { matches, rrChanges, finalStats: [...statsByUserId.values()], nextMatchOffset: matchOffset + MATCHES_PER_SEASON }
}

function createCourts(players, adminId) {
  const courts = ['Court 1', 'Court 2', 'Court 3'].map((name, index) => ({
    id: uuid(`court-${index}`),
    name,
    created_by: adminId,
    created_at: new Date(Date.UTC(2026, 6, 19, 16, index * 10)),
  }))

  const queueEntries = []
  let playerIndex = 4
  for (let courtIndex = 0; courtIndex < courts.length; courtIndex += 1) {
    for (let position = 1; position <= 4; position += 1) {
      const player1 = players[playerIndex % players.length]
      const player2 = players[(playerIndex + 1) % players.length]
      queueEntries.push({
        id: uuid(`queue-${courtIndex}-${position}`),
        court_id: courts[courtIndex].id,
        player1_id: player1.id,
        player2_id: player2.id,
        position,
        created_at: new Date(Date.UTC(2026, 6, 19, 17, courtIndex * 10 + position)),
      })
      playerIndex += 2
    }
  }

  return { courts, queueEntries }
}

function tournamentSetScores(seed, team1Won) {
  const rng = mulberry32(seed)
  return makeSetScores(rng, team1Won)
}

function createTournament(players, adminId) {
  const tournament = {
    id: TOURNAMENT_ID,
    name: 'UMD Grass Summer Classic',
    created_at: new Date('2026-07-12T14:00:00.000Z'),
  }

  const pools = []
  const teams = []
  const games = []
  const playoffGames = []
  let orderIndex = 1
  let playerCursor = 0

  for (const division of ['AA', 'BB']) {
    for (let poolNumber = 1; poolNumber <= 2; poolNumber += 1) {
      const pool = {
        id: uuid(`pool-${division}-${poolNumber}`),
        tournament_id: tournament.id,
        division,
        name: `Pool ${poolNumber}`,
      }
      pools.push(pool)

      const poolTeams = []
      for (let teamNumber = 1; teamNumber <= 4; teamNumber += 1) {
        const p1 = players[playerCursor % players.length]
        const p2 = players[(playerCursor + 1) % players.length]
        const team = {
          id: uuid(`team-${division}-${poolNumber}-${teamNumber}`),
          pool_id: pool.id,
          name: `${p1.name.split(' ')[0]} / ${p2.name.split(' ')[0]}`,
        }
        teams.push(team)
        poolTeams.push(team)
        playerCursor += 2
      }

      for (let i = 0; i < poolTeams.length; i += 1) {
        for (let j = i + 1; j < poolTeams.length; j += 1) {
          const complete = orderIndex <= 16
          const live = orderIndex === 17
          const team1Won = (orderIndex + i + j) % 2 === 0
          games.push({
            id: uuid(`tournament-game-${division}-${poolNumber}-${i}-${j}`),
            pool_id: pool.id,
            team1_id: poolTeams[i].id,
            team2_id: poolTeams[j].id,
            status: complete ? 'complete' : live ? 'live' : 'pending',
            set_scores: complete ? tournamentSetScores(9000 + orderIndex, team1Won) : [],
            live_score: live ? { team1: 12, team2: 9 } : null,
            order_index: orderIndex,
            created_at: new Date(Date.UTC(2026, 6, 12, 15, orderIndex)),
            scored_by: complete ? adminId : null,
          })
          orderIndex += 1
        }
      }
    }

    const divisionTeams = teams.filter(team => pools.some(pool => pool.id === team.pool_id && pool.division === division))
    const semifinalOne = [divisionTeams[0], divisionTeams[5]]
    const semifinalTwo = [divisionTeams[2], divisionTeams[7]]
    playoffGames.push(
      {
        id: uuid(`playoff-${division}-semi-1`),
        tournament_id: tournament.id,
        division,
        round: 'semifinal',
        label: `${division} Semifinal 1`,
        team1_id: semifinalOne[0].id,
        team2_id: semifinalOne[1].id,
        team1_source: 'Pool 1 winner',
        team2_source: 'Pool 2 runner-up',
        status: 'complete',
        set_scores: tournamentSetScores(11000 + playoffGames.length, true),
        live_score: null,
        order_index: playoffGames.length + 1,
        created_at: new Date(Date.UTC(2026, 6, 12, 20, playoffGames.length)),
      },
      {
        id: uuid(`playoff-${division}-semi-2`),
        tournament_id: tournament.id,
        division,
        round: 'semifinal',
        label: `${division} Semifinal 2`,
        team1_id: semifinalTwo[0].id,
        team2_id: semifinalTwo[1].id,
        team1_source: 'Pool 2 winner',
        team2_source: 'Pool 1 runner-up',
        status: division === 'AA' ? 'live' : 'pending',
        set_scores: [],
        live_score: division === 'AA' ? { team1: 17, team2: 15 } : null,
        order_index: playoffGames.length + 2,
        created_at: new Date(Date.UTC(2026, 6, 12, 20, playoffGames.length + 1)),
      },
      {
        id: uuid(`playoff-${division}-final`),
        tournament_id: tournament.id,
        division,
        round: 'final',
        label: `${division} Final`,
        team1_id: semifinalOne[0].id,
        team2_id: null,
        team1_source: `${division} Semifinal 1 winner`,
        team2_source: `${division} Semifinal 2 winner`,
        status: 'pending',
        set_scores: [],
        live_score: null,
        order_index: playoffGames.length + 3,
        created_at: new Date(Date.UTC(2026, 6, 12, 21, playoffGames.length)),
      },
    )
  }

  return { tournament, pools, teams, games, playoffGames }
}

async function bulkInsert(sql, tableName, rows) {
  if (rows.length === 0) return
  await sql`insert into ${sql(tableName)} ${sql(rows)}`
}

async function main() {
  assertSafeEnvironment()
  await loadRrHelpers()
  await loadAppUtils()

  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false,
    ssl: 'require',
  })

  const rng = mulberry32(20260719)
  const players = createPlayers()
  const seasons = createSeasons()
  const adminId = players[0].id
  const allMatches = []
  const allRrChanges = []
  const allStats = []
  let previousStats = null
  let matchOffset = 0

  for (const season of seasons) {
    const stats = freshStats(players, season.id, previousStats)
    const simulated = simulateSeason({
      rng,
      players,
      season,
      statsByUserId: stats,
      matchOffset,
    })
    allMatches.push(...simulated.matches)
    allRrChanges.push(...simulated.rrChanges)
    allStats.push(...simulated.finalStats)
    previousStats = new Map(simulated.finalStats.map(stat => [stat.user_id, stat]))
    matchOffset = simulated.nextMatchOffset
  }

  const { courts, queueEntries } = createCourts(players, adminId)
  const tournament = createTournament(players, adminId)

  await sql.begin(async tx => {
    await tx.unsafe(`truncate table ${APP_TABLES.map(table => `"${table}"`).join(', ')} restart identity cascade`)
    await bulkInsert(tx, 'users', players.map(({ seed_skill, ...player }) => player))
    await bulkInsert(tx, 'seasons', seasons.map(({ matchStart, matchEnd, ...season }) => season))
    await bulkInsert(tx, 'matches', allMatches)
    await bulkInsert(tx, 'season_stats', allStats)
    await bulkInsert(tx, 'rr_changes', allRrChanges)
    await bulkInsert(tx, 'courts', courts)
    await bulkInsert(tx, 'court_queue_entries', queueEntries)
    await bulkInsert(tx, 'tournaments', [tournament.tournament])
    await bulkInsert(tx, 'tournament_pools', tournament.pools)
    await bulkInsert(tx, 'tournament_teams', tournament.teams)
    await bulkInsert(tx, 'tournament_games', tournament.games)
    await bulkInsert(tx, 'tournament_playoff_games', tournament.playoffGames)
  })

  const summary = await sql`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from seasons) as seasons,
      (select count(*)::int from matches) as matches,
      (select count(*)::int from season_stats) as season_stats,
      (select count(*)::int from rr_changes) as rr_changes,
      (select count(*)::int from tournaments) as tournaments,
      (select count(*)::int from tournament_games) as tournament_games,
      (select count(*)::int from tournament_playoff_games) as tournament_playoff_games,
      (select count(*)::int from courts) as courts,
      (select count(*)::int from court_queue_entries) as queue_entries
  `

  await sql.end()

  const row = summary[0]
  console.log('Seed complete:')
  console.log(`  admin user: ${players[0].name} <${players[0].email}> (${players[0].id})`)
  console.log(`  users: ${row.users}`)
  console.log(`  seasons: ${row.seasons}`)
  console.log(`  matches: ${row.matches}`)
  console.log(`  season_stats: ${row.season_stats}`)
  console.log(`  rr_changes: ${row.rr_changes}`)
  console.log(`  tournaments: ${row.tournaments}`)
  console.log(`  tournament games: ${row.tournament_games}`)
  console.log(`  playoff games: ${row.tournament_playoff_games}`)
  console.log(`  courts: ${row.courts}`)
  console.log(`  queue entries: ${row.queue_entries}`)

}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
