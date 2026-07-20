# AGENTS.md

This file is the primary working guide for future coding agents in this repository. It reflects the current implementation, not the older project notes in CLAUDE.md.

# Project Overview

- This is a Next.js 16 App Router application for UMD grass volleyball rankings.
- The app tracks doubles matches, computes RR/ELO-style ranking changes, manages seasons, and exposes player-facing and admin-facing views.
- Supabase provides authentication, storage, and Postgres; Drizzle ORM is used for database access; Tailwind CSS and shadcn/ui provide the UI layer.
- The architecture is a hybrid of server components, client components, and route handlers. Server components load initial data, client components handle interaction, and API routes own mutations and business workflows.

# Repository Structure

## Major folders

- [app/](app) contains the Next.js App Router tree.
  - [app/(auth)/](app/(auth)) contains login, signup, verification, password reset, and auth-only layout pages.
  - [app/(app)/](app/(app)) contains authenticated application pages such as dashboard, leaderboard, profile, players, submit-match, queue, admin, tournament, and tournament-admin.
  - [app/api/](app/api) contains the server-side route handlers for matches, users, seasons, leaderboard, courts, tournaments, admin maintenance, and auth utilities.
  - [app/auth/callback/](app/auth/callback) handles Supabase OAuth/email recovery callback exchange.
  - [app/~offline/](app/~offline) provides the offline fallback page used by the PWA layer.
- [components/](components) contains reusable UI and feature components.
  - [components/ui/](components/ui) contains shadcn/ui primitives; treat these as framework-level building blocks.
  - Feature components such as [components/navbar.tsx](components/navbar.tsx), [components/match-card.tsx](components/match-card.tsx), [components/player-card.tsx](components/player-card.tsx), [components/leaderboard-row.tsx](components/leaderboard-row.tsx), [components/mini-leaderboard.tsx](components/mini-leaderboard.tsx), [components/season-selector.tsx](components/season-selector.tsx), and [components/verification-card.tsx](components/verification-card.tsx) render the actual product surfaces.
- [lib/](lib) contains business logic and shared infrastructure.
  - [lib/db.ts](lib/db.ts) is the Drizzle/Postgres singleton.
  - [lib/supabase-server.ts](lib/supabase-server.ts) and [lib/supabase-browser.ts](lib/supabase-browser.ts) create the Supabase clients for server and client use.
  - [lib/elo.ts](lib/elo.ts), [lib/match-engine.ts](lib/match-engine.ts), [lib/apply-confirmed-match.ts](lib/apply-confirmed-match.ts), and [lib/recalculate-rr.ts](lib/recalculate-rr.ts) own the ranking logic.
  - [lib/user-season.ts](lib/user-season.ts) centralizes current-season stat and rank lookup for profile-related pages and routes.
  - [lib/leaderboard.ts](lib/leaderboard.ts) builds leaderboard rows and rank trends.
  - [lib/tournament-admin.ts](lib/tournament-admin.ts) centralizes tournament permission checks.
  - [lib/utils.ts](lib/utils.ts) contains generic helpers such as `cn()`, initials formatting, and admin ID checks.
  - [lib/types.ts](lib/types.ts) defines the shared DTOs used across the app and API routes.
- [drizzle/](drizzle) contains the schema and migrations.
  - [drizzle/schema.ts](drizzle/schema.ts) is the source of truth for tables and enums.
  - [drizzle/migrations/](drizzle/migrations) contains generated migration history.
- [public/](public) contains static assets such as the manifest and icons.
- [scripts/](scripts) contains maintenance scripts, including RR recalculation tooling.
- [supabase/](supabase) contains SQL used for Supabase-side operational tasks, such as the match expiry cron job.

## How the layers interact

- Frontend pages are split into server components for data loading and client components for interactivity.
- Route handlers under [app/api/](app/api) are the mutation boundary. They validate requests, authenticate users via Supabase, call business helpers, and persist to Postgres through Drizzle.
- Business rules live in [lib/](lib), not in React components or route handlers unless the logic is truly request-specific.
- Database access should go through [lib/db.ts](lib/db.ts) and Drizzle queries. Avoid scattering raw SQL or duplicating query shape logic across pages.
- React components should remain presentation-focused and should not contain ranking math, permission policy, or database mutation rules.

