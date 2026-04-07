'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SeasonSelector } from '@/components/season-selector'
import { toast } from 'sonner'
import { ShieldAlert, Plus, Pencil, Loader2, CalendarDays } from 'lucide-react'
import type { Season, UserWithStats } from '@/lib/types'

const ADMIN_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID

export default function AdminPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  // Season creation
  const [seasons, setSeasons] = useState<Season[]>([])
  const [newSeasonName, setNewSeasonName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // MMR management
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)
  const [usersForSeason, setUsersForSeason] = useState<UserWithStats[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // MMR edit dialog
  const [editUser, setEditUser] = useState<UserWithStats | null>(null)
  const [editMmr, setEditMmr] = useState('')
  const [isSavingMmr, setIsSavingMmr] = useState(false)

  // Check admin status
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !ADMIN_ID || user.id !== ADMIN_ID) {
        router.replace('/dashboard')
      } else {
        setIsAdmin(true)
      }
    })
  }, [router])

  // Fetch all seasons
  const fetchSeasons = useCallback(async () => {
    const res = await fetch('/api/seasons')
    if (res.ok) {
      const data: Season[] = await res.json()
      setSeasons(data)
      if (!selectedSeasonId && data.length > 0) {
        const active = data.find(s => s.isActive) ?? data[0]
        setSelectedSeasonId(active.id)
      }
    }
  }, [selectedSeasonId])

  useEffect(() => {
    if (isAdmin) fetchSeasons()
  }, [isAdmin, fetchSeasons])

  // Fetch users for selected season
  useEffect(() => {
    if (!selectedSeasonId) return
    setLoadingUsers(true)
    fetch(`/api/users?seasonId=${selectedSeasonId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: UserWithStats[]) => setUsersForSeason(data))
      .finally(() => setLoadingUsers(false))
  }, [selectedSeasonId])

  async function handleCreateSeason() {
    if (!newSeasonName.trim()) return
    setIsCreating(true)
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSeasonName.trim() }),
    })
    if (res.ok) {
      toast.success('Season created')
      setNewSeasonName('')
      await fetchSeasons()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to create season')
    }
    setIsCreating(false)
  }

  async function handleSaveMmr() {
    if (!editUser || !selectedSeasonId) return
    const mmr = parseInt(editMmr, 10)
    if (isNaN(mmr) || mmr < 0) {
      toast.error('Hidden MMR must be a non-negative number')
      return
    }
    setIsSavingMmr(true)
    const res = await fetch(`/api/seasons/${selectedSeasonId}/mmr`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, hiddenMmr: mmr }),
    })
    if (res.ok) {
      toast.success(`Hidden MMR updated for ${editUser.name}`)
      setEditUser(null)
      // Refresh user list
      const usersRes = await fetch(`/api/users?seasonId=${selectedSeasonId}`)
      if (usersRes.ok) setUsersForSeason(await usersRes.json())
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update MMR')
    }
    setIsSavingMmr(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (isAdmin === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Season management and player MMR settings</p>
        </div>
      </div>

      {/* Create Season */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Create New Season
          </CardTitle>
          <CardDescription>
            Creating a season deactivates the current one and applies hidden-MMR decay (20% toward 800) for all players.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="season-name">Season Name</Label>
              <Input
                id="season-name"
                placeholder="e.g. Spring 2026"
                value={newSeasonName}
                onChange={e => setNewSeasonName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateSeason()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateSeason} disabled={isCreating || !newSeasonName.trim()}>
                {isCreating
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Plus className="mr-2 h-4 w-4" />
                }
                Create Season
              </Button>
            </div>
          </div>

          {/* Seasons list */}
          {seasons.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasons.map(season => (
                    <TableRow key={season.id}>
                      <TableCell className="font-medium">{season.name}</TableCell>
                      <TableCell>
                        {season.isActive ? (
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Ended</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(season.startedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {season.endedAt ? formatDate(season.endedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Hidden MMR */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Manage Hidden MMR</CardTitle>
              <CardDescription className="mt-1">
                Set each player&apos;s hidden MMR for the selected season. This is the starting ELO used for calculations before rank is revealed.
              </CardDescription>
            </div>
            <SeasonSelector
              value={selectedSeasonId}
              onChange={setSelectedSeasonId}
              className="w-44"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : usersForSeason.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No players found for this season.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Hidden MMR</TableHead>
                    <TableHead className="text-right">Visible RR</TableHead>
                    <TableHead className="text-right">Games</TableHead>
                    <TableHead className="text-right">Revealed</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersForSeason.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {user.stats?.hiddenMmr ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {user.stats?.isRevealed
                          ? user.stats.rr
                          : <span className="text-muted-foreground">Hidden</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {user.stats?.gamesPlayed ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.stats?.isRevealed ? (
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0 text-xs">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog
                          open={editUser?.id === user.id}
                          onOpenChange={open => {
                            if (open) {
                              setEditUser(user)
                              setEditMmr(String(user.stats?.hiddenMmr ?? 800))
                            } else {
                              setEditUser(null)
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Set Hidden MMR — {user.name}</DialogTitle>
                              <DialogDescription>
                                Hidden MMR is used as the starting ELO for ELO calculations. It stays hidden until the player has played 5 confirmed matches.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                              <div className="space-y-1.5">
                                <Label htmlFor="mmr-input">Hidden MMR</Label>
                                <Input
                                  id="mmr-input"
                                  type="number"
                                  min={0}
                                  value={editMmr}
                                  onChange={e => setEditMmr(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveMmr()}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1"
                                  onClick={handleSaveMmr}
                                  disabled={isSavingMmr}
                                >
                                  {isSavingMmr && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditUser(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
