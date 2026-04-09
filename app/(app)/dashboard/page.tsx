import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats, rrChanges } from '@/drizzle/schema'
import { eq, and, desc, gt, inArray } from 'drizzle-orm'
import { PlayerCard } from '@/components/player-card'
import { MatchCard } from '@/components/match-card'
import { MiniLeaderboard } from '@/components/mini-leaderboard'
import { buildMatchesForUser } from '@/app/api/matches/route'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaderboardEntry } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Batch 1: all queries that don't depend on each other
  const [[profile], [activeSeason], allMatches] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)),
    db.select().from(seasons).where(eq(seasons.isActive, true)),
    buildMatchesForUser(user.id),
  ])

  const confirmedMatches = allMatches.filter(m => m.status === 'CONFIRMED').slice(0, 5)
  const pendingToVerify = allMatches.filter(
    m =>
      m.status === 'PENDING' &&
      (m.team2Player1.id === user.id || m.team2Player2.id === user.id),
  )

  // Batch 2: queries that depend on activeSeason.id, run in parallel
  let stats = null
  let leaderboardEntries: LeaderboardEntry[] = []

  if (activeSeason) {
    const [statsRows, leaderboardRows] = await Promise.all([
      db.select().from(seasonStats)
        .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, activeSeason.id))),
      db.select({
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        rr: seasonStats.rr,
        gamesPlayed: seasonStats.gamesPlayed,
        wins: seasonStats.wins,
        losses: seasonStats.losses,
        isRevealed: seasonStats.isRevealed,
      })
        .from(seasonStats)
        .innerJoin(users, eq(seasonStats.userId, users.id))
        .where(and(eq(seasonStats.seasonId, activeSeason.id), gt(seasonStats.gamesPlayed, 0)))
        .orderBy(desc(seasonStats.isRevealed), desc(seasonStats.rr)),
    ])

    stats = statsRows[0] ?? null

    let rankCounter = 0
    leaderboardEntries = leaderboardRows.map(row => {
      if (row.isRevealed) {
        rankCounter++
        return { ...row, rank: rankCounter, rankTrend: null }
      }
      return { ...row, rank: null, rankTrend: null }
    })

    // Batch 3: rank trends (depends on leaderboard player IDs)
    const playerIds = leaderboardEntries.map(e => e.userId)
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

      const revealedEntries = leaderboardEntries.filter(e => e.rank != null)
      for (const entry of leaderboardEntries) {
        if (entry.rank == null) continue
        const rrBefore = latestRrBefore.get(entry.userId)
        if (rrBefore == null) { entry.rankTrend = 0; continue }
        const prevRank = revealedEntries.filter(e => e.userId !== entry.userId && e.rr > rrBefore).length + 1
        entry.rankTrend = prevRank - entry.rank
      }
    }
  }

  const rr = stats?.rr ?? 800
  const gamesPlayed = stats?.gamesPlayed ?? 0
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const isRevealed = stats?.isRevealed ?? false

  const playerCardUser = {
    id: user.id,
    name: profile?.name ?? user.email ?? 'Unknown',
    avatarUrl: profile?.avatarUrl ?? null,
    rr,
    gamesPlayed,
    wins,
    losses,
    isRevealed,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {profile?.name ?? 'Player'}
          </p>
        </div>
        {pendingToVerify.length > 0 && (
          <Link href="/submit-match">
            <Button variant="outline" className="gap-2">
              <Clock className="h-4 w-4" />
              {pendingToVerify.length} Pending Verification
            </Button>
          </Link>
        )}
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Mini-Leaderboard */}
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
            <MiniLeaderboard entries={leaderboardEntries} currentUserId={user.id} />
          </CardContent>
        </Card>

        {/* Right: Player Card + Recent Matches + Pending */}
        <div className="space-y-6">
          <PlayerCard user={playerCardUser} />

          {/* Recent Matches */}
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
                  <MatchCard key={match.id} match={match} currentUserId={user.id} compact />
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

          {/* Pending Verifications */}
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
                  <MatchCard key={match.id} match={match} currentUserId={user.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
