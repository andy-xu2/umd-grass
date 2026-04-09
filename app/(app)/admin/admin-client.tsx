'use client'

import { useState, useCallback, useRef } from 'react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { SeasonSelector } from '@/components/season-selector'
import { toast } from 'sonner'
import { ShieldAlert, Plus, Pencil, Loader2, CalendarDays, Trash2, ClipboardEdit } from 'lucide-react'
import type { Season, UserWithStats, MatchResponse, SetScore } from '@/lib/types'

interface Props {
  initialSeasons: Season[]
  initialSeasonId: string | null
  initialUsers: UserWithStats[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ScoreDisplay({ match }: { match: MatchResponse }) {
  const sets = match.setScores ?? []
  if (sets.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="font-mono text-sm">
      {sets.map((s, i) => (
        <span key={i}>{i > 0 && ' · '}{s.team1}–{s.team2}</span>
      ))}
    </span>
  )
}

export default function AdminClient({ initialSeasons, initialSeasonId, initialUsers }: Props) {
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(initialSeasonId)
  const [usersForSeason, setUsersForSeason] = useState<UserWithStats[]>(initialUsers)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const loadedSeasonId = useRef<string | null>(initialSeasonId)

  const [editUser, setEditUser] = useState<UserWithStats | null>(null)
  const [editRr, setEditRr] = useState('')
  const [isSavingRr, setIsSavingRr] = useState(false)

  // Match management
  const [matches, setMatches] = useState<MatchResponse[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [matchesLoaded, setMatchesLoaded] = useState<string | null>(null)
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null)
  const [editScoreMatch, setEditScoreMatch] = useState<MatchResponse | null>(null)
  const [editScoreSets, setEditScoreSets] = useState<SetScore[]>([])
  const [isSavingScore, setIsSavingScore] = useState(false)

  const fetchUsers = useCallback(async (sid: string) => {
    setLoadingUsers(true)
    const res = await fetch(`/api/users?seasonId=${sid}`)
    if (res.ok) {
      setUsersForSeason(await res.json())
      loadedSeasonId.current = sid
    }
    setLoadingUsers(false)
  }, [])

  const fetchMatches = useCallback(async (sid: string) => {
    setLoadingMatches(true)
    const res = await fetch(`/api/admin/matches?seasonId=${sid}`)
    if (res.ok) {
      setMatches(await res.json())
      setMatchesLoaded(sid)
    }
    setLoadingMatches(false)
  }, [])

  function handleSeasonChange(sid: string) {
    setSelectedSeasonId(sid)
    if (sid !== loadedSeasonId.current) fetchUsers(sid)
    if (sid !== matchesLoaded) fetchMatches(sid)
  }

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
      const seasonsRes = await fetch('/api/seasons')
      if (seasonsRes.ok) {
        const data: Season[] = await seasonsRes.json()
        setSeasons(data)
        const newActive = data.find(s => s.isActive) ?? data[0]
        if (newActive) {
          setSelectedSeasonId(newActive.id)
          await Promise.all([fetchUsers(newActive.id), fetchMatches(newActive.id)])
        }
      }
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to create season')
    }
    setIsCreating(false)
  }

