'use client'

import { useState, useMemo } from 'react'
import { LeaderboardRow } from '@/components/leaderboard-row'
import { getRankedUsers, getUserRank, currentUser } from '@/lib/mock-data'
import { Input } from '@/components/ui/input'
import { Search, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LeaderboardPage() {
  const [search, setSearch] = useState('')

  const sortedUsers = useMemo(() => getRankedUsers(), [])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return sortedUsers
    return sortedUsers.filter(user =>
      user.username.toLowerCase().includes(search.toLowerCase())
    )
  }, [sortedUsers, search])

  const currentUserRank = getUserRank(currentUser.id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Top ranked grass volleyball players</p>
      </div>

      {/* Current User Rank Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-bold">#{currentUserRank}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current RR</p>
            <p className="text-2xl font-bold text-primary">{currentUser.rr}</p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Top 3 Podium */}
      {!search && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {/* 2nd Place */}
          <div className="order-1 flex flex-col items-center">
            <div className="mb-2 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-slate-400 bg-secondary">
              <span className="text-lg sm:text-2xl font-bold text-slate-400">
                {sortedUsers[1]?.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex h-16 sm:h-20 w-full items-end justify-center rounded-t-lg bg-slate-400/20">
              <span className="pb-2 text-2xl sm:text-3xl font-bold text-slate-400">2</span>
            </div>
            <p className="mt-2 text-center text-xs sm:text-sm font-medium truncate w-full">
              {sortedUsers[1]?.username}
            </p>
            <p className="text-xs text-muted-foreground">{sortedUsers[1]?.rr} RR</p>
          </div>

          {/* 1st Place */}
          <div className="order-0 sm:order-1 flex flex-col items-center">
            <div className="mb-2 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-yellow-500 bg-secondary">
              <span className="text-xl sm:text-3xl font-bold text-yellow-500">
                {sortedUsers[0]?.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex h-20 sm:h-24 w-full items-end justify-center rounded-t-lg bg-yellow-500/20">
              <span className="pb-2 text-3xl sm:text-4xl font-bold text-yellow-500">1</span>
            </div>
            <p className="mt-2 text-center text-xs sm:text-sm font-medium truncate w-full">
              {sortedUsers[0]?.username}
            </p>
            <p className="text-xs text-muted-foreground">{sortedUsers[0]?.rr} RR</p>
          </div>

          {/* 3rd Place */}
          <div className="order-2 flex flex-col items-center">
            <div className="mb-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-amber-600 bg-secondary">
              <span className="text-base sm:text-xl font-bold text-amber-600">
                {sortedUsers[2]?.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex h-12 sm:h-16 w-full items-end justify-center rounded-t-lg bg-amber-600/20">
              <span className="pb-2 text-xl sm:text-2xl font-bold text-amber-600">3</span>
            </div>
            <p className="mt-2 text-center text-xs sm:text-sm font-medium truncate w-full">
              {sortedUsers[2]?.username}
            </p>
            <p className="text-xs text-muted-foreground">{sortedUsers[2]?.rr} RR</p>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {search ? `Search Results (${filteredUsers.length})` : 'All Rankings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user, index) => {
              const rank = search
                ? sortedUsers.findIndex(u => u.id === user.id) + 1
                : index + 1
              return <LeaderboardRow key={user.id} user={user} rank={rank} />
            })
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No players found matching &quot;{search}&quot;
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
