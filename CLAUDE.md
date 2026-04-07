# UMD Grass Volleyball Rankings — Project Context

## What This Is
A progressive web app (PWA) for the UMD grass volleyball community. It tracks doubles match results and ranks players using an ELO-based system. Players submit match scores, opponents verify them, and RR (ranking rating) is automatically calculated.

## Tech Stack
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 App Router | Full-stack, SSR, API routes, PWA-compatible |
| Language | TypeScript (strict) | Type safety end-to-end |
| UI | shadcn/ui + Tailwind CSS v4 | Pre-built accessible components |
| Database | PostgreSQL via Supabase | Free tier, relational, same platform as auth/storage |
| Auth | Supabase Auth + @supabase/ssr | Cookie-based sessions, TOTP 2FA, persistent login |
| ORM | Drizzle ORM | Lightweight, edge-compatible, no cold-start penalty on Vercel |
| Email | Resend | Transactional email for match verification notifications |
| Storage | Supabase Storage | Profile photo uploads |
| PWA | @ducanh2912/next-pwa | Service worker, offline cache, install prompt |
| Hosting | Vercel (Hobby free tier) | Native Next.js deployment |

## Key Invariants — Never Violate These
- **Never show RR gain/loss until a match is `confirmed`** — pending matches show "Pending verification" instead
- **ELO is only calculated after the opposing team verifies a match** — not on submission
- **Rank is hidden for the first 5 confirmed matches each season** — `isRevealed` flips after game 5
- **Only a player from the opposing team can verify a match** — never the submitting team
- **Admin-only routes** are protected by checking the user's ID against a hardcoded admin ID (not a role column)

## ELO Formula
```
K = 40
E = 1 / (1 + 10^((opponent_avg_rr - player_rr) / 400))
ΔRR = round(K * (actual - E))   // actual = 1 for win, 0 for loss
opponent_avg_rr = (opponentRR1 + opponentRR2) / 2
```
- Applied individually to all 4 players in a match
- Teammate RR does NOT affect your own gain/loss — only opponent average matters
- See `lib/elo.ts` for implementation

## Rank Tiers
| Tier | RR |
|------|----|
| Unranked | < 5 games this season |
| Bronze | 0–499 |
| Silver | 500–999 |
| Gold | 1000–1499 |
| Platinum | 1500–1999 |
| Diamond | 2000+ |

New player starting RR: **800** (hidden until 5 games played)

## Season System
- Seasons are annual, admin-triggered (no automatic reset)
- On new season: all players revert to Unranked, `gamesPlayed = 0`, `isRevealed = false`
- Hidden MMR carries over from previous season with **20% decay toward 800**
  - Formula: `newHiddenMmr = prevRR + 0.8 * (prevRR - 800)` → decays toward 800
- First season: admin manually sets each player's `hiddenMmr`

## Match Flow
1. Player A submits match (partner, opponents, score)
2. Match status = `PENDING`, expires in 7 days
3. Player on opposing team receives email notification
4. Opposing player confirms or rejects
5. On confirm: ELO calculated, `season_stats` updated, `rr_changes` recorded
6. On reject: match status = `REJECTED`, discarded
7. On expiry: Supabase pg_cron sets status = `EXPIRED`

## File Structure
```
app/
  (auth)/          # login, signup, verify (2FA)
  (app)/           # protected routes: dashboard, leaderboard, profile, submit-match, admin
  api/             # API routes: matches, leaderboard, users, seasons
components/
  ui/              # shadcn/ui primitives (don't edit these)
  match-card.tsx   # renders a match result — checks status before showing RR
  leaderboard-row.tsx
  player-card.tsx
  verification-card.tsx
lib/
  db.ts            # Drizzle client singleton
  supabase-browser.ts  # createBrowserClient (@supabase/ssr)
  supabase-server.ts   # createServerClient with cookie adapter
  elo.ts           # ELO calculation — pure functions, no DB calls
  utils.ts         # cn() helper
drizzle/
  schema.ts        # all table definitions
  migrations/      # generated migration files
middleware.ts      # session refresh + route protection
```

## Running Locally
```bash
nvm use          # switches to Node 20 (see .nvmrc)
npm install
cp .env.example .env.local   # fill in Supabase + Resend keys
npm run dev
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=        # Supabase Postgres with pgBouncer for serverless
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Supabase Auth Settings (dashboard)
- JWT expiry: 3600s (1 hour, auto-refreshed silently)
- Refresh token expiry: 2592000s (30 days — persistent login)
- TOTP 2FA: enabled, required on signup

---

## Implementation Parts

### Part 0 — Prerequisites ✅
- `.nvmrc` with Node 20
- `.gitignore` updated (covers `.env*`, `.next/`, `.vercel/`, `drizzle/meta/`, etc.)
- `CLAUDE.md` created
- RR gain/loss hidden on pending matches in `components/match-card.tsx`
- Repeated ranking logic extracted to helpers in `lib/mock-data.ts`

### Part 1 — Project Setup ✅
- Installed: `@supabase/supabase-js`, `@supabase/ssr`, `drizzle-orm`, `drizzle-kit`, `postgres`, `@ducanh2912/next-pwa`, `resend`
- `lib/supabase-browser.ts` — browser Supabase client
- `lib/supabase-server.ts` — server Supabase client with cookie adapter
- `drizzle.config.ts` — points to `drizzle/schema.ts`, reads `DATABASE_URL`
- `next.config.mjs` — wrapped with `withPWA` (disabled in dev)
- `.env.local` created (fill in values from Supabase dashboard)

### Part 2 — Database Schema & Migrations
- Write `drizzle/schema.ts` — `users`, `seasons`, `season_stats`, `matches`, `rr_changes` tables
- Create `lib/db.ts` — Drizzle client singleton
- Run `drizzle-kit generate` + `drizzle-kit migrate`
- Seed one active season row

### Part 3 — Authentication
- Wire signup/login/verify pages to Supabase Auth
- TOTP 2FA enrollment + challenge screens
- `middleware.ts` — session refresh + route protection
- Sign-out in navbar

### Part 4 — User Profiles
- Insert `users` row on signup
- `GET/PATCH /api/users/[id]` and `/api/users/me`
- Avatar upload via Supabase Storage
- Wire profile page to real API

### Part 5 — ELO Logic
- `lib/elo.ts` — `calculateRrChange(playerRR, oppRR1, oppRR2, won)`
- Unit tests for key matchup scenarios

### Part 6 — Match Submission & Verification
- `POST /api/matches` — create pending match
- `GET /api/matches` — list user matches
- `PATCH /api/matches/[id]/verify` — confirm/reject, trigger ELO, flip `isRevealed` after 5 games
- Wire submit-match page to real API

### Part 7 — Leaderboard
- `GET /api/leaderboard` — season_stats joined with users, sorted by RR
- Wire leaderboard page to real API

### Part 8 — Season System & Admin
- `POST/GET /api/seasons`
- Admin page to create seasons and set hidden MMR per player
- Season selector on leaderboard/profile

### Part 9 — Notifications & Match Expiry
- Resend email on match submission (verification request)
- Navbar badge for pending verifications
- Supabase pg_cron job to expire matches after 7 days

### Part 10 — PWA & Deployment Polish
- Configure `@ducanh2912/next-pwa` offline caching
- Fix TypeScript strict mode (remove `ignoreBuildErrors`)
- Deploy to Vercel with all env vars set
