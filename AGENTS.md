# AGENTS.md

This is the primary implementation guide for coding agents in this repository. It describes the current codebase. `README.md` is a short setup overview; `CLAUDE.md` contains older project notes and is not authoritative where it mentions TOTP, hidden MMR, `isRevealed`, or `middleware.ts`.

## Project overview

UMD Grass Rankings is a single-package Next.js PWA for doubles grass volleyball. Authenticated users can submit 2v2 matches, verify opponents' results, view seasonal and lifetime rankings, manage profiles and avatars, use court queues, and operate tournament scoring. Administrators can manage seasons, users, matches, and repair ranking data.

The application is full-stack:

- Next.js 16 App Router and React 19, with strict TypeScript.
- Server Components for most initial reads; Client Components for forms and interactive views.
- Next.js route handlers under `app/api/` for mutations and client-side data fetching.
- Supabase Auth and Storage; Supabase-hosted PostgreSQL accessed through Drizzle ORM.
- Tailwind CSS 4 and shadcn/Radix primitives.
- Vitest for the small existing unit-test suite.
- `@ducanh2912/next-pwa` for the service worker/offline fallback and Vercel Analytics in production.

There is no monorepo or npm workspace configuration.

## Repository map

- `app/`: App Router entry point.
  - `layout.tsx`: Geist fonts, theme provider, toaster, metadata, and production analytics.
  - `page.tsx`: redirects `/` to `/login`.
  - `(auth)/`: public login, signup, email OTP verification, forgot-password, and reset-password screens.
  - `(app)/`: authenticated product pages. `layout.tsx` adds the responsive navbar. Main routes are `dashboard`, `leaderboard`, `profile`, `players`, `submit-match`, `queue`, `admin`, `tournament`, and `tournament-admin`.
  - `api/`: route handlers grouped by matches, users, seasons, leaderboard, courts, tournaments, auth, permissions, and admin repair operations.
  - `auth/callback/route.ts`: exchanges Supabase recovery/login codes and writes session cookies to the redirect response.
  - `~offline/`: client-side PWA fallback.
- `components/`: shared product components such as `MatchCard`, `VerificationCard`, `PlayerCard`, `LeaderboardRow`, `MiniLeaderboard`, `SeasonSelector`, `DashboardPanel`, and `Navbar`.
  - `components/ui/`: shared shadcn/Radix primitives. Changes here affect the entire app; prefer composing a feature component unless a primitive itself needs to change.
- `hooks/`: shared browser hooks. `use-mobile.ts` handles responsive state; `use-realtime-refresh.ts` turns Supabase Postgres Change events into debounced API refetches.
- `lib/`: shared infrastructure and business logic.
  - `db.ts`: pooled Postgres/Drizzle singleton with `prepare: false` for Supabase's transaction pooler.
  - `supabase-browser.ts`, `supabase-server.ts`: browser, cookie-backed server, service-role, and session helpers.
  - `elo.ts`, `rr-config.ts`, `match-engine.ts`: pure RR math, tunable constants, placement rules, and per-match state transitions.
  - `apply-confirmed-match.ts`, `recalculate-rr.ts`, `match-verification.ts`, `is-most-recent-match.ts`: atomic confirmation and chronological replay workflows.
  - `leaderboard.ts`: cached server-side leaderboard query used by the dashboard/page.
  - `ranks.ts`: rank-tier, placement visibility, and win-rate display helpers.
  - `tournament-admin.ts`, `tournament-types.ts`, `utils.ts`: tournament authorization/models and generic UI helpers.
  - `types.ts`: shared API/feature DTOs. Database row types generally come from Drizzle's inferred schema types.
  - `resend.ts`, `blocked-email-domains.ts`: password-reset email delivery and signup email screening.