  async function handleSaveRr() {
    if (!editUser || !selectedSeasonId) return
    const rr = parseInt(editRr, 10)
    if (isNaN(rr) || rr < 0) {
      toast.error('RR must be a non-negative number')
      return
    }
    setIsSavingRr(true)
    const res = await fetch(`/api/seasons/${selectedSeasonId}/mmr`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, rr }),
    })
    if (res.ok) {
      toast.success(`RR updated for ${editUser.name}`)
      setEditUser(null)
      const usersRes = await fetch(`/api/users?seasonId=${selectedSeasonId}`)
      if (usersRes.ok) setUsersForSeason(await usersRes.json())
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update RR')
    }
    setIsSavingRr(false)
  }

  async function handleDeleteMatch(matchId: string) {
    setDeletingMatchId(matchId)
    const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Match deleted and RR reversed')
      setMatches(prev => prev.filter(m => m.id !== matchId))
      if (selectedSeasonId) fetchUsers(selectedSeasonId)
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to delete match')
    }
    setDeletingMatchId(null)
  }

  function openEditScore(match: MatchResponse) {
    setEditScoreMatch(match)
    setEditScoreSets(match.setScores ? [...match.setScores] : [{ team1: 0, team2: 0 }])
  }

  function updateSet(idx: number, field: 'team1' | 'team2', value: string) {
    setEditScoreSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: parseInt(value) || 0 } : s))
  }

  function addSet() {
    setEditScoreSets(prev => [...prev, { team1: 0, team2: 0 }])
  }

  function removeSet(idx: number) {
    setEditScoreSets(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSaveScore() {
    if (!editScoreMatch) return
    setIsSavingScore(true)
    const res = await fetch(`/api/matches/${editScoreMatch.id}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setScores: editScoreSets }),
    })
    if (res.ok) {
      toast.success('Match score updated and RR recalculated')
      setEditScoreMatch(null)
      if (selectedSeasonId) {
        await Promise.all([fetchMatches(selectedSeasonId), fetchUsers(selectedSeasonId)])
      }
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update score')
    }
    setIsSavingScore(false)
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
          <p className="text-sm text-muted-foreground">Season management, player RR, and match controls</p>
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
            Creating a season deactivates the current one and applies a 2-rank decay to all players&apos; RR (–1000, floor 0; capped at 1500 if above 2500).
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

      {/* Manage Player RR */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Manage Player RR</CardTitle>
              <CardDescription className="mt-1">
                Directly set any player&apos;s RR for the selected season.
              </CardDescription>
            </div>
            <SeasonSelector
              value={selectedSeasonId}
              onChange={handleSeasonChange}
              className="w-44"
              initialSeasons={seasons}
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
                    <TableHead className="text-right">RR</TableHead>
                    <TableHead className="text-right">Games</TableHead>
                    <TableHead className="text-right">W / L</TableHead>
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
                        {user.stats?.rr ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.stats?.gamesPlayed ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {user.stats ? `${user.stats.wins} / ${user.stats.losses}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Dialog
                          open={editUser?.id === user.id}
                          onOpenChange={open => {
                            if (open) {
                              setEditUser(user)
                              setEditRr(String(user.stats?.rr ?? 800))
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
                              <DialogTitle>Set RR — {user.name}</DialogTitle>
                              <DialogDescription>
                                Override this player&apos;s RR directly. This will not create an rr_changes record.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                              <div className="space-y-1.5">
                                <Label htmlFor="rr-input">RR</Label>
                                <Input
                                  id="rr-input"
                                  type="number"
                                  min={0}
                                  value={editRr}
                                  onChange={e => setEditRr(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveRr()}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1"
                                  onClick={handleSaveRr}
                                  disabled={isSavingRr}
                                >
                                  {isSavingRr && (
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

      {/* Match Management */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardEdit className="h-5 w-5" />
                Match Management
              </CardTitle>
              <CardDescription className="mt-1">
                Delete a confirmed match (reverses all RR changes) or edit its score (recalculates RR).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMatches ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No confirmed matches for this season.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teams</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map(match => (
                    <TableRow key={match.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {match.team1Player1.name} &amp; {match.team1Player2.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            vs {match.team2Player1.name} &amp; {match.team2Player2.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ScoreDisplay match={match} />
                        <span className="ml-2 text-xs font-semibold">
                          {match.team1Sets > match.team2Sets
                            ? <span className="text-green-600">{match.team1Sets}–{match.team2Sets}</span>
                            : <span className="text-red-500">{match.team1Sets}–{match.team2Sets}</span>
                          }
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(match.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditScore(match)}
                            title="Edit score"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={deletingMatchId === match.id}
                                title="Delete match"
                              >
                                {deletingMatchId === match.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this match?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the match between{' '}
                                  <strong>{match.team1Player1.name} &amp; {match.team1Player2.name}</strong>{' '}
                                  vs{' '}
                                  <strong>{match.team2Player1.name} &amp; {match.team2Player2.name}</strong>{' '}
                                  and reverse all RR changes for the 4 players.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteMatch(match.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Score Dialog */}
      <Dialog open={!!editScoreMatch} onOpenChange={open => !open && setEditScoreMatch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Match Score</DialogTitle>
            <DialogDescription>
              {editScoreMatch && (
                <>
                  {editScoreMatch.team1Player1.name} &amp; {editScoreMatch.team1Player2.name}
                  {' vs '}
                  {editScoreMatch.team2Player1.name} &amp; {editScoreMatch.team2Player2.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Team 1</span>
                <span />
                <span>Team 2</span>
              </div>
              {editScoreSets.map((set, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={set.team1}
                    onChange={e => updateSet(i, 'team1', e.target.value)}
                    className="text-center"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    type="number"
                    min={0}
                    value={set.team2}
                    onChange={e => updateSet(i, 'team2', e.target.value)}
                    className="text-center"
                  />
                  {editScoreSets.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeSet(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSet} className="w-full">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add Set
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveScore} disabled={isSavingScore}>
                {isSavingScore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save &amp; Recalculate RR
              </Button>
              <Button variant="outline" onClick={() => setEditScoreMatch(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
