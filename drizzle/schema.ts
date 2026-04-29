import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
// boolean is used by seasons.isActive

export type SetScore = { team1: number; team2: number }

// ─── Enums ───────────────────────────────────────────────────────────────────

export const matchStatusEnum = pgEnum('match_status', [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'EXPIRED',
])

// ─── Tables ──────────────────────────────────────────────────────────────────

/**
 * Mirrors Supabase Auth users. Row is inserted on signup.
 * `id` is the Supabase Auth UUID.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches auth.users.id
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatarUrl: text('avatar_url'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  isTournamentAdmin: boolean('is_tournament_admin').notNull().default(false),
})

/**
 * One row per season (year). Only one season is active at a time.
 */
export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),        // e.g. "Spring 2025"
  isActive: boolean('is_active').notNull().default(false),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
})

/**
 * Per-player per-season stats. Created when a player's first match in a
 * season is confirmed, or when an admin seeds hidden MMR for a new season.
 */
export const seasonStats = pgTable('season_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  rr: integer('rr').notNull().default(800),
  gamesPlayed: integer('games_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
})

/**
 * One row per submitted doubles match (2v2).
 * team1 = submitting team, team2 = opposing team.
 */
export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  submittedBy: uuid('submitted_by').notNull().references(() => users.id),

  // Team 1 (submitting)
  team1Player1Id: uuid('team1_player1_id').notNull().references(() => users.id),
  team1Player2Id: uuid('team1_player2_id').notNull().references(() => users.id),

  // Team 2 (opposing / verifying)
  team2Player1Id: uuid('team2_player1_id').notNull().references(() => users.id),
  team2Player2Id: uuid('team2_player2_id').notNull().references(() => users.id),

  // Per-set point scores, e.g. [{team1: 21, team2: 15}, {team1: 18, team2: 21}]
  setScores: jsonb('set_scores').$type<SetScore[]>(),

  // Derived: sets won by each team (computed from setScores on submission)
  team1Sets: integer('team1_sets').notNull(),
  team2Sets: integer('team2_sets').notNull(),

  status: matchStatusEnum('status').notNull().default('PENDING'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // submittedAt + 7 days

  playedAt: timestamp('played_at', { withTimezone: true }).notNull(),

})

/**
 * One row per player per confirmed match — stores the RR delta.
 */
export const rrChanges = pgTable('rr_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  delta: integer('delta').notNull(),      // positive = gain, negative = loss
  rrBefore: integer('rr_before').notNull(),
  rrAfter: integer('rr_after').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})


export const courts = pgTable('courts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const courtQueueEntries = pgTable('court_queue_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  courtId: uuid('court_id').notNull().references(() => courts.id, { onDelete: 'cascade' }),

  player1Id: uuid('player1_id').notNull().references(() => users.id),
  player2Id: uuid('player2_id').notNull().references(() => users.id),

  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Tournament ───────────────────────────────────────────────────────────────

export const tournamentDivisionEnum = pgEnum('tournament_division', ['AA', 'BB'])
export const tournamentGameStatusEnum = pgEnum('tournament_game_status', ['pending', 'live', 'complete'])

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tournamentPools = pgTable('tournament_pools', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  division: tournamentDivisionEnum('division').notNull(),
  name: text('name').notNull(), // "Pool 1", "Pool 2", etc.
})

export const tournamentTeams = pgTable('tournament_teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => tournamentPools.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
})

export const tournamentGames = pgTable('tournament_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => tournamentPools.id, { onDelete: 'cascade' }),
  team1Id: uuid('team1_id').notNull().references(() => tournamentTeams.id),
  team2Id: uuid('team2_id').notNull().references(() => tournamentTeams.id),
  status: tournamentGameStatusEnum('status').notNull().default('pending'),
  setScores: jsonb('set_scores').$type<{ team1: number; team2: number }[]>().default([]),
  liveScore: jsonb('live_score').$type<{ team1: number; team2: number } | null>(),
  orderIndex: integer('order_index').notNull(), // controls game queue order
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  scoredBy: uuid('scored_by').references(() => users.id),
})

export type TournamentSetScore = {
  team1: number
  team2: number
}

export type TournamentLiveScore = {
  team1: number
  team2: number
}

export const tournamentPlayoffGames = pgTable('tournament_playoff_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),

  division: tournamentDivisionEnum('division').notNull(),

  round: text('round').notNull(), // play-in, quarterfinal, semifinal, final
  label: text('label').notNull(),

  team1Id: uuid('team1_id').references(() => tournamentTeams.id),
  team2Id: uuid('team2_id').references(() => tournamentTeams.id),

  team1Source: text('team1_source'),
  team2Source: text('team2_source'),

  status: tournamentGameStatusEnum('status').notNull().default('pending'),

  setScores: jsonb('set_scores')
    .$type<TournamentSetScore[]>()
    .default([]),

  liveScore: jsonb('live_score')
    .$type<TournamentLiveScore | null>(),

  orderIndex: integer('order_index').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})