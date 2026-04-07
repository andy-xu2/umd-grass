import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { PlayerCard } from '@/components/player-card'
import { MatchCard } from '@/components/match-card'
import { StatCard } from '@/components/stat-card'
import { buildMatchesForUser } from '@/app/api/matches/route'
import { getWinRate } from '@/lib/mock-data'
import { Gamepad2, Target, TrendingUp, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Profile
  const [profile] = await db.select().from(users).where(eq(users.id, user.id))

  // Active season
  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))

  // Season stats for this user
  let stats = null
  if (activeSeason) {
    const [s] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, activeSeason.id)))
    stats = s ?? null
  }

  // All matches involving this user
  const allMatches = await buildMatchesForUser(user.id)

  const confirmedMatches = allMatches.filter(m => m.status === 'CONFIRMED').slice(0, 5)

  // Matches the user needs to verify (they're on team2, status PENDING)
  const pendingToVerify = allMatches.filter(
    m =>
      m.status === 'PENDING' &&
      (m.team2Player1.id === user.id || m.team2Player2.id === user.id),
  )

  const rr = stats?.rr ?? 800
  const gamesPlayed = stats?.gamesPlayed ?? 0
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const isRevealed = stats?.isRevealed ?? false
  const winRate = getWinRate(wins, gamesPlayed)

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

      {/* Player Card */}
      <PlayerCard user={playerCardUser} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Games Played" value={gamesPlayed} icon={Gamepad2} />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={Target} />
        <StatCard
          label="Current RR"
          value={isRevealed ? rr : '—'}
          icon={TrendingUp}
        />
        <StatCard label="Total Wins" value={wins} icon={Trophy} />
      </div>

      {/* Recent Matches */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Matches</h2>
          <Link href="/profile" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {confirmedMatches.length > 0 ? (
            confirmedMatches.map(match => (
              <MatchCard key={match.id} match={match} currentUserId={user.id} compact />
            ))
          ) : (
            <div className="rounded-lg bg-secondary/30 p-8 text-center">
              <p className="text-muted-foreground">No matches played yet</p>
              <Link href="/submit-match">
                <Button className="mt-4">Submit your first match</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pending Verifications Preview */}
      {pendingToVerify.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Verifications</h2>
            <Link href="/submit-match" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {pendingToVerify.slice(0, 2).map(match => (
              <MatchCard key={match.id} match={match} currentUserId={user.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
