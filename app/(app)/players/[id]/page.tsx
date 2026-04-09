'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MatchCard } from '@/components/match-card'
import { SeasonSelector } from '@/components/season-selector'
import { cn, getInitials } from '@/lib/utils'
import { getSkillTier } from '@/lib/mock-data'
import { Trophy, Gamepad2, Target, TrendingUp, ArrowLeft, User } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { MatchResponse } from '@/lib/types'

type PlayerProfile = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
  stats: {
    rr: number
    gamesPlayed: number
    wins: number
    losses: number
  } | null
  rank: number | null
}

function getWinRate(wins: number, gamesPlayed: number) {
  if (gamesPlayed === 0) return 0
  return Math.round((wins / gamesPlayed) * 100)
}

export default function PlayerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const playerId = params.id as string

  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [matches, setMatches] = useState<MatchResponse[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [seasonId, setSeasonId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Get current user so we can redirect if viewing own profile.
  // getSession() reads from cookie/localStorage — no network call.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id
      if (uid) {
        setCurrentUserId(uid)
        if (uid === playerId) router.replace('/profile')
      }
    })
  }, [playerId, router])

  const fetchProfile = useCallback(async (sid?: string) => {
    setLoading(true)
    const qs = sid ? `?seasonId=${sid}` : ''
    const res = await fetch(`/api/users/${playerId}${qs}`)
    if (res.status === 404) {
      setNotFound(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      setProfile(await res.json())
    }
    setLoading(false)
  }, [playerId])

  const fetchMatches = useCallback(async () => {
    setMatchesLoading(true)
    const res = await fetch(`/api/users/${playerId}/matches`)
    if (res.ok) {
      setMatches(await res.json())
    }
    setMatchesLoading(false)
  }, [playerId])

  useEffect(() => {
    fetchProfile()
    fetchMatches()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (seasonId) fetchProfile(seasonId)
  }, [seasonId, fetchProfile])

  if (notFound) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-muted-foreground">Player not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Failed to load profile.</p>
      </div>
    )
  }

  const stats = profile.stats
  const rr = stats?.rr ?? 0
  const gamesPlayed = stats?.gamesPlayed ?? 0
  const wins = stats?.wins ?? 0
  const unranked = gamesPlayed === 0
  const tier = getSkillTier(rr)
  const winRate = getWinRate(wins, gamesPlayed)

  const confirmedMatches = matches.filter(m => m.status === 'CONFIRMED')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">Player profile</p>
          </div>
        </div>
        <SeasonSelector
          value={seasonId}
          onChange={setSeasonId}
          className="w-44"
        />
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
              <AvatarFallback className="bg-secondary text-3xl font-bold">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                {unranked ? (
                  <Badge variant="secondary">Unranked</Badge>
                ) : (
                  <Badge className={cn(tier.color, 'bg-secondary border-0')}>
                    {tier.name}
                  </Badge>
                )}
              </div>
              <div className="mt-4 flex justify-center gap-6 sm:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {unranked ? '—' : rr}
                  </p>
                  <p className="text-xs text-muted-foreground">RR</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {profile.rank != null ? `#${profile.rank}` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Rank</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{winRate}%</p>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {profile.rank != null ? `#${profile.rank}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Global Rank</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <Gamepad2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{gamesPlayed}</p>
              <p className="text-xs text-muted-foreground">Games Played</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{wins}</p>
              <p className="text-xs text-muted-foreground">Total Wins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unranked ? '—' : rr}</p>
              <p className="text-xs text-muted-foreground">Current RR</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Match History */}
      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
          <CardDescription>
            {confirmedMatches.length} confirmed match{confirmedMatches.length !== 1 ? 'es' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {matchesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))
          ) : confirmedMatches.length > 0 ? (
            confirmedMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                currentUserId={playerId}
              />
            ))
          ) : (
            <div className="py-8 text-center">
              <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No confirmed matches yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link to own profile */}
      {currentUserId && currentUserId !== playerId && (
        <div className="text-center">
          <Link href="/profile">
            <Button variant="outline" size="sm">
              <User className="mr-2 h-4 w-4" />
              View your own profile
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
