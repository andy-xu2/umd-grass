import { PlayerCard } from '@/components/player-card'
import { MatchCard } from '@/components/match-card'
import { StatCard } from '@/components/stat-card'
import { currentUser, matches, getWinRate } from '@/lib/mock-data'
import { Gamepad2, Target, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const confirmedMatches = matches.filter(m => m.status === 'confirmed')
  const pendingMatches = matches.filter(m => m.status === 'pending')
  const recentMatches = confirmedMatches.slice(0, 5)
  const winRate = getWinRate(currentUser.wins, currentUser.gamesPlayed)

  // Calculate recent trend (mock)
  const recentWins = recentMatches.filter(m => {
    const isTeam1 = m.team1.player1.id === currentUser.id || m.team1.player2.id === currentUser.id
    return (isTeam1 && m.winner === 'team1') || (!isTeam1 && m.winner === 'team2')
  }).length
  const recentWinRate = Math.round((recentWins / recentMatches.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {currentUser.username}</p>
        </div>
        {pendingMatches.length > 0 && (
          <Link href="/submit-match">
            <Button variant="outline" className="gap-2">
              <Clock className="h-4 w-4" />
              {pendingMatches.length} Pending Verification
            </Button>
          </Link>
        )}
      </div>

      {/* Player Card */}
      <PlayerCard user={currentUser} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Games Played"
          value={currentUser.gamesPlayed}
          icon={Gamepad2}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          icon={Target}
          trend={{ value: recentWinRate - winRate, isPositive: recentWinRate >= winRate }}
        />
        <StatCard
          label="Current RR"
          value={currentUser.rr}
          icon={TrendingUp}
        />
        <StatCard
          label="Total Wins"
          value={currentUser.wins}
          icon={Target}
        />
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
          {recentMatches.length > 0 ? (
            recentMatches.map((match) => (
              <MatchCard key={match.id} match={match} compact />
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
      {pendingMatches.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Verifications</h2>
            <Link href="/submit-match" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {pendingMatches.slice(0, 2).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
