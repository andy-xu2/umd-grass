'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, PlusCircle, Users, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { CourtResponse, UserWithStats } from '@/lib/types'

function PlayerCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  options: UserWithStats[]
  placeholder: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(u => u.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          {selected ? selected.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search players..." />
          <CommandList>
            <CommandEmpty>No players found.</CommandEmpty>
            <CommandGroup>
              {options.map(u => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => {
                    onChange(u.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === u.id ? 'opacity-100' : 'opacity-0')} />
                  <span>{u.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function QueuePage() {
  const [courts, setCourts] = useState<CourtResponse[]>([])
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [courtName, setCourtName] = useState('')
  const [team1Player1, setTeam1Player1] = useState('')
  const [team1Player2, setTeam1Player2] = useState('')
  const [team2Player1, setTeam2Player1] = useState('')
  const [team2Player2, setTeam2Player2] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [queueOpenCourt, setQueueOpenCourt] = useState<CourtResponse | null>(null)
  const [queuePlayer1, setQueuePlayer1] = useState('')
  const [queuePlayer2, setQueuePlayer2] = useState('')
  const [isQueueing, setIsQueueing] = useState(false)

  const [nextGameCourt, setNextGameCourt] = useState<CourtResponse | null>(null)
  const [winningTeam, setWinningTeam] = useState<'team1' | 'team2' | ''>('')
  const [isAdvancing, setIsAdvancing] = useState(false)
  
  const [editCourt, setEditCourt] = useState<CourtResponse | null>(null)
  const [editCourtName, setEditCourtName] = useState('')
  const [editTeam1Player1, setEditTeam1Player1] = useState('')
  const [editTeam1Player2, setEditTeam1Player2] = useState('')
  const [editTeam2Player1, setEditTeam2Player1] = useState('')
  const [editTeam2Player2, setEditTeam2Player2] = useState('')
  const [isSavingCourt, setIsSavingCourt] = useState(false)

  const [editQueueEntry, setEditQueueEntry] = useState<{
    courtId: string
    entryId: string
    player1Id: string
    player2Id: string
  } | null>(null)
  
  const [editQueuePlayer1, setEditQueuePlayer1] = useState('')
  const [editQueuePlayer2, setEditQueuePlayer2] = useState('')
  const [isSavingQueueEntry, setIsSavingQueueEntry] = useState(false)

  const loadData = useCallback(async () => {
    const [courtsRes, usersRes] = await Promise.all([
      fetch('/api/courts'),
      fetch('/api/users'),
    ])

    if (courtsRes.ok) {
      setCourts(await courtsRes.json())
    }

    if (usersRes.ok) {
      setUsers(await usersRes.json())
    }
  }, [])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  async function handleCreateCourt() {
    setIsCreating(true)

    const res = await fetch('/api/courts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: courtName,
        team1Player1Id: team1Player1,
        team1Player2Id: team1Player2,
        team2Player1Id: team2Player1,
        team2Player2Id: team2Player2,
      }),
    })

    setIsCreating(false)

    if (!res.ok) {
      return
    }

    setCourtName('')
    setTeam1Player1('')
    setTeam1Player2('')
    setTeam2Player1('')
    setTeam2Player2('')
    setCreateOpen(false)

    await loadData()
  }

  async function handleNextGame() {
    if (!nextGameCourt || !winningTeam) return

    setIsAdvancing(true)

    const res = await fetch(`/api/courts/${nextGameCourt.id}/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner: winningTeam }),
    })

    setIsAdvancing(false)

    if (res.ok) {
        setNextGameCourt(null)
        setWinningTeam('')
        await loadData()
    }
  }
  
  function openEditQueueEntry(courtId: string, entry: CourtResponse['queue'][number]) {
    setEditQueueEntry({
        courtId,
        entryId: entry.id,
        player1Id: entry.player1.id,
        player2Id: entry.player2.id,
    })
    setEditQueuePlayer1(entry.player1.id)
    setEditQueuePlayer2(entry.player2.id)
  }
  
  async function handleSaveQueueEntry() {
    if (!editQueueEntry) return

    setIsSavingQueueEntry(true)

    const res = await fetch(
        `/api/courts/${editQueueEntry.courtId}/queue/${editQueueEntry.entryId}`,
        {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            player1Id: editQueuePlayer1,
            player2Id: editQueuePlayer2,
        }),
        },
    )

    setIsSavingQueueEntry(false)

    if (!res.ok) return

    setEditQueueEntry(null)
    setEditQueuePlayer1('')
    setEditQueuePlayer2('')
    await loadData()
  }
  
  async function handleDeleteCourt(courtId: string) {
    const res = await fetch(`/api/courts/${courtId}`, {
        method: 'DELETE',
    })

    if (res.ok) {
        await loadData()
    }
  }

  async function handleQueueTeam() {
    if (!queueOpenCourt) return
    setIsQueueing(true)

    const res = await fetch(`/api/courts/${queueOpenCourt.id}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1Id: queuePlayer1,
        player2Id: queuePlayer2,
      }),
    })
    

    setIsQueueing(false)

    if (!res.ok) {
      return
    }

    setQueuePlayer1('')
    setQueuePlayer2('')
    setQueueOpenCourt(null)

    await loadData()
  }

  function openEditCourt(court: CourtResponse) {
    setEditCourt(court)
    setEditCourtName(court.name)
    setEditTeam1Player1(court.team1Player1.id)
    setEditTeam1Player2(court.team1Player2.id)
    setEditTeam2Player1(court.team2Player1.id)
    setEditTeam2Player2(court.team2Player2.id)
    }

    async function handleSaveCourt() {
    if (!editCourt) return

    setIsSavingCourt(true)

    const res = await fetch(`/api/courts/${editCourt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        name: editCourtName,
        team1Player1Id: editTeam1Player1,
        team1Player2Id: editTeam1Player2,
        team2Player1Id: editTeam2Player1,
        team2Player2Id: editTeam2Player2,
        }),
    })

    setIsSavingCourt(false)

    if (!res.ok) return

    setEditCourt(null)
    await loadData()
  }
  
  async function handleRemoveEntry(courtId: string, entryId: string) {
    const res = await fetch(`/api/courts/${courtId}/queue/${entryId}`, {
        method: 'DELETE',
    })

    if (res.ok) {
        await loadData()
    }
  }

  const canCreateCourt =
    !!courtName.trim() &&
    !!team1Player1 &&
    !!team1Player2 &&
    !!team2Player1 &&
    !!team2Player2 &&
    new Set([team1Player1, team1Player2, team2Player1, team2Player2]).size === 4 &&
    !isCreating

  const canQueueTeam =
    !!queueOpenCourt &&
    !!queuePlayer1 &&
    !!queuePlayer2 &&
    queuePlayer1 !== queuePlayer2 &&
    !isQueueing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Queue</h1>
        <p className="text-sm text-muted-foreground">
          Create courts and add teams to each court’s queue
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Add Court
          </CardTitle>
          <CardDescription>
            Create a court with two active teams, then allow new teams to join the queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add Court</Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Court</DialogTitle>
                <DialogDescription>
                  Set the court name and choose the two teams currently playing.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="court-name">Court Name</Label>
                  <Input
                    id="court-name"
                    placeholder="e.g. Court 1"
                    value={courtName}
                    onChange={e => setCourtName(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Team 1</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Player 1</Label>
                      <PlayerCombobox
                        value={team1Player1}
                        onChange={setTeam1Player1}
                        options={sortedUsers.filter(
                          u =>
                            ![
                              team1Player2,
                              team2Player1,
                              team2Player2,
                            ].includes(u.id),
                        )}
                        placeholder="Select player"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Player 2</Label>
                      <PlayerCombobox
                        value={team1Player2}
                        onChange={setTeam1Player2}
                        options={sortedUsers.filter(
                          u =>
                            ![
                              team1Player1,
                              team2Player1,
                              team2Player2,
                            ].includes(u.id),
                        )}
                        placeholder="Select player"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Team 2</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Player 1</Label>
                      <PlayerCombobox
                        value={team2Player1}
                        onChange={setTeam2Player1}
                        options={sortedUsers.filter(
                          u =>
                            ![
                              team1Player1,
                              team1Player2,
                              team2Player2,
                            ].includes(u.id),
                        )}
                        placeholder="Select player"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Player 2</Label>
                      <PlayerCombobox
                        value={team2Player2}
                        onChange={setTeam2Player2}
                        options={sortedUsers.filter(
                          u =>
                            ![
                              team1Player1,
                              team1Player2,
                              team2Player1,
                            ].includes(u.id),
                        )}
                        placeholder="Select player"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleCreateCourt} disabled={!canCreateCourt}>
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Court
                  </Button>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : courts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No Courts Yet</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Create the first court to start a queue.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
            {courts.map(court => {
                const expanded = expandedCourtId === court.id

                return (
                <Card key={court.id}>
                    <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                        <CardTitle>{court.name}</CardTitle>
                        <CardDescription>
                            Current court matchup and waiting teams
                        </CardDescription>
                        </div>

                        <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setExpandedCourtId(expanded ? null : court.id)}
                        >
                            {expanded ? (
                            <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                View
                            </>
                            ) : (
                            <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                View
                            </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => openEditCourt(court)}
                        >
                            Edit Players
                        </Button>

                        <Button
                            onClick={() => {
                            setQueueOpenCourt(court)
                            setQueuePlayer1('')
                            setQueuePlayer2('')
                            }}
                        >
                            Queue
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => {
                            setNextGameCourt(court)
                            setWinningTeam('')
                            }}
                            disabled={court.queue.length === 0}
                        >
                            Next Game
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={() => handleDeleteCourt(court.id)}
                        >
                            Delete Court
                        </Button>

                        <Dialog
                            open={!!nextGameCourt}
                            onOpenChange={open => {
                                if (!open) {
                                setNextGameCourt(null)
                                setWinningTeam('')
                                }
                            }}
                            >
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                <DialogTitle>Advance to Next Game</DialogTitle>
                                <DialogDescription>
                                    {nextGameCourt
                                    ? 'Choose the winning team. The losing team will be replaced by the next team in queue.'
                                    : 'Choose the winning team.'}
                                </DialogDescription>
                                </DialogHeader>

                                {nextGameCourt && (
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                    <Label>Winning Team</Label>

                                    <div className="grid gap-3">
                                        <Button
                                        type="button"
                                        variant={winningTeam === 'team1' ? 'default' : 'outline'}
                                        className="justify-start h-auto py-3"
                                        onClick={() => setWinningTeam('team1')}
                                        >
                                        <div className="text-left">
                                            <p className="font-medium">
                                            {nextGameCourt.team1Player1.name} &amp; {nextGameCourt.team1Player2.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Team 1 stays on court</p>
                                        </div>
                                        </Button>

                                        <Button
                                        type="button"
                                        variant={winningTeam === 'team2' ? 'default' : 'outline'}
                                        className="justify-start h-auto py-3"
                                        onClick={() => setWinningTeam('team2')}
                                        >
                                        <div className="text-left">
                                            <p className="font-medium">
                                            {nextGameCourt.team2Player1.name} &amp; {nextGameCourt.team2Player2.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Team 2 stays on court</p>
                                        </div>
                                        </Button>
                                    </div>
                                    </div>

                                    {nextGameCourt.queue.length > 0 && (
                                    <div className="rounded-lg border bg-secondary/20 px-4 py-3">
                                        <p className="text-sm font-medium">Next team in queue</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                        {nextGameCourt.queue[0].player1.name} &amp; {nextGameCourt.queue[0].player2.name}
                                        </p>
                                    </div>
                                    )}

                                    <div className="flex gap-2">
                                    <Button
                                        className="flex-1"
                                        onClick={handleNextGame}
                                        disabled={!winningTeam || isAdvancing}
                                    >
                                        {isAdvancing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Confirm Next Game
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                        setNextGameCourt(null)
                                        setWinningTeam('')
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    </div>
                                </div>
                                )}
                            </DialogContent>
                        </Dialog>
                        
                        <Dialog
                            open={queueOpenCourt?.id === court.id}
                            onOpenChange={open => {
                            if (open) {
                                setQueueOpenCourt(court)
                            } else {
                                setQueueOpenCourt(null)
                                setQueuePlayer1('')
                                setQueuePlayer2('')
                            }
                            }}
                        >
                            <DialogTrigger asChild>
                            </DialogTrigger>

                            <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Join {court.name}</DialogTitle>
                                <DialogDescription>
                                Add a team to the queue for this court.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                <Label>Player 1</Label>
                                <PlayerCombobox
                                    value={queuePlayer1}
                                    onChange={setQueuePlayer1}
                                    options={sortedUsers.filter(u => u.id !== queuePlayer2)}
                                    placeholder="Select player"
                                />
                                </div>

                                <div className="space-y-2">
                                <Label>Player 2</Label>
                                <PlayerCombobox
                                    value={queuePlayer2}
                                    onChange={setQueuePlayer2}
                                    options={sortedUsers.filter(u => u.id !== queuePlayer1)}
                                    placeholder="Select player"
                                />
                                </div>

                                <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleQueueTeam}
                                    disabled={!canQueueTeam}
                                >
                                    {isQueueing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Team
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setQueueOpenCourt(null)}
                                >
                                    Cancel
                                </Button>
                                </div>
                            </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog
                            open={!!editCourt}
                            onOpenChange={open => {
                                if (!open) {
                                setEditCourt(null)
                                }
                            }}
                            >
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                <DialogTitle>Edit Court</DialogTitle>
                                <DialogDescription>
                                    Update the court name and the two active teams.
                                </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-court-name">Court Name</Label>
                                    <Input
                                    id="edit-court-name"
                                    value={editCourtName}
                                    onChange={e => setEditCourtName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-muted-foreground">Team 1</h3>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Player 1</Label>
                                        <PlayerCombobox
                                        value={editTeam1Player1}
                                        onChange={setEditTeam1Player1}
                                        options={sortedUsers.filter(
                                            u => ![editTeam1Player2, editTeam2Player1, editTeam2Player2].includes(u.id),
                                        )}
                                        placeholder="Select player"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Player 2</Label>
                                        <PlayerCombobox
                                        value={editTeam1Player2}
                                        onChange={setEditTeam1Player2}
                                        options={sortedUsers.filter(
                                            u => ![editTeam1Player1, editTeam2Player1, editTeam2Player2].includes(u.id),
                                        )}
                                        placeholder="Select player"
                                        />
                                    </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-muted-foreground">Team 2</h3>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Player 1</Label>
                                        <PlayerCombobox
                                        value={editTeam2Player1}
                                        onChange={setEditTeam2Player1}
                                        options={sortedUsers.filter(
                                            u => ![editTeam1Player1, editTeam1Player2, editTeam2Player2].includes(u.id),
                                        )}
                                        placeholder="Select player"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Player 2</Label>
                                        <PlayerCombobox
                                        value={editTeam2Player2}
                                        onChange={setEditTeam2Player2}
                                        options={sortedUsers.filter(
                                            u => ![editTeam1Player1, editTeam1Player2, editTeam2Player1].includes(u.id),
                                        )}
                                        placeholder="Select player"
                                        />
                                    </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                    className="flex-1"
                                    onClick={handleSaveCourt}
                                    disabled={
                                        !editCourtName.trim() ||
                                        !editTeam1Player1 ||
                                        !editTeam1Player2 ||
                                        !editTeam2Player1 ||
                                        !editTeam2Player2 ||
                                        new Set([
                                        editTeam1Player1,
                                        editTeam1Player2,
                                        editTeam2Player1,
                                        editTeam2Player2,
                                        ]).size !== 4 ||
                                        isSavingCourt
                                    }
                                    >
                                    {isSavingCourt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                    </Button>

                                    <Button variant="outline" onClick={() => setEditCourt(null)}>
                                    Cancel
                                    </Button>
                                </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog
                            open={!!editQueueEntry}
                            onOpenChange={open => {
                                if (!open) {
                                setEditQueueEntry(null)
                                setEditQueuePlayer1('')
                                setEditQueuePlayer2('')
                                }
                            }}
                            >
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                <DialogTitle>Edit Queued Team</DialogTitle>
                                <DialogDescription>
                                    Update the players for this queued team.
                                </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Player 1</Label>
                                    <PlayerCombobox
                                    value={editQueuePlayer1}
                                    onChange={setEditQueuePlayer1}
                                    options={sortedUsers.filter(u => u.id !== editQueuePlayer2)}
                                    placeholder="Select player"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Player 2</Label>
                                    <PlayerCombobox
                                    value={editQueuePlayer2}
                                    onChange={setEditQueuePlayer2}
                                    options={sortedUsers.filter(u => u.id !== editQueuePlayer1)}
                                    placeholder="Select player"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                    className="flex-1"
                                    onClick={handleSaveQueueEntry}
                                    disabled={
                                        !editQueuePlayer1 ||
                                        !editQueuePlayer2 ||
                                        editQueuePlayer1 === editQueuePlayer2 ||
                                        isSavingQueueEntry
                                    }
                                    >
                                    {isSavingQueueEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                    </Button>

                                    <Button
                                    variant="outline"
                                    onClick={() => {
                                        setEditQueueEntry(null)
                                        setEditQueuePlayer1('')
                                        setEditQueuePlayer2('')
                                    }}
                                    >
                                    Cancel
                                    </Button>
                                </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        </div>
                    </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg bg-primary/10 p-4">
                        <p className="text-sm font-medium text-muted-foreground">Team 1</p>
                        <div className="mt-3 flex flex-col gap-2">
                            {[court.team1Player1, court.team1Player2].map(player => (
                            <div key={player.id} className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{player.name}</span>
                            </div>
                            ))}
                        </div>
                        </div>

                        <div className="rounded-lg bg-secondary/30 p-4">
                        <p className="text-sm font-medium text-muted-foreground">Team 2</p>
                        <div className="mt-3 flex flex-col gap-2">
                            {[court.team2Player1, court.team2Player2].map(player => (
                            <div key={player.id} className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{player.name}</span>
                            </div>
                            ))}
                        </div>
                        </div>
                    </div>

                    {expanded && (
                        <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground">Queue</h3>
                            <Badge variant="secondary">{court.queue.length}</Badge>
                        </div>

                        {court.queue.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                            No teams in queue yet.
                            </p>
                        ) : (
                            <div className="space-y-2">
                            {court.queue.map(entry => (
                                <div
                                key={entry.id}
                                className="flex items-center justify-between rounded-lg border px-4 py-3"
                                >
                                <div>
                                    <p className="font-medium">
                                    {entry.player1.name} &amp; {entry.player2.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                    Added {new Date(entry.createdAt).toLocaleString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">#{entry.position}</Badge>
                                    
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={() => openEditQueueEntry(court.id, entry)}
                                        title="Edit team"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>

                                    <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveEntry(court.id, entry.id)}
                                    title="Remove team"
                                    >
                                    ✕
                                    </Button>
                                </div>
                                </div>
                            ))}
                            </div>
                        )}
                        </div>
                    )}
                    </CardContent>
                </Card>
                )
            })}
            </div>
      )}
    </div>
  )
}