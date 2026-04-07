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