# Data Model

## Important tables

- `users` stores the public profile mirrored from Supabase Auth.
- `seasons` stores season metadata and the active/inactive flag.
- `season_stats` stores one row per user per season with RR, wins, losses, and games played.
- `matches` stores submitted doubles matches, verification state, timestamps, and set scores.
- `rr_changes` stores per-player RR deltas for confirmed matches.
- `courts` stores queue groups for the court subsystem.
- `court_queue_entries` stores queued teams per court.
- `tournaments`, `tournament_pools`, `tournament_teams`, `tournament_games`, and `tournament_playoff_games` store the tournament workflow data.

## Relationships

- `season_stats.userId` references `users.id`.
- `season_stats.seasonId` references `seasons.id`.
- `matches.seasonId` references `seasons.id`.
- `matches.submittedBy`, `team1Player1Id`, `team1Player2Id`, `team2Player1Id`, and `team2Player2Id` all reference `users.id`.
- `rr_changes.matchId` references `matches.id`.
- `rr_changes.userId` references `users.id`.
- `courts.createdBy` references `users.id`.
- `court_queue_entries.courtId` references `courts.id` and player IDs reference `users.id`.
- Tournament tables reference `tournaments`, `tournament_pools`, and `tournament_teams` as expected.

## Core entities

- A match is always a 2v2 doubles match.
- Team 1 is the submitting team; Team 2 is the opposing team that verifies the result.
- RR is stored per player per season, not globally.
- RR change history is preserved in `rr_changes`.
- A season can be active or inactive, but only one active season should exist at a time.

## Season and ranking concepts

- RR is visible immediately. There is no hidden MMR state.
- Placement is controlled by `PLACEMENT_GAMES` in [lib/elo.ts](lib/elo.ts) and the placement logic in [lib/match-engine.ts](lib/match-engine.ts).
- Season transitions are handled by [app/api/seasons/route.ts](app/api/seasons/route.ts): the active season is closed, RR is decayed, and the new season is seeded.
- RR decay uses [lib/elo.ts](lib/elo.ts) `applySeasonDecay()`.

# Request Lifecycle

## Authentication

1. Requests enter through the app routes and proxy layer.
2. [proxy.ts](proxy.ts) refreshes Supabase sessions and redirects unauthenticated users away from protected pages.
3. Server components use [lib/supabase-server.ts](lib/supabase-server.ts) to read the current session.
4. Client components use [lib/supabase-browser.ts](lib/supabase-browser.ts) for browser auth interactions.
5. Signup and login live under [app/(auth)/](app/(auth)). Signup verifies email, then [app/api/users/route.ts](app/api/users/route.ts) inserts the mirrored public user row.
6. [app/auth/callback/route.ts](app/auth/callback/route.ts) exchanges recovery or login codes for a session and redirects into the app.

## Match submission

1. The submit page is [app/(app)/submit-match/page.tsx](app/(app)/submit-match/page.tsx).
2. It fetches the current user list, the user’s matches, and the active season.
3. The form collects teammate, opponents, played date/time, and set scores.
4. The client posts to [app/api/matches/route.ts](app/api/matches/route.ts).
5. The route validates required fields, ensures all four players differ, verifies sets are valid, confirms an active season exists, computes `playedAt`, and inserts a `PENDING` match with an expiration timestamp.

## Match verification

1. Pending matches appear in [app/(app)/submit-match/page.tsx](app/(app)/submit-match/page.tsx), [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx), and [components/verification-card.tsx](components/verification-card.tsx).
2. Verification is sent to [app/api/matches/[id]/verify/route.ts](app/api/matches/[id]/verify/route.ts).
3. The route authenticates the user, loads the match, and checks that the user is either an admin or on the opposing team.
4. Reject sets the match to `REJECTED`.
5. Confirm sets the match to `CONFIRMED`, records who verified it, and updates RR by calling either [lib/apply-confirmed-match.ts](lib/apply-confirmed-match.ts) or [lib/recalculate-rr.ts](lib/recalculate-rr.ts) depending on whether the match is the newest confirmed match.

