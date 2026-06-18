import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { CalendarDays, Loader2, Trophy } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard-panel'
import { MiniLeaderboard } from '@/components/mini-leaderboard'
import { PlayerCard, type PlayerCardUser } from '@/components/player-card'
import { PublicRecentMatch } from '@/components/public-recent-match'
import { RealtimeRouteRefresh } from '@/components/realtime-route-refresh'
import { seasons, seasonStats, users } from '@/drizzle/schema'
import { db } from '@/lib/db'
import { fetchCachedLeaderboardRows } from '@/lib/leaderboard'
import { fetchCachedPublicDashboardData } from '@/lib/public-dashboard'
import { getSessionUser } from '@/lib/supabase-server'

const realtimeTables = ['matches', 'season_stats'] as const

async function DashboardLeaderboard({ seasonId, userId }: { seasonId: string | null; userId: string }) {
  if (!seasonId) {
    return <EmptyMessage>No active season yet.</EmptyMessage>
  }

  const entries = await fetchCachedLeaderboardRows(seasonId)
  return <MiniLeaderboard entries={entries} currentUserId={userId} />
}

async function DashboardRecentGames({ seasonId }: { seasonId: string | null }) {
  if (!seasonId) {
    return <EmptyMessage>No active season yet.</EmptyMessage>
  }

  const { recentMatches } = await fetchCachedPublicDashboardData(seasonId)

  return (
    <div className="space-y-3">
      {recentMatches.length > 0 ? (
        recentMatches.map(match => <PublicRecentMatch key={match.id} match={match} />)
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <CalendarDays className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <p className="text-sm font-semibold">No matches yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Confirmed results will appear here.</p>
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
      <RealtimeRouteRefresh
        channelName="dashboard-updates"
        tables={realtimeTables}
        filter={activeSeason ? `season_id=eq.${activeSeason.id}` : undefined}
        refreshOnInitialSubscribe={false}
      />

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

          <DashboardPanel title="Recent Games" href="/profile" linkLabel="View your games">
            <Suspense fallback={<SpinnerFallback height="min-h-56" />}>
              <DashboardRecentGames seasonId={activeSeason?.id ?? null} />
            </Suspense>
          </DashboardPanel>
        </div>
      </div>
    </div>
  )
}
