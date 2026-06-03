# UMD Grass Rankings

UMD Grass Rankings is a Next.js app for tracking doubles volleyball matches, calculating RR/ELO-style rankings, and managing seasonal standings for the UMD grass volleyball community.

## What’s in the app

- Match submission and opponent verification
- Current-season leaderboard and player profiles
- Season management and admin repair tools
- Courts queue management
- Tournament scoring and admin screens
- Auth, password reset, avatar uploads, and email flows through Supabase

## Tech Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Supabase Auth, Storage, and Postgres
- Drizzle ORM
- Tailwind CSS + shadcn/ui
- Vitest for unit tests

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Create your local env file.

Copy [`.env.example`](.env.example) to [`.env.local`](.env.local) and fill in values from Supabase.

3. Run the app.

```bash
npm run dev
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL` for local development, usually `http://localhost:3000`

## Scripts

- `npm run dev` - start the local dev server
- `npm run build` - build for production
- `npm run start` - start the production build
- `npm run lint` - run ESLint
- `npm test` - run Vitest tests