## RR/ELO calculation

1. Core math lives in [lib/elo.ts](lib/elo.ts).
2. Match-by-match mutation logic lives in [lib/match-engine.ts](lib/match-engine.ts).
3. Incremental application for a single confirmed match lives in [lib/apply-confirmed-match.ts](lib/apply-confirmed-match.ts).
4. Full season recomputation lives in [lib/recalculate-rr.ts](lib/recalculate-rr.ts).
5. RR deltas are persisted in `season_stats` and `rr_changes` inside transactions.

## Leaderboard generation

1. The server route is [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts).
2. Shared row building logic is in [lib/leaderboard.ts](lib/leaderboard.ts).
3. Season leaderboard rows are pulled from `season_stats` joined with `users`, filtered to ranked players only, and sorted by RR.
4. Trend data is derived from the latest `rr_changes` row for each player.
5. The dashboard uses [lib/leaderboard.ts](lib/leaderboard.ts) through [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx), and the leaderboard page uses the same data model through [app/(app)/leaderboard/page.tsx](app/(app)/leaderboard/page.tsx).

## User profile loading

1. The profile page is [app/(app)/profile/page.tsx](app/(app)/profile/page.tsx).
2. It loads the current user, all seasons, and all `season_stats` rows for that user.
3. It deduplicates season rows by season and calculates lifetime totals client-side on the server component.
4. Current-season rank is calculated from RR against other ranked players.
5. The player detail page [app/(app)/players/[id]/page.tsx](app/(app)/players/[id]/page.tsx) loads the public profile and match history for any user.
6. Match history for arbitrary users comes from [app/api/users/[id]/matches/route.ts](app/api/users/[id]/matches/route.ts), which reuses [app/api/matches/route.ts](app/api/matches/route.ts) `buildMatchesForUser()`.

## Tournament flow

1. The tournament page is [app/(app)/tournament/page.tsx](app/(app)/tournament/page.tsx), which renders the tournament client for authenticated users.
2. The tournament admin page is [app/(app)/tournament-admin/page.tsx](app/(app)/tournament-admin/page.tsx), which gates access through [lib/tournament-admin.ts](lib/tournament-admin.ts).
3. Pool and game data is served by [app/api/tournament/pools/route.ts](app/api/tournament/pools/route.ts).
4. Pool games move through live/score/admin-score/reset/cancel/make-current endpoints under [app/api/tournament/games/](app/api/tournament/games).
5. Playoff games move through live/score/admin-score/reset/cancel/start endpoints under [app/api/tournament/playoffs/](app/api/tournament/playoffs).
6. The tournament data model is stored in `tournaments`, `tournament_pools`, `tournament_teams`, `tournament_games`, and `tournament_playoff_games`.

## Court queue flow

1. The queue page is [app/(app)/queue/page.tsx](app/(app)/queue/page.tsx).
2. It loads courts and users from [app/api/courts/route.ts](app/api/courts/route.ts).
3. Creating a court posts to [app/api/courts/route.ts](app/api/courts/route.ts).
4. Joining a queue posts to [app/api/courts/[courtId]/queue/route.ts](app/api/courts/[courtId]/queue/route.ts).
5. Advancing the queue posts to [app/api/courts/[courtId]/next/route.ts](app/api/courts/[courtId]/next/route.ts).
6. Queue entries are stored in `court_queue_entries` and ordered by `position`.

# Core Business Logic

