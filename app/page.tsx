import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { eq } from 'drizzle-orm'
import {
  CalendarDays,
  LogIn,
  Trophy,
  UserPlus,
  Users,
  Volleyball,
} from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard-panel'
import { PublicMiniLeaderboard } from '@/components/public-mini-leaderboard'
import { PublicRecentMatch } from '@/components/public-recent-match'
import { RealtimeRouteRefresh } from '@/components/realtime-route-refresh'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { seasons } from '@/drizzle/schema'
import { db } from '@/lib/db'
import { fetchCachedLeaderboardRows } from '@/lib/leaderboard'
import { fetchCachedPublicDashboardData } from '@/lib/public-dashboard'
import { getSessionUser } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Dashboard | UMD Grass Rankings',
  description: 'Follow the latest UMD grass volleyball rankings and match results.',
}

const realtimeTables = ['matches', 'season_stats'] as const

export default function Home() {
  return (
    <Suspense fallback={<PublicDashboardFallback />}>
      <PublicDashboard />
    </Suspense>
  )
}

function PublicDashboardFallback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-[68px] border-b bg-background" />
      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="h-10 w-44 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-5 w-full max-w-md animate-pulse rounded-md bg-muted" />
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[560px] animate-pulse rounded-xl border bg-card" />
          <div className="h-80 animate-pulse rounded-xl border bg-card" />
        </div>
      </main>
    </div>
  )
}

async function PublicDashboard() {
  const sessionUser = await getSessionUser()
  if (sessionUser) redirect('/dashboard')

  const [activeSeason] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1)

  const [leaderboardEntries, dashboardData] = activeSeason
    ? await Promise.all([
        fetchCachedLeaderboardRows(activeSeason.id),
        fetchCachedPublicDashboardData(activeSeason.id),
      ])
    : [[], { activePlayers: 0, confirmedMatches: 0, recentMatches: [] }]

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-50 h-[68px] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-full w-full max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Volleyball className="h-5 w-5" />
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight sm:block sm:text-base">
              UMD Grass Rankings
            </span>
          </Link>

          <nav aria-label="Account" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="h-10 w-10" />
            <Button asChild variant="ghost" className="h-10 px-2.5 sm:px-4">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Log in</span>
              </Link>
            </Button>
            <Button asChild className="h-10 px-3 sm:px-4">
              <Link href="/signup">
                <UserPlus className="hidden h-4 w-4 sm:block" />
                Sign up
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="min-h-screen pt-[68px]">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <RealtimeRouteRefresh
            channelName="public-dashboard-updates"
            tables={realtimeTables}
            filter={activeSeason ? `season_id=eq.${activeSeason.id}` : undefined}
            refreshOnInitialSubscribe={false}
          />

          <div className="space-y-5 sm:space-y-6">
            <header>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">
                Dashboard
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Follow the latest rankings and results from UMD grass volleyball.
              </p>
            </header>

            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
              <DashboardPanel
                title="Rankings"
                icon={Trophy}
                headerMeta={activeSeason ? (
                  <span className="max-w-32 truncate rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:max-w-none sm:text-xs">
                    {activeSeason.name}
                  </span>
                ) : undefined}
                className="min-w-0 xl:[contain:size]"
                contentClassName="pb-4 sm:pb-6"
              >
                <PublicMiniLeaderboard entries={leaderboardEntries.slice(0, 10)} />
                <div className="mt-4 border-t pt-4 text-center">
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Log in to see your rank and the full player standings.
                  </p>
                  <Button asChild variant="outline" className="mt-3 h-11 w-full sm:w-auto">
                    <Link href="/login">View your ranking</Link>
                  </Button>
                </div>
              </DashboardPanel>

              <div className="flex h-full min-w-0 flex-col gap-5 xl:gap-6">
                <Card className="gap-0 overflow-hidden rounded-xl border-border/90 py-0 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Volleyball className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Current season
                        </p>
                        <h2 className="mt-1 truncate text-lg font-semibold">
                          {activeSeason?.name ?? 'No active season'}
                        </h2>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 divide-x border-y py-4">
                      <div className="px-2 text-center">
                        <p className="text-2xl font-semibold tabular-nums">{dashboardData.activePlayers}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Active players</p>
                      </div>
                      <div className="px-2 text-center">
                        <p className="text-2xl font-semibold tabular-nums">{dashboardData.confirmedMatches}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Matches played</p>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-muted-foreground">
                      Join the community to submit matches, track your rating, and compete on the leaderboard.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <Button asChild className="h-11 w-full">
                        <Link href="/signup">Create an account</Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 w-full">
                        <Link href="/login">Log in</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <DashboardPanel title="Recent Games" icon={CalendarDays}>
                  {dashboardData.recentMatches.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.recentMatches.map(match => (
                        <PublicRecentMatch key={match.id} match={match} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-48 flex-col items-center justify-center text-center">
                      <Users className="h-7 w-7 text-muted-foreground" strokeWidth={1.7} />
                      <p className="mt-3 text-sm font-semibold">No matches yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Confirmed results will appear here.
                      </p>
                    </div>
                  )}
                </DashboardPanel>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
