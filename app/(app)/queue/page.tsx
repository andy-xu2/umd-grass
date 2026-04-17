'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, PlusCircle, Users, ChevronDown, ChevronUp, Trash2, UserPlus, SkipForward, Pencil } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase-browser'
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
                  onSelect={() => { onChange(u.id); setOpen(false) }}
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [courtName, setCourtName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [queueOpenCourt, setQueueOpenCourt] = useState<CourtResponse | null>(null)
  const [queuePlayer1, setQueuePlayer1] = useState('')
  const [queuePlayer2, setQueuePlayer2] = useState('')
  const [isQueueing, setIsQueueing] = useState(false)

  const [advancingCourtId, setAdvancingCourtId] = useState<string | null>(null)

  const [editQueueEntry, setEditQueueEntry] = useState<{
    courtId: string
    entryId: string
  } | null>(null)
  const [editQueuePlayer1, setEditQueuePlayer1] = useState('')
  const [editQueuePlayer2, setEditQueuePlayer2] = useState('')
  const [isSavingQueueEntry, setIsSavingQueueEntry] = useState(false)

  const loadData = useCallback(async () => {
    const [courtsRes, usersRes] = await Promise.all([
      fetch('/api/courts'),
      fetch('/api/users'),
    ])
    if (courtsRes.ok) setCourts(await courtsRes.json())
    if (usersRes.ok) setUsers(await usersRes.json())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
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
      body: JSON.stringify({ name: courtName }),
    })
    setIsCreating(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to create court')
      return
    }
    setCourtName('')
    setCreateOpen(false)
    await loadData()
  }

  async function handleAdvance(courtId: string) {
    setAdvancingCourtId(courtId)
    const res = await fetch(`/api/courts/${courtId}/next`, { method: 'POST' })
    setAdvancingCourtId(null)
    if (res.ok) await loadData()
  }

  async function handleQueueTeam() {
    if (!queueOpenCourt) return
    setIsQueueing(true)
    const res = await fetch(`/api/courts/${queueOpenCourt.id}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player1Id: queuePlayer1, player2Id: queuePlayer2 }),
    })
    setIsQueueing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to join queue')
      return
    }
    setQueuePlayer1('')
    setQueuePlayer2('')
    setQueueOpenCourt(null)
    await loadData()
  }

  function openEditQueueEntry(courtId: string, entry: CourtResponse['queue'][number]) {
    setEditQueueEntry({ courtId, entryId: entry.id })
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
        body: JSON.stringify({ player1Id: editQueuePlayer1, player2Id: editQueuePlayer2 }),
      },
    )
    setIsSavingQueueEntry(false)
    if (!res.ok) return
    setEditQueueEntry(null)
    await loadData()
  }

  async function handleDeleteCourt(courtId: string) {
    const res = await fetch(`/api/courts/${courtId}`, { method: 'DELETE' })
    if (res.ok) await loadData()
  }

  async function handleRemoveEntry(courtId: string, entryId: string) {
    const res = await fetch(`/api/courts/${courtId}/queue/${entryId}`, { method: 'DELETE' })
    if (res.ok) await loadData()
  }

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
          Create courts and manage waiting teams
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Add Court
          </CardTitle>
          <CardDescription>
            Create a court by name, then let teams join the queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add Court</Button>
            </DialogTrigger>

            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Create Court</DialogTitle>
                <DialogDescription>
                  Give the court a name to get started.
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
                    onKeyDown={e => e.key === 'Enter' && courtName.trim() && !isCreating && handleCreateCourt()}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleCreateCourt}
                    disabled={!courtName.trim() || isCreating}
                  >
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
            const isAdvancing = advancingCourtId === court.id

            return (
              <Card key={court.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <CardTitle>{court.name}</CardTitle>
                      <Badge variant="secondary">{court.queue.length}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedCourtId(expanded ? null : court.id)}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4 sm:mr-2" /> : <ChevronDown className="h-4 w-4 sm:mr-2" />}
                        <span className="hidden sm:inline">Queue</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setQueueOpenCourt(court)
                          setQueuePlayer1(currentUserId ?? '')
                          setQueuePlayer2('')
                        }}
                      >
                        <UserPlus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Join</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAdvance(court.id)}
                        disabled={court.queue.length === 0 || isAdvancing}
                      >
                        {isAdvancing
                          ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                          : <SkipForward className="h-4 w-4 sm:mr-2" />}
                        <span className="hidden sm:inline">Advance</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteCourt(court.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expanded && (
                  <CardContent>
                    {court.queue.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No teams in queue yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {court.queue.map(entry => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between rounded-lg border px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">#{entry.position}</Badge>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs">{getInitials(entry.player1.name)}</AvatarFallback>
                                </Avatar>
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs">{getInitials(entry.player2.name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">
                                  {entry.player1.name} &amp; {entry.player2.name}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => openEditQueueEntry(court.id, entry)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveEntry(court.id, entry.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}

                {/* Join queue dialog */}
                <Dialog
                  open={queueOpenCourt?.id === court.id}
                  onOpenChange={open => {
                    if (open) {
                      setQueueOpenCourt(court)
                      setQueuePlayer1(currentUserId ?? '')
                      setQueuePlayer2('')
                    } else {
                      setQueueOpenCourt(null)
                      setQueuePlayer1('')
                      setQueuePlayer2('')
                    }
                  }}
                >
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Join {court.name}</DialogTitle>
                      <DialogDescription>Add a team to the queue.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Player 1 (you)</Label>
                        <PlayerCombobox
                          value={queuePlayer1}
                          onChange={setQueuePlayer1}
                          options={sortedUsers.filter(u => u.id !== queuePlayer2)}
                          placeholder="Select player"
                          disabled
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
                        <Button className="flex-1" onClick={handleQueueTeam} disabled={!canQueueTeam}>
                          {isQueueing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add Team
                        </Button>
                        <Button variant="outline" onClick={() => setQueueOpenCourt(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit queue entry dialog */}
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
            <DialogDescription>Update the players for this queued team.</DialogDescription>
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
  )
}