- RR calculation lives in [lib/elo.ts](lib/elo.ts), [lib/match-engine.ts](lib/match-engine.ts), [lib/apply-confirmed-match.ts](lib/apply-confirmed-match.ts), and [lib/recalculate-rr.ts](lib/recalculate-rr.ts).
- Match processing occurs in [app/api/matches/route.ts](app/api/matches/route.ts) and [app/api/matches/[id]/verify/route.ts](app/api/matches/[id]/verify/route.ts).
- Leaderboard generation occurs in [lib/leaderboard.ts](lib/leaderboard.ts) and [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts).
- User stats are calculated in [app/(app)/profile/page.tsx](app/(app)/profile/page.tsx), [app/api/users/me/route.ts](app/api/users/me/route.ts), [app/api/users/[id]/route.ts](app/api/users/[id]/route.ts), and [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts).
- Permission checks happen in [lib/utils.ts](lib/utils.ts) `isAdmin()`, [lib/tournament-admin.ts](lib/tournament-admin.ts) `canManageTournament()`, [proxy.ts](proxy.ts), [app/(app)/admin/page.tsx](app/(app)/admin/page.tsx), and [app/(app)/tournament-admin/page.tsx](app/(app)/tournament-admin/page.tsx).

# Important Files

| file | purpose | when to modify it |
|---|---|---|
| [drizzle/schema.ts](drizzle/schema.ts) | Database schema and table definitions | When adding or changing tables, columns, enums, or relationships |
| [lib/db.ts](lib/db.ts) | Drizzle/Postgres singleton | When changing database connection behavior |
| [lib/supabase-server.ts](lib/supabase-server.ts) | Server-side Supabase clients and session helpers | When auth/session behavior changes on the server |
| [lib/supabase-browser.ts](lib/supabase-browser.ts) | Client-side Supabase client | When client auth behavior changes |
| [lib/elo.ts](lib/elo.ts) | Core RR math and season decay | When ranking formulas change |
| [lib/match-engine.ts](lib/match-engine.ts) | Per-match RR application and placement logic | When match delta rules change |
| [lib/apply-confirmed-match.ts](lib/apply-confirmed-match.ts) | Incremental match confirmation update | When confirmed-match processing changes |
| [lib/recalculate-rr.ts](lib/recalculate-rr.ts) | Full-season recomputation | When the repair/rebuild flow changes |
| [lib/user-season.ts](lib/user-season.ts) | Shared current-season stat and rank lookup | When profile/rank lookup rules change |
| [lib/leaderboard.ts](lib/leaderboard.ts) | Leaderboard query logic and rank trends | When leaderboard output changes |
| [lib/utils.ts](lib/utils.ts) | Shared helpers and admin checks | When permission logic or helper behavior changes |
| [lib/tournament-admin.ts](lib/tournament-admin.ts) | Tournament permission policy | When tournament access rules change |
| [app/api/matches/route.ts](app/api/matches/route.ts) | Match submission and match-list query logic | When match submission or match serialization changes |
| [app/api/matches/[id]/verify/route.ts](app/api/matches/[id]/verify/route.ts) | Match verification workflow | When confirmation/rejection rules change |
| [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts) | Leaderboard API endpoint | When leaderboard response shape changes |
| [app/api/seasons/route.ts](app/api/seasons/route.ts) | Season listing and season creation | When season lifecycle changes |
| [app/api/users/route.ts](app/api/users/route.ts) | Public user list and public user row creation | When user provisioning or list shape changes |
| [app/api/users/me/route.ts](app/api/users/me/route.ts) | Current-user profile update and read | When profile edit behavior changes |
| [app/api/users/[id]/route.ts](app/api/users/[id]/route.ts) | Public profile read and admin edit/delete | When public profile or admin user management changes |
| [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx) | Main authenticated landing page | When dashboard composition changes |
| [app/(app)/leaderboard/page.tsx](app/(app)/leaderboard/page.tsx) | Leaderboard page | When leaderboard UI changes |
| [app/(app)/profile/page.tsx](app/(app)/profile/page.tsx) | Profile page and lifetime summary | When profile UI or aggregate stats change |
| [app/(app)/submit-match/page.tsx](app/(app)/submit-match/page.tsx) | Match submission and verification UI | When the match workflow UI changes |
| [app/(app)/queue/page.tsx](app/(app)/queue/page.tsx) | Court queue UI | When queue behavior changes |
| [app/(app)/admin/admin-client.tsx](app/(app)/admin/admin-client.tsx) | Admin maintenance UI | When admin workflows change |
| [app/(app)/tournament/tournament-client.tsx](app/(app)/tournament/tournament-client.tsx) | Tournament user experience | When tournament scoring flows change |
| [app/(app)/tournament-admin/tournament-admin-client.tsx](app/(app)/tournament-admin/tournament-admin-client.tsx) | Tournament admin controls | When tournament admin flows change |

