import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, and, desc, gte, inArray } from 'drizzle-orm'
import { PlayerCard } from '@/components/player-card'
import { MatchCard } from '@/components/match-card'
import { MiniLeaderboard } from '@/components/mini-leaderboard'
import { buildMatchesForUser } from '@/app/api/matches/route'
import { PLACEMENT_GAMES } from '@/lib/elo'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, Trophy, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaderboardEntry } from '@/lib/types'

// ─── Async streaming sections ─────────────────────────────────────────────────

async function DashboardLeaderboard({ userId }: { userId: string }) {
  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
  if (!activeSeason) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No active season yet.
      </p>
    )
  }

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      rr: seasonStats.rr,
      gamesPlayed: seasonStats.gamesPlayed,
      wins: seasonStats.wins,
      losses: seasonStats.losses,
    })
    .from(seasonStats)
    .innerJoin(users, eq(seasonStats.userId, users.id))
    .where(and(eq(seasonStats.seasonId, activeSeason.id), gte(seasonStats.gamesPlayed, 5)))
    .orderBy(desc(seasonStats.rr))

  // Deduplicate by userId, keeping the row with the highest RR
  const seen = new Map<string, typeof rows[number]>()
  for (const row of rows) {
    const existing = seen.get(row.userId)
    if (!existing || row.rr > existing.rr) seen.set(row.userId, row)
  }
  const deduped = Array.from(seen.values()).sort((a, b) => b.rr - a.rr)

  let rankCounter = 0
  const entries: LeaderboardEntry[] = deduped.map(row => ({
    ...row,
    rank: ++rankCounter,
    rankTrend: null,
  }))

  const playerIds = entries.map(e => e.userId)
  if (playerIds.length > 0) {
    const recentChanges = await db
      .select({ userId: rrChanges.userId, rrBefore: rrChanges.rrBefore })
      .from(rrChanges)
      .where(and(eq(rrChanges.seasonId, activeSeason.id), inArray(rrChanges.userId, playerIds)))
      .orderBy(desc(rrChanges.createdAt))

    const latestRrBefore = new Map<string, number>()
    for (const change of recentChanges) {
      if (!latestRrBefore.has(change.userId)) latestRrBefore.set(change.userId, change.rrBefore)
    }
    for (const entry of entries) {
      const rrBefore = latestRrBefore.get(entry.userId)
      if (rrBefore == null) { entry.rankTrend = 0; continue }
      const prevRank = entries.filter(e => e.userId !== entry.userId && e.rr > rrBefore).length + 1
      entry.rankTrend = prevRank - entry.rank
    }
  }

  return <MiniLeaderboard entries={entries} currentUserId={userId} />
}

async function DashboardPlayerCard({ userId }: { userId: string }) {
  const [[profile], [activeSeason]] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(seasons).where(eq(seasons.isActive, true)),
  ])

  let stats = null
  if (activeSeason) {
    const [s] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, userId), eq(seasonStats.seasonId, activeSeason.id)))
    stats = s ?? null
  }

  const playerCardUser = {
    id: userId,
    name: profile?.name ?? 'Player',
    avatarUrl: profile?.avatarUrl ?? null,
    rr: stats?.rr ?? 0,
    gamesPlayed: stats?.gamesPlayed ?? 0,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
  }

  return <PlayerCard user={playerCardUser} />
}

async function DashboardMatches({ userId }: { userId: string }) {
  const allMatches = await buildMatchesForUser(userId)
  const confirmedMatches = allMatches.filter(m => m.status === 'CONFIRMED').slice(0, 5)
  const pendingToVerify = allMatches.filter(
    m =>
      m.status === 'PENDING' &&
      (m.team2Player1.id === userId || m.team2Player2.id === userId),
  )

  // First PLACEMENT_GAMES confirmed matches (career-wide, sorted oldest first) are placement games
  const placementMatchIds = new Set(
    allMatches
      .filter(m => m.status === 'CONFIRMED')
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      .slice(0, PLACEMENT_GAMES)
      .map(m => m.id),
  )

  return (
    <>
      {pendingToVerify.length > 0 && (
        <Link href="/submit-match">
          <Button variant="outline" className="w-full gap-2">
            <Clock className="h-4 w-4" />
            {pendingToVerify.length} Pending Verification{pendingToVerify.length !== 1 ? 's' : ''}
          </Button>
        </Link>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Matches</h2>
          <Link href="/profile" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {confirmedMatches.length > 0 ? (
            confirmedMatches.map(match => (
              <MatchCard key={match.id} match={match} currentUserId={userId} compact isPlacement={placementMatchIds.has(match.id)} />
            ))
          ) : (
            <div className="rounded-lg bg-secondary/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">No matches yet</p>
              <Link href="/submit-match">
                <Button className="mt-3" size="sm">Submit your first match</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {pendingToVerify.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending Verifications</h2>
            <Link href="/submit-match" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {pendingToVerify.slice(0, 2).map(match => (
              <MatchCard key={match.id} match={match} currentUserId={userId} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Loading fallbacks ────────────────────────────────────────────────────────

function SpinnerFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // getSession() reads the cookie — no network call to Supabase Auth.
  // Middleware already verified the token, so this is safe and fast.
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [profile] = await db.select({ name: users.name }).from(users).where(eq(users.id, user.id))
  const firstName = profile?.name?.split(' ')[0] ?? null

  return (
    <div className="space-y-6">
      {/* Header renders instantly */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </p>
      </div>

      {/* Two-column layout — each section streams in independently */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Rankings */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-primary" />
                Rankings
              </CardTitle>
              <Link href="/leaderboard" className="text-xs text-primary hover:underline">
                Full leaderboard
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0">
            <Suspense fallback={<SpinnerFallback />}>
              <DashboardLeaderboard userId={user.id} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Right: Player card + matches — each streams independently */}
        <div className="space-y-6">
          <Suspense fallback={<SpinnerFallback />}>
            <DashboardPlayerCard userId={user.id} />
          </Suspense>

          <Suspense fallback={<SpinnerFallback />}>
            <DashboardMatches userId={user.id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
