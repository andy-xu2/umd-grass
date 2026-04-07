'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getSkillTier } from '@/lib/mock-data'
import { Settings, Camera, Trophy, Gamepad2, Target, TrendingUp, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { SeasonSelector } from '@/components/season-selector'
import { toast } from 'sonner'
import Link from 'next/link'

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
    isRevealed: boolean
  } | null
  rank: number | null
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getWinRate(wins: number, gamesPlayed: number) {
  if (gamesPlayed === 0) return 0
  return Math.round((wins / gamesPlayed) * 100)
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [seasonId, setSeasonId] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchProfile = useCallback(async (sid?: string) => {
    setLoading(true)
    const url = sid ? `/api/users/me?seasonId=${sid}` : '/api/users/me'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setProfile(data)
      setEditName(data.name)
    }
    setLoading(false)
  }, [])

  // Initial load — no seasonId needed, API defaults to active season
  useEffect(() => {
    fetchProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when user picks a different season
  useEffect(() => {
    if (seasonId) fetchProfile(seasonId)
  }, [seasonId, fetchProfile])

  async function handleSaveProfile() {
    if (!profile) return
    setIsSaving(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProfile(prev => prev ? { ...prev, name: updated.name } : prev)
      toast.success('Profile updated')
      setEditDialogOpen(false)
    } else {
      toast.error('Failed to update profile')
    }
    setIsSaving(false)
  }

  function handleSeasonChange(sid: string) {
    setSeasonId(sid)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

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

    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: publicUrl }),
    })

    if (res.ok) {
      setProfile(prev => prev ? { ...prev, avatarUrl: publicUrl } : prev)
      toast.success('Avatar updated')
    } else {
      toast.error('Failed to save avatar')
    }
    setIsUploadingAvatar(false)
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
  const isRevealed = stats?.isRevealed ?? false
  const rr = isRevealed ? (stats?.rr ?? 800) : 800
  const gamesPlayed = stats?.gamesPlayed ?? 0
  const wins = stats?.wins ?? 0
  const unranked = !isRevealed || gamesPlayed < 5
  const tier = getSkillTier(rr)
  const winRate = getWinRate(wins, gamesPlayed)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account and view stats</p>
        </div>
        <div className="flex items-center gap-2">
          <SeasonSelector
            value={seasonId}
            onChange={handleSeasonChange}
            className="w-44"
          />
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your display name</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
              <div className="mt-4 flex justify-center gap-6 sm:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {unranked ? '—' : rr}
                  </p>
                  <p className="text-xs text-muted-foreground">RR</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {profile.rank != null && isRevealed ? `#${profile.rank}` : '—'}
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
                {profile.rank != null && isRevealed ? `#${profile.rank}` : '—'}
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

      {/* Match History — wired in Part 6 */}
      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
          <CardDescription>All your recorded matches</CardDescription>
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
    </div>
  )
}
