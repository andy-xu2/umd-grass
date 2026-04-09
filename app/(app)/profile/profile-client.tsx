'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { getSkillTier, isUnranked } from '@/lib/mock-data'
import { Camera, Trophy, Gamepad2, Target, TrendingUp, Loader2, Star, Award, BarChart3 } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import { SeasonSelector } from '@/components/season-selector'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Season, AllTimeStats } from '@/lib/types'

type UserProfile = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
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

interface Props {
  initialProfile: UserProfile
  initialSeasonId: string | null
  initialSeasons: Season[]
  initialAllTime: AllTimeStats
}

export default function ProfileClient({ initialProfile, initialSeasonId, initialSeasons, initialAllTime }: Props) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile)
  const [allTime] = useState<AllTimeStats>(initialAllTime)
  const [loadingSeason, setLoadingSeason] = useState(false)
  const [seasonId, setSeasonId] = useState<string | null>(initialSeasonId)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadedSeasonId = useRef<string | null>(initialSeasonId)

  const fetchProfile = useCallback(async (sid: string) => {
    setLoadingSeason(true)
    const res = await fetch(`/api/users/me?seasonId=${sid}`)
    if (res.ok) {
      setProfile(await res.json())
      loadedSeasonId.current = sid
    }
    setLoadingSeason(false)
  }, [])

  function handleSeasonChange(sid: string | null) {
    setSeasonId(sid)
    if (sid && sid !== loadedSeasonId.current) fetchProfile(sid)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    const supabase = createClient()

    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      toast.error('Failed to upload avatar')
      setIsUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: cacheBustedUrl }),
    })

    if (res.ok) {
      setProfile(prev => ({ ...prev, avatarUrl: cacheBustedUrl }))
      toast.success('Avatar updated')
    } else {
      toast.error('Failed to save avatar')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsUploadingAvatar(false)
  }

  const stats = profile.stats
  const rr = stats?.rr ?? 0
  const gamesPlayed = stats?.gamesPlayed ?? 0
  const wins = stats?.wins ?? 0
  const unranked = isUnranked(gamesPlayed)
  const tier = getSkillTier(rr)
  const winRate = getWinRate(wins, gamesPlayed)
  const allTimeTier = getSkillTier(allTime.peakRR)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your stats and match history</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-primary/20">
                {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
                <AvatarFallback className="bg-secondary text-3xl font-bold">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUploadingAvatar
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Camera className="h-4 w-4" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
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
              <p className="mt-1 text-muted-foreground">{profile.email}</p>
              {unranked && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {gamesPlayed === 0
                    ? 'Play 5 placement games to earn your rank'
                    : `${gamesPlayed}/5 placement games completed`}
                </p>
              )}
              <div className="mt-4 flex justify-center gap-6 sm:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {unranked ? '—' : rr}
                  </p>
                  <p className="text-xs text-muted-foreground">RR</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {!unranked && profile.rank != null ? `#${profile.rank}` : '—'}
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

      {/* Tabs: This Season / All Time */}
      <Tabs defaultValue="season">
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="season">This Season</TabsTrigger>
            <TabsTrigger value="alltime">All Time</TabsTrigger>
          </TabsList>
          <SeasonSelector
            value={seasonId}
            onChange={handleSeasonChange}
            className="w-44"
            initialSeasons={initialSeasons}
          />
        </div>

        {/* Season Stats */}
        <TabsContent value="season" className="mt-4 space-y-4">
          {loadingSeason ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {!unranked && profile.rank != null ? `#${profile.rank}` : '—'}
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
                    <p className="text-xs text-muted-foreground">Wins</p>
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
          )}

          <Card>
            <CardHeader>
              <CardTitle>Match History</CardTitle>
              <CardDescription>All your recorded matches this season</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No matches played yet</p>
                <Link href="/submit-match">
                  <Button className="mt-4">Submit your first match</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All-Time Stats */}
        <TabsContent value="alltime" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/20">
                  <Star className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allTime.peakRR}</p>
                  <p className="text-xs text-muted-foreground">Peak RR</p>
                  <p className={cn('text-xs font-medium', allTimeTier.color)}>{allTimeTier.name}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                  <Gamepad2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allTime.totalGames}</p>
                  <p className="text-xs text-muted-foreground">Total Games</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
                  <Target className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allTime.totalWins}</p>
                  <p className="text-xs text-muted-foreground">Total Wins</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/20">
                  <TrendingUp className="h-6 w-6 text-red-500 rotate-180" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allTime.totalLosses}</p>
                  <p className="text-xs text-muted-foreground">Total Losses</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {allTime.totalGames > 0
                      ? `${Math.round((allTime.totalWins / allTime.totalGames) * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">All-Time Win Rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20">
                  <Award className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allTime.seasonsPlayed}</p>
                  <p className="text-xs text-muted-foreground">Seasons Played</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
