'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { LeaderboardRow } from '@/components/leaderboard-row'
import { SeasonSelector } from '@/components/season-selector'
import { Input } from '@/components/ui/input'
import { Search, Trophy } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/types'

interface MeResponse {
  id: string
  name: string
  stats: { rr: number; isRevealed: boolean } | null
  rank: number | null
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [seasonId, setSeasonId] = useState<string | null>(null)

  const load = useCallback(async (sid?: string) => {
    setLoading(true)
    const qs = sid ? `?seasonId=${sid}` : ''
    const [lbRes, meRes] = await Promise.all([
      fetch(`/api/leaderboard${qs}`),
      fetch(`/api/users/me${qs}`),
    ])

    if (lbRes.ok) {
      const data: LeaderboardResponse = await lbRes.json()
      setEntries(data.entries)
    }
    if (meRes.ok) {
      setMe(await meRes.json())
    }
    setLoading(false)
  }, [])

  // Initial load — defaults to active season
  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when user picks a different season
  useEffect(() => {
    if (seasonId) load(seasonId)
  }, [seasonId, load])

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries
    return entries.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [entries, search])

  const top3 = entries.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Top ranked grass volleyball players</p>
        </div>
        <SeasonSelector
          value={seasonId}
          onChange={id => { setSeasonId(id); setSearch('') }}
          className="w-44"
        />
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
              {loading ? (
                <Skeleton className="h-8 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold">
                  {me?.rank != null ? `#${me.rank}` : '—'}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current RR</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1 ml-auto" />
            ) : (
              <p className="text-2xl font-bold text-primary">
                {me?.stats?.isRevealed ? me.stats.rr : '—'}
              </p>
            )}
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
      {!search && !loading && top3.length >= 2 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {/* 2nd Place */}
          <div className="order-1 flex flex-col items-center">
            <Link href={top3[1] ? (top3[1].userId === me?.id ? '/profile' : `/players/${top3[1].userId}`) : '#'} className="mb-2 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-slate-400 bg-secondary hover:opacity-80 transition-opacity">
              <span className="text-lg sm:text-2xl font-bold text-slate-400">
                {top3[1] ? getInitials(top3[1].name) : ''}
              </span>
            </Link>
            <div className="flex h-16 sm:h-20 w-full items-end justify-center rounded-t-lg bg-slate-400/20">
              <span className="pb-2 text-2xl sm:text-3xl font-bold text-slate-400">2</span>
            </div>
            <Link href={top3[1] ? (top3[1].userId === me?.id ? '/profile' : `/players/${top3[1].userId}`) : '#'} className="mt-2 text-center text-xs sm:text-sm font-medium truncate w-full hover:underline hover:text-primary transition-colors">
              {top3[1]?.name}
            </Link>
            <p className="text-xs text-muted-foreground">{top3[1]?.rr} RR</p>
          </div>

          {/* 1st Place */}
          <div className="order-0 sm:order-1 flex flex-col items-center">
            <Link href={top3[0] ? (top3[0].userId === me?.id ? '/profile' : `/players/${top3[0].userId}`) : '#'} className="mb-2 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-yellow-500 bg-secondary hover:opacity-80 transition-opacity">
              <span className="text-xl sm:text-3xl font-bold text-yellow-500">
                {top3[0] ? getInitials(top3[0].name) : ''}
              </span>
            </Link>
            <div className="flex h-20 sm:h-24 w-full items-end justify-center rounded-t-lg bg-yellow-500/20">
              <span className="pb-2 text-3xl sm:text-4xl font-bold text-yellow-500">1</span>
            </div>
            <Link href={top3[0] ? (top3[0].userId === me?.id ? '/profile' : `/players/${top3[0].userId}`) : '#'} className="mt-2 text-center text-xs sm:text-sm font-medium truncate w-full hover:underline hover:text-primary transition-colors">
              {top3[0]?.name}
            </Link>
            <p className="text-xs text-muted-foreground">{top3[0]?.rr} RR</p>
          </div>

          {/* 3rd Place */}
          {top3.length >= 3 && (
            <div className="order-2 flex flex-col items-center">
              <Link href={top3[2] ? (top3[2].userId === me?.id ? '/profile' : `/players/${top3[2].userId}`) : '#'} className="mb-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-amber-600 bg-secondary hover:opacity-80 transition-opacity">
                <span className="text-base sm:text-xl font-bold text-amber-600">
                  {top3[2] ? getInitials(top3[2].name) : ''}
                </span>
              </Link>
              <div className="flex h-12 sm:h-16 w-full items-end justify-center rounded-t-lg bg-amber-600/20">
                <span className="pb-2 text-xl sm:text-2xl font-bold text-amber-600">3</span>
              </div>
              <Link href={top3[2] ? (top3[2].userId === me?.id ? '/profile' : `/players/${top3[2].userId}`) : '#'} className="mt-2 text-center text-xs sm:text-sm font-medium truncate w-full hover:underline hover:text-primary transition-colors">
                {top3[2]?.name}
              </Link>
              <p className="text-xs text-muted-foreground">{top3[2]?.rr} RR</p>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {search ? `Search Results (${filteredEntries.length})` : 'All Rankings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
            ))
          ) : filteredEntries.length > 0 ? (
            filteredEntries.map(entry => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                currentUserId={me?.id}
              />
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {entries.length === 0
                ? 'No players on the leaderboard yet.'
                : `No players found matching "${search}"`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