# Architectural Principles

- Keep business logic in [lib/](lib) and keep React components focused on rendering and user interaction.
- Keep database access in Drizzle-based route handlers or server components, not inside generic UI components.
- Keep request validation and permission checks close to the route boundary, then hand off to shared helpers for the actual rule implementation.
- Prefer server components for read-heavy pages and client components only where interactivity is required.
- Keep API contracts stable. When a response shape changes, update the shared types in [lib/types.ts](lib/types.ts).
- Reuse shared helpers instead of copying query shapes or ranking calculations into multiple pages.

# Refactoring Guidelines

- Prefer extracting shared helpers over rewriting feature areas.
- If two pages or routes need the same query shape, create one shared helper in [lib/](lib) and call it from both places.
- Move ranking, season, and permission rules into shared modules before they spread into route handlers.
- Keep request handlers thin: validate, authorize, call helper, persist, return response.
- Keep React components presentation-only. If a component starts doing business logic, move that logic into [lib/](lib) or the nearest route helper.
- When updating a workflow, update the shared DTOs in [lib/types.ts](lib/types.ts) alongside the route and the UI.

# Testing Checklist

Automated tests are limited, so manually verify the major flows after changes:

- Sign up, log in, verify email, and confirm the session persists.
- Submit a match and confirm it appears as pending for the submitting team.
- Verify a match from the opposing team and confirm RR updates on the dashboard, leaderboard, profile, and player pages.
- Reject a pending match and confirm it disappears from the verification flow.
- Create a season as an admin and confirm RR decay and leaderboard reset behavior.
- Edit a profile photo and confirm the avatar updates everywhere.
- Use the court queue to create a court, join the queue, advance the queue, and remove entries.
- Exercise tournament scoring and confirm the client and admin pages stay in sync with the API routes.
- Run `npm test`, `npm run lint`, and `npm run build` before shipping changes.

# Agent Instructions

- Preserve behavior.
- Make small, isolated commits.
- Avoid changing business logic unless requested.
- Keep API contracts stable.
- Prefer refactoring over rewriting.
- Run build, lint, and typecheck after changes.
- Explain architectural decisions before large refactors.

## Change Strategy

- Do not combine correctness fixes, architectural refactors, and visual redesigns
  in the same change.
- Prefer one feature boundary per change.
- Before moving code, characterize current behavior with tests.
- Refactors must preserve response shapes unless the task explicitly changes them.
- Avoid introducing abstractions used by only one simple call site.
- Do not replace working server components with client components without a
  demonstrated interaction requirement.

## Transaction Rules

- Match status changes and their associated RR mutations must be atomic.
- All confirmed-match processing must use the match's stored seasonId.
- Ranking helpers participating in a larger workflow should accept a transaction
  context rather than opening independent transactions.
- Match confirmation must be idempotent.
- Database constraints should protect assumptions relied upon by application code.

## UI Rules

- Design mobile-first.
- Avoid nested cards.
- Use cards only for elevated or independently actionable content.
- Every async interface must provide loading, empty, error, and success states.
- Preserve keyboard navigation and visible focus states.
- Shared sports entities should use shared components rather than page-local markup.

## Definition of Done

- Tests pass.
- Type checking passes.
- Linting passes.
- Production build passes.
- New business logic has automated tests.
- Changed workflows have been manually exercised.
- No unrelated formatting or restructuring is included.
