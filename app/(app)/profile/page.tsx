'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MatchCard } from '@/components/match-card'
import { currentUser, matches, getSkillTier, isUnranked, getWinRate, users } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { Settings, Camera, Trophy, Gamepad2, Target, TrendingUp, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const tier = getSkillTier(currentUser.rr)
  const unranked = isUnranked(currentUser.gamesPlayed)
  const winRate = getWinRate(currentUser.wins, currentUser.gamesPlayed)

  // Get all matches involving the current user
  const userMatches = matches.filter(m =>
    m.team1.player1.id === currentUser.id ||
    m.team1.player2.id === currentUser.id ||
    m.team2.player1.id === currentUser.id ||
    m.team2.player2.id === currentUser.id
  )

  const currentRank = [...users].sort((a, b) => b.rr - a.rr).findIndex(u => u.id === currentUser.id) + 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account and view stats</p>
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your profile information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Avatar Edit */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2 border-primary/20">
                    <AvatarFallback className="bg-secondary text-2xl font-semibold">
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" defaultValue={currentUser.username} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={currentUser.email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" placeholder="Leave blank to keep current" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setEditDialogOpen(false)}>
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

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarFallback className="bg-secondary text-3xl font-bold">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <h2 className="text-2xl font-bold">{currentUser.username}</h2>
                {unranked ? (
                  <Badge variant="secondary">Unranked</Badge>
                ) : (
                  <Badge className={cn(tier.color, 'bg-secondary border-0')}>
                    {tier.name}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">{currentUser.email}</p>
              <div className="mt-4 flex justify-center gap-6 sm:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{currentUser.rr}</p>
                  <p className="text-xs text-muted-foreground">RR</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">#{currentRank}</p>
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
              <p className="text-2xl font-bold">#{currentRank}</p>
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
              <p className="text-2xl font-bold">{currentUser.gamesPlayed}</p>
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
              <p className="text-2xl font-bold">{currentUser.wins}</p>
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
              <p className="text-2xl font-bold">{currentUser.rr}</p>
              <p className="text-xs text-muted-foreground">Current RR</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Match History */}
      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
          <CardDescription>All your recorded matches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userMatches.length > 0 ? (
            userMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No matches played yet</p>
              <Link href="/submit-match">
                <Button className="mt-4">Submit your first match</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card className="border-destructive/30">
        <CardContent className="p-4">
          <Link href="/login">
            <Button variant="outline" className="w-full gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
