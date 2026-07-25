import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, eq, or } from 'drizzle-orm'
import { Bell, CalendarDays, Loader2, Trophy } from 'lucide-react'
import { buildMatchesForUser } from '@/app/api/matches/route'
import { DashboardPanel } from '@/components/dashboard-panel'
import { MatchCard } from '@/components/match-card'
import { MiniLeaderboard } from '@/components/mini-leaderboard'
import { PlayerCard, type PlayerCardUser } from '@/components/player-card'
import { Button } from '@/components/ui/button'
import { matches, seasons, seasonStats, users } from '@/drizzle/schema'
import { db } from '@/lib/db'
import { PLACEMENT_GAMES } from '@/lib/elo'
import { fetchCachedLeaderboardRows } from '@/lib/leaderboard'
import { getSessionUser } from '@/lib/supabase-server'

async function DashboardLeaderboard({ seasonId, userId }: { seasonId: string | null; userId: string }) {
  if (!seasonId) {
    return <EmptyMessage>No active season yet.</EmptyMessage>
  }

  const entries = await fetchCachedLeaderboardRows(seasonId)
  return <MiniLeaderboard entries={entries} currentUserId={userId} />
}

async function DashboardMatches({ userId }: { userId: string }) {
  const [allMatches, placementRows] = await Promise.all([
    buildMatchesForUser(userId, 50),
    db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.status, 'CONFIRMED'),
          or(
            eq(matches.team1Player1Id, userId),
            eq(matches.team1Player2Id, userId),
            eq(matches.team2Player1Id, userId),
            eq(matches.team2Player2Id, userId),
          ),
        ),
      )
      .orderBy(asc(matches.playedAt), asc(matches.submittedAt))
      .limit(PLACEMENT_GAMES),
  ])

  const confirmedMatches = allMatches.filter(match => match.status === 'CONFIRMED').slice(0, 5)
  const pendingToVerify = allMatches.filter(
    match =>
      match.status === 'PENDING' &&
      (match.team2Player1.id === userId || match.team2Player2.id === userId),
  )
  const placementMatchIds = new Set(placementRows.map(row => row.id))

  return (
    <div className="space-y-3">
      {pendingToVerify.length > 0 && (
        <Button asChild variant="outline" className="w-full justify-center border-primary/25 text-primary">
          <Link href="/submit-match?tab=verify">
            <Bell className="h-4 w-4" />
            {pendingToVerify.length} pending verification{pendingToVerify.length !== 1 ? 's' : ''}
          </Link>
        </Button>
      )}

      {confirmedMatches.length > 0 ? (
        confirmedMatches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            currentUserId={userId}
            compact
            isPlacement={placementMatchIds.has(match.id)}
          />
        ))
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <CalendarDays className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <p className="text-sm font-semibold">No matches yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Submit your first match to get started.</p>
          <Button asChild className="mt-5 min-w-36">
            <Link href="/submit-match">Submit Match</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">{children}</div>
}

function SpinnerFallback({ height = 'min-h-64' }: { height?: string }) {
  return (
    <div className={`flex items-center justify-center ${height}`}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

export default async function DashboardPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const [[profile], [activeSeason]] = await Promise.all([
    db.select().from(users).where(eq(users.id, sessionUser.id)),
    db.select().from(seasons).where(eq(seasons.isActive, true)),
  ])

  let stats: typeof seasonStats.$inferSelect | null = null
  if (activeSeason) {
    const [seasonStat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, sessionUser.id), eq(seasonStats.seasonId, activeSeason.id)))
    stats = seasonStat ?? null
  }

  const player: PlayerCardUser = {
    id: sessionUser.id,
    name: profile?.name ?? 'Player',
    avatarUrl: profile?.avatarUrl ?? null,
    rr: stats?.rr ?? 0,
    gamesPlayed: stats?.gamesPlayed ?? 0,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
  }
  const firstName = player.name.split(' ')[0]

  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Dashboard</h1>
        <p className="mt-1 text-base text-muted-foreground">Welcome back, {firstName}</p>
      </header>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
        <DashboardPanel
          title="Rankings"
          icon={Trophy}
          href="/leaderboard"
          linkLabel="View full leaderboard"
          className="min-w-0 xl:[contain:size]"
        >
          <Suspense fallback={<SpinnerFallback />}>
            <DashboardLeaderboard seasonId={activeSeason?.id ?? null} userId={sessionUser.id} />
          </Suspense>
        </DashboardPanel>

        <div className="flex h-full min-w-0 flex-col gap-5 xl:gap-6">
          <PlayerCard user={player} profileHref="/profile" />

          <DashboardPanel title="Recent Games" href="/profile" linkLabel="View all">
            <Suspense fallback={<SpinnerFallback height="min-h-56" />}>
              <DashboardMatches userId={sessionUser.id} />
            </Suspense>
          </DashboardPanel>
        </div>
      </div>
    </div>
  )
}
