import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
  rr: integer('rr').notNull().default(800),        // current visible RR
  hiddenMmr: integer('hidden_mmr').notNull().default(800),
  gamesPlayed: integer('games_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  /** Flips to true after 5 confirmed games — RR becomes public */
  isRevealed: boolean('is_revealed').notNull().default(false),
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

  // Score — sets won by each team (e.g. 2-1 in a best-of-3)
  team1Sets: integer('team1_sets').notNull(),
  team2Sets: integer('team2_sets').notNull(),

  status: matchStatusEnum('status').notNull().default('PENDING'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // submittedAt + 7 days
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