- `drizzle/schema.ts`: current Drizzle schema and TypeScript source of truth for table shapes.
- `drizzle/migrations/`: SQL migrations and Drizzle metadata; see the migration warning below before relying on them.
- `scripts/seed-dev.js`: destructive deterministic development seed.
- `scripts/recalculate-elo.ts`: standalone destructive replay script; it is not the production repair implementation and currently differs from `lib/recalculate-rr.ts`.
- `supabase/`: manual Supabase operational SQL. `expire-matches-cron.sql` installs pending-match expiry; `realtime-publication.sql` idempotently enables live match, ranking, and queue notifications.
- `public/`: PWA manifest, icons, and static images. The production PWA build also emits service-worker assets here.
- Root configuration: `proxy.ts`, `next.config.mjs`, `drizzle.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `components.json`, `vercel.json`, `.env.example`, and `.nvmrc`.

No `.github/workflows/`, CI configuration, formatter configuration, or nested instruction files currently exist.

### Feature ownership quick map

| Feature | Primary UI | API boundary | Shared logic/data |
|---|---|---|---|
| Authentication | `app/(auth)/*`, `app/auth/callback` | `/api/auth/forgot-password`, `/api/users` | Supabase helpers, `resend.ts`, `users` |
| Profiles/players | `profile`, `players`, `players/[id]` | `/api/users/**` | `lib/types.ts`, `season_stats`, avatar Storage |
| Matches and RR | `submit-match`, dashboard/profile match lists | `/api/matches/**` | `match-verification.ts`, match engine/replay helpers, `matches`, `rr_changes` |
| Leaderboards | `leaderboard`, dashboard mini leaderboard | `/api/leaderboard` | `lib/leaderboard.ts`, `season_stats`, cache tags |
| Seasons/admin | `admin` | `/api/seasons/**`, `/api/admin/**` | `applySeasonDecay()`, `recalculate-rr.ts` |
| Court queues | `queue` | `/api/courts/**` | `courts`, `court_queue_entries` |
| Tournament | `tournament`, `tournament-admin` | `/api/tournament/**` | `tournament-admin.ts`, `tournament-types.ts`, tournament tables |

`buildMatchesForUser()` currently lives in `app/api/matches/route.ts` and is reused by the dashboard and user-match route. Preserve that contract when making a narrow change; if reuse expands, move the query/serialization helper to `lib/` rather than adding more imports from a route module.

## Setup and commands

Use Node 20 (`.nvmrc`) and npm with the committed `package-lock.json`.

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Available commands:

```bash
npm run dev          # Next development server; PWA generation is disabled
npm run build        # production build, TypeScript check, and PWA generation
npm run start        # serve a completed production build
npm test             # Vitest once
npm run test:watch   # Vitest in watch mode
npx tsc --noEmit     # explicit type check; there is no typecheck npm script
npm run seed:dev     # destructive development database reset and seed
```

`npm run lint` is declared as `eslint .`, but the current package has no ESLint dependency or configuration, so it fails with `eslint: command not found`. Do not claim lint passed until the lint toolchain is deliberately added or restored. There is no formatter command.

The production build fetches Geist from Google through `next/font`; a network-restricted environment may fail even when the code is valid. As of this guide's refresh, `npm test`, `npx tsc --noEmit`, and a network-enabled `npm run build` pass.

## Routing and rendering patterns

- `proxy.ts` is the Next.js 16 request proxy (the replacement for the old `middleware.ts`). It refreshes the Supabase session with `auth.getUser()`, treats auth screens and `/api/auth` as public, protects other matched routes, and redirects signed-in users away from login/signup/forgot-password.
- Proxy protection is not route authorization. Every API mutation must still call the server Supabase client, use `auth.getUser()`, and enforce ownership/admin policy inside the handler.
- Read-heavy pages such as dashboard, leaderboard, profile, players, and admin query Drizzle in Server Components and pass serializable initial data to client views.
- Interaction-heavy pages such as submit-match, queue, player detail, profile editing, admin, and tournament use Client Components and same-origin `fetch()` calls.
- Next.js 16 dynamic route params are promises: use `{ params }: { params: Promise<{ id: string }> }` and `await params`.
- Add a page at `app/(app)/<route>/page.tsx` when it belongs behind auth, and add a matching `loading.tsx` for a server-rendered page that can suspend. Public auth pages belong in `app/(auth)/`.
- Add API endpoints as `app/api/<resource>/route.ts` or `app/api/<resource>/[id]/route.ts`. Export uppercase HTTP method functions and return `NextResponse.json`; current errors conventionally use `{ error: string }` with an appropriate status.
- Keep initial reads server-side when possible. Introduce `'use client'` only for browser APIs, effects, local interaction state, or event handlers.

## Authentication, authorization, and Supabase

- Browser auth uses `createClient()` from `lib/supabase-browser.ts`.
- Live screens use `useRealtimeRefresh()` as an invalidation signal and then refetch existing APIs; do not apply untrusted Realtime row payloads directly to UI state. The hook refreshes on every `SUBSCRIBED` status to close non-replayed connection gaps. Keep table arrays module-level so subscriptions are not recreated on every render.
- Server Components may use `getSessionUser()` because `proxy.ts` already verified the request. API routes must use `createClient()` plus `supabase.auth.getUser()` for full verification.
- `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS, and must remain server-only.
- Signup stores the display name in Supabase user metadata. After the eight-digit email signup OTP is verified, `POST /api/users` mirrors the auth user into the public `users` table. This is email OTP verification, not TOTP/MFA.
- Password recovery is intentionally non-enumerating: `/api/auth/forgot-password` generates a Supabase recovery link with the service role and sends it through Resend; `app/auth/callback` exchanges the code.
- Avatar upload uses the service role against the public `avatars` bucket, validates MIME type and a 5 MB size limit, stores files under `<user-id>/avatar.<ext>`, and mirrors the cache-busted public URL to `users.avatarUrl`.
- General admin access comes from up to two UUIDs in private admin env vars via `isAdmin()`. Public variants exist only for cosmetic navbar visibility and are not authorization.
- Tournament management allows general admins or `users.isTournamentAdmin` through `canManageTournament()`.
- Some existing tournament mutations and `/api/admin/recalculate-rr` do not consistently enforce the intended permission helper. Treat this as a fragile legacy area: new or modified mutations must explicitly authenticate and authorize rather than copying a permissive handler or relying on a page guard.
- User deletion is a soft delete in the public table, rejects their pending matches, then deletes the Supabase Auth account. Historical matches render the player as `Deleted User`.

Authorization boundaries to preserve:

| Operation | Required policy |
|---|---|
| Read protected application data | Authenticated user; API handlers should verify locally when they expose user-specific data |
| Edit own profile, email, password, or avatar | Authenticated user operating on `user.id` |
| Submit a match | Authenticated user; submitter is Team 1 Player 1 |
| Confirm/reject a match | Team 2 participant or general admin |
| Rename/delete users, manage seasons/RR, edit confirmed matches | General admin via `isAdmin()` |
| Open tournament-admin page or perform tournament-admin actions | General admin or `isTournamentAdmin` via `canManageTournament()` |
| Create/manage courts and queue entries | Currently any authenticated user; `createdBy` is recorded but ownership is not enforced |
| Start/live-score tournament games | Current UI allows an authenticated scorer workflow, but endpoint ownership checks are incomplete |

Do not silently tighten or loosen the last two policies while doing unrelated work. If a task changes them, make the policy explicit and update every associated route and UI control together.

## Database and data model

Application data is queried directly with Drizzle/Postgres, not through the Supabase REST client. Keep DB access in Server Components, route handlers, or focused `lib/` helpers; never import `lib/db.ts` into a Client Component.

Core tables:

- `users`: public mirror of Supabase Auth UUIDs, profile data, soft-delete flag, and tournament-admin flag.
- `seasons`: season dates and active state.
- `season_stats`: one intended row per user/season with RR, games, wins, and losses.
- `matches`: a stored-season 2v2 result, point scores, derived set wins, played/submitted/expiry times, and verification state.
- `rr_changes`: one row per player per confirmed match, including delta and before/after RR.
- `courts`, `court_queue_entries`: named queues and ordered two-player entries.
- `tournaments`, `tournament_pools`, `tournament_teams`, `tournament_games`, `tournament_playoff_games`: AA/BB pool and playoff scoring.

TypeScript property names are camelCase while SQL column names are snake_case. Match statuses are uppercase (`PENDING`, `CONFIRMED`, `REJECTED`, `EXPIRED`); tournament game statuses are lowercase (`pending`, `live`, `complete`). Preserve those exact enum conventions.

Important integrity gaps in the current schema:

- There is no database unique constraint on `(season_stats.user_id, season_stats.season_id)`. Several reads and repair helpers defensively deduplicate rows. Avoid creating duplicates and consider a constraint only as an explicit, data-migrated schema change.
- "Only one active season" is an application invariant, not a database constraint.
- Queue positions and "a player appears in only one queue" are application checks, not protected by constraints.

## Ranking and match invariants

Ranking history is order-dependent. Treat the following as one business workflow:

1. `POST /api/matches` validates four distinct players and non-tied, non-negative set scores, interprets the entered time in `America/New_York`, stores the active `seasonId`, and creates a seven-day `PENDING` match.
2. Only a player on Team 2 or a general admin may verify. Team 1 is the submitting side.
3. `verifyMatch()` atomically claims a pending match. Rejection only changes status. Confirmation changes status and applies RR in the same database transaction.
4. If the match is newest by `(playedAt, submittedAt)`, apply it incrementally; otherwise replay the stored season chronologically.
5. Persist player deltas in `rr_changes` and current aggregates in `season_stats`.

Never:

- expose an RR delta for a pending match;
- calculate RR on submission;
- use the currently active season when processing an existing match—use `match.seasonId`;
- split match confirmation/status and RR mutation across transactions;
- make confirmation non-idempotent;
- change chronological ordering in only one of the incremental/replay helpers.

The authoritative production path is `rr-config.ts` + `match-engine.ts` + `apply-confirmed-match.ts` + `recalculate-rr.ts`. Team rating is the average of the two players, placement and outcome multipliers come from `DEFAULT_RR_CONFIG`, deltas are rounded per player, and RR is floored at zero. `PLACEMENT_GAMES` is five, but five is also duplicated in some UI/query code; coordinate all call sites if it changes.

Starting RR is currently context-dependent: the config/schema default is 800, first-ever season creation explicitly seeds users at 0, existing users are seeded at 60% of prior RR, and both incremental processing and season replay use 800 when there is no prior-season row. Do not "simplify" this without a requested behavior change and tests.

Leaderboard reads use Next.js cache tags (`leaderboard-<seasonId>` and `leaderboard-lifetime`) with a minutes lifetime. Match verification revalidates both. Any other mutation that changes rank-visible data must consider the same invalidation.

### Other feature lifecycles

- Season creation is one transaction in `POST /api/seasons`: close the active season, create the new active row, and seed all relevant `season_stats`. Season date/name edits use `/api/seasons/[id]`; direct player RR edits use `/api/seasons/[id]/mmr`.
- Profile and player APIs accept `?seasonId=` and otherwise resolve the active season. Lifetime profile totals deduplicate accidental season-stat duplicates and sum season aggregates; lifetime leaderboard ordering is wins first, then peak RR.
- Seasonal leaderboard membership requires at least five games and excludes soft-deleted users. A current user can therefore have stats and RR but no leaderboard rank during placement.
- Court reads serialize each court with a nested, position-ordered queue. Joining rejects either player if already queued anywhere; advancing removes the first team and renumbers the remaining entries.
- Tournament clients load pool and playoff data separately for `AA` or `BB`. Both currently hardcode tournament UUID `00000000-0000-0000-0000-000000000001`; there is no tournament creation/selection UI or API.
- Pool games record `scoredBy`; playoff games do not. Pool and playoff endpoints are parallel but not identical, so inspect both branches before changing shared scoring behavior.

## Shared code and UI conventions

- Put reusable business rules, query workflows, and permission checks in `lib/`; route handlers should authenticate, validate, authorize, call the helper, and serialize.
- When a response shape is shared by a route and UI, define/update it in `lib/types.ts`.
- Use Drizzle-inferred types for database rows and the exported `Tx` type from `lib/match-engine.ts` for helpers that participate in a transaction.
- Reuse `MatchCard`, `PlayerCard`, `LeaderboardRow`, `VerificationCard`, `SeasonSelector`, and `DashboardPanel` instead of creating page-local versions of the same sports entity.
- Use `cn()` for Tailwind class composition, `getInitials()` for avatars, and `lib/ranks.ts` for tier/placement presentation.
- Styling is Tailwind 4 with theme tokens declared in `app/globals.css`. Preserve light/dark variables, responsive mobile-first layout, visible focus states, and reduced-motion behavior.
- Async UI needs a loading/disabled state, an empty or error state, and user feedback; the current app generally uses skeletons/spinners and Sonner toasts.
- Use `@/` imports, which map to the repository root.
- Files use kebab-case; React components and exported types use PascalCase; functions/variables use camelCase. Feature client files commonly use `<feature>-client.tsx`.

## Tests and where new code goes

The only automated tests currently are `lib/elo.test.ts` (14 Vitest tests). Vitest uses default discovery; there is no custom config or global setup.

- Add pure business-logic tests beside the module as `*.test.ts`.
- Ranking, placement, season-transition, verification, and chronological replay changes require automated regression coverage.
- There is no route, component, browser, or database integration harness. For changed workflows, record focused manual verification rather than claiming nonexistent automated coverage.
- New shared components go in `components/`; reusable primitives in `components/ui/`; shared browser hooks in `hooks/`; database/business helpers in `lib/`; schema changes in `drizzle/schema.ts` plus a migration.

Targeted manual checks:

- Auth: signup OTP creates the public profile, login survives navigation, protected routes redirect when signed out, and recovery reaches reset-password.
- Match submission: invalid/tied scores and duplicate players fail; a valid result stays pending and shows no RR delta.
- Verification: Team 1 cannot verify, Team 2 can confirm/reject, repeated verification cannot apply RR twice, and confirming an older played date triggers a correct replay.
- Ranking: dashboard, seasonal/lifetime leaderboard, profile, and player detail agree after a confirmed match or admin edit.
- Season change: the old season closes, new rows receive the intended starting RR, placement counts reset, and selectors show both seasons.
- Profile/avatar: upload, replacement, deletion, email/password changes, and soft-deleted-player rendering remain consistent.
- Queue: create, join, global duplicate prevention, edit/remove, advance, and position renumbering work on mobile.
- Tournament: test both divisions and both pool/playoff branches, including regular scoring, scorer edits, cancel/reset, and tournament-admin actions.

## Environment and operations

Copy `.env.example` to `.env.local`; both are loaded by Drizzle tooling, while Next also loads supported env files.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser-safe Supabase configuration.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Auth/Storage administration.
- `DATABASE_URL`: Supabase Postgres pooler connection string.
- `NEXT_PUBLIC_APP_URL`: absolute callback/email URLs.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`: password-reset delivery.
- `ADMIN_USER_ID`, `ADMIN_USER_ID_2`: preferred server-side admin UUIDs.
- `NEXT_PUBLIC_ADMIN_USER_ID`, `NEXT_PUBLIC_ADMIN_USER_ID_2`: optional navbar-only fallbacks; never use as the only server authorization check.

Never expose the service-role key, database URL, or Resend key to Client Components or logs. Any new client-visible variable must deliberately use the `NEXT_PUBLIC_` prefix.

`npm run seed:dev` truncates every application table with cascade and inserts deterministic users, seasons, matches, RR history, queues, and tournament data. It refuses `NODE_ENV=production`/`VERCEL_ENV=production`, requires a valid `ADMIN_USER_ID`, and verifies that `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` identify the same Supabase project. It seeds public `users` rows, not login-capable Supabase Auth accounts. Never run it against shared or production data.

## Migrations, deployment, and fragile operations

- Change `drizzle/schema.ts`, then use the installed Drizzle CLI (there are no npm wrappers), for example `npx drizzle-kit generate` and `npx drizzle-kit migrate`. Inspect generated SQL before applying it.
- The checked-in migration history is inconsistent: the journal references a missing migration name, there are duplicate numeric prefixes, and current tournament/schema fields are not fully represented by the SQL files. Do not assume a fresh migration replay matches production. Reconcile the journal, SQL, actual target database, and schema as part of any migration task; do not rewrite old applied migrations casually.
- `supabase/expire-matches-cron.sql` is run manually in the Supabase SQL editor and is not part of Drizzle migrations.
- `supabase/realtime-publication.sql` must also be run manually for cross-client updates. When adding a new live table, add it to that publication script and the `RealtimeTable` union; consider RLS/data exposure before publishing sensitive tables.
- `scripts/recalculate-elo.ts` deletes/rebuilds ranking data and differs from the production replay helper in ordering and formula details. Prefer the in-app `lib/recalculate-rr.ts` workflow; do not run the standalone script without auditing and explicit intent.
- The app targets Vercel. `vercel.json` sets security headers, CSP, and service-worker caching headers. `next.config.mjs` enables Cache Components, unoptimized Next images, and the production PWA runtime caches. Preserve `/~offline`, `public/manifest.json`, and service-worker header behavior when changing deployment/PWA configuration.
- PWA runtime caching includes API and authenticated pages. Be careful not to expand caching of sensitive responses without considering offline data exposure and staleness.

## Before completing a change

- Keep the change within one feature boundary; do not mix a fix, refactor, and visual redesign.
- Inspect the relevant page, route, shared helper, schema, and DTO together before changing a workflow.
- Preserve API response shapes unless the task explicitly changes them.
- For mutations, verify authentication, authorization, validation, transaction boundaries, stored `seasonId`, idempotency, chronological replay, and cache invalidation.
- For schema work, include and inspect a migration and account for existing duplicate data/incomplete migration history.
- Add tests for new business logic; manually exercise affected auth, match, season, profile/avatar, queue, or tournament states as applicable.
- Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Run `npm run lint` only after acknowledging or fixing the current missing ESLint toolchain.
- Check loading, empty, error, success, keyboard/focus, mobile, and dark-mode behavior for UI changes.
- Review `git diff` and `git status`; leave unrelated files untouched and do not include generated build output.
