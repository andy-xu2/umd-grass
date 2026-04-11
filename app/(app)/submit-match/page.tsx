'use client'

import { useState, useEffect, useCallback } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { VerificationCard } from '@/components/verification-card'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, CheckCircle, PlusCircle, Clock, Trash2, Trophy, CalendarClock, AlertTriangle, ChevronsUpDown, Check, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isUnranked } from '@/lib/mock-data'
import type { UserWithStats, MatchResponse, SetScore, Season } from '@/lib/types'

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
                  <span className="flex-1">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {!u.stats || isUnranked(u.stats.gamesPlayed) ? 'Unranked' : `${u.stats.rr} RR`}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const emptySet = (): SetScore => ({ team1: 0, team2: 0 })

export default function SubmitMatchPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<UserWithStats[]>([])
  const [myMatches, setMyMatches] = useState<MatchResponse[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null | undefined>(undefined)
  const [loadingData, setLoadingData] = useState(true)

  const [teammate, setTeammate] = useState('')
  const [opponent1, setOpponent1] = useState('')
  const [opponent2, setOpponent2] = useState('')
  const [sets, setSets] = useState<SetScore[]>([emptySet()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [usersRes, matchesRes, seasonsRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/matches'),
      fetch('/api/seasons'),
    ])
    if (usersRes.ok) setAllUsers(await usersRes.json())
    if (matchesRes.ok) setMyMatches(await matchesRes.json())
    if (seasonsRes.ok) {
      const allSeasons: Season[] = await seasonsRes.json()
      setActiveSeason(allSeasons.find(s => s.isActive) ?? null)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
    loadData().finally(() => setLoadingData(false))
  }, [loadData])

  const otherUsers = allUsers
    .filter(u => u.id !== currentUserId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const verifiableMatches = myMatches.filter(
    m =>
      m.status === 'PENDING' &&
      currentUserId &&
      (m.team2Player1.id === currentUserId || m.team2Player2.id === currentUserId),
  )

  const awaitingMatches = myMatches.filter(
    m =>
      m.status === 'PENDING' &&
      currentUserId &&
      (m.team1Player1.id === currentUserId || m.team1Player2.id === currentUserId),
  )

  // Derived scoring state
  const team1SetsWon = sets.filter(s => s.team1 > s.team2).length
  const team2SetsWon = sets.filter(s => s.team2 > s.team1).length
  const hasTiedSet = sets.some(s => s.team1 === s.team2 && (s.team1 > 0 || s.team2 > 0))
  const overallTied = team1SetsWon === team2SetsWon && (team1SetsWon > 0 || team2SetsWon > 0)
  const allSetsValid = sets.every(s => s.team1 !== s.team2 || (s.team1 === 0 && s.team2 === 0))

  const updateSet = (index: number, field: 'team1' | 'team2', raw: string) => {
    const value = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0)
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const addSet = () => setSets(prev => [...prev, emptySet()])

  const removeSet = (index: number) => {
    if (sets.length <= 1) return
    setSets(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teammateId: teammate,
        opponent1Id: opponent1,
        opponent2Id: opponent2,
        sets,
      }),
    })

    setIsSubmitting(false)

    if (!res.ok) {
      const data = await res.json()
      setSubmitError(data.error ?? 'Failed to submit match')
      return
    }

    setSubmitted(true)
    await loadData()
  }

  const handleReset = () => {
    setTeammate('')
    setOpponent1('')
    setOpponent2('')
    setSets([emptySet()])
    setSubmitted(false)
    setSubmitError(null)
  }

  const handleVerify = async (matchId: string, action: 'confirm' | 'reject') => {
    const res = await fetch(`/api/matches/${matchId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) await loadData()
  }

  const handleConfirm = (matchId: string) => handleVerify(matchId, 'confirm')
  const handleReject = (matchId: string) => handleVerify(matchId, 'reject')

  // Season state
  const now = new Date()
  const seasonStart = activeSeason ? new Date(activeSeason.startedAt) : null
  const seasonEnd = activeSeason?.endedAt ? new Date(activeSeason.endedAt) : null
  const seasonNotStarted = seasonStart ? seasonStart > now : false
  const seasonHasEnded = seasonEnd ? seasonEnd < now : false
  const inSession = !!activeSeason && !seasonNotStarted && !seasonHasEnded
  const daysUntilEnd = seasonEnd && !seasonHasEnded
    ? Math.ceil((seasonEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isEndingSoon = daysUntilEnd !== null && daysUntilEnd <= 7

  function formatDisplayDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const canSubmit =
    inSession &&
    !!teammate &&
    !!opponent1 &&
    !!opponent2 &&
    sets.length > 0 &&
    allSetsValid &&
    !hasTiedSet &&
    !overallTied &&
    team1SetsWon !== team2SetsWon &&
    (team1SetsWon > 0 || team2SetsWon > 0) &&
    !isSubmitting

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matches</h1>
        <p className="text-sm text-muted-foreground">Submit new matches and verify pending ones</p>
      </div>

      <Tabs defaultValue="submit" className="space-y-4">
        <TabsList className="flex gap-2 bg-transparent p-0">
          <TabsTrigger
            value="submit"
            className="gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <PlusCircle className="h-4 w-4" />
            Submit Match
          </TabsTrigger>
          <TabsTrigger
            value="verify"
            className="gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Clock className="h-4 w-4" />
            Verify ({verifiableMatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="awaiting"
            className="gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Hourglass className="h-4 w-4" />
            Pending Confirmation ({awaitingMatches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Submit New Match</CardTitle>
              <CardDescription>
                Record a doubles match result. The opposing team will verify before RR changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : inSession ? (submitted ? (
                <div className="flex flex-col items-center py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Match Submitted!</h3>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    Your match is pending verification from the opposing team.
                  </p>
                  <Button onClick={handleReset} className="mt-6">
                    Submit Another Match
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Ending soon banner */}
                  {isEndingSoon && activeSeason && (
                    <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        <span className="font-medium">{activeSeason.name} ends on {formatDisplayDate(activeSeason.endedAt!)}.</span>
                        {daysUntilEnd === 1 ? ' Last day to submit!' : ` ${daysUntilEnd} days left.`}
                      </p>
                    </div>
                  )}
                  {submitError && (
                    <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                      {submitError}
                    </p>
                  )}

                  {/* Your Team */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Your Team</h3>
                    <div className="rounded-lg bg-secondary/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                          <span className="text-sm font-semibold text-primary">
                            {getInitials(allUsers.find(u => u.id === currentUserId)?.name ?? 'You')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {allUsers.find(u => u.id === currentUserId)?.name ?? 'You'}
                          </p>
                          <p className="text-xs text-muted-foreground">(You)</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Select Teammate</Label>
                      <PlayerCombobox
                        value={teammate}
                        onChange={setTeammate}
                        options={otherUsers.filter(u => u.id !== opponent1 && u.id !== opponent2)}
                        placeholder="Choose your teammate"
                        disabled={loadingData}
                      />
                    </div>
                  </div>

                  {/* Opponent Team */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Opponent Team</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Opponent 1</Label>
                        <PlayerCombobox
                          value={opponent1}
                          onChange={setOpponent1}
                          options={otherUsers.filter(u => u.id !== teammate && u.id !== opponent2)}
                          placeholder="Select opponent"
                          disabled={loadingData}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Opponent 2</Label>
                        <PlayerCombobox
                          value={opponent2}
                          onChange={setOpponent2}
                          options={otherUsers.filter(u => u.id !== teammate && u.id !== opponent1)}
                          placeholder="Select opponent"
                          disabled={loadingData}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sets */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">Sets</h3>
                      {(team1SetsWon > 0 || team2SetsWon > 0) && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            team1SetsWon > team2SetsWon
                              ? 'bg-primary/20 text-primary border-0'
                              : team2SetsWon > team1SetsWon
                              ? 'bg-destructive/20 text-destructive border-0'
                              : 'bg-secondary',
                          )}
                        >
                          {team1SetsWon > team2SetsWon
                            ? `Your team leads ${team1SetsWon}–${team2SetsWon}`
                            : team2SetsWon > team1SetsWon
                            ? `Opponents lead ${team2SetsWon}–${team1SetsWon}`
                            : `Tied ${team1SetsWon}–${team2SetsWon}`}
                        </Badge>
                      )}
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 px-1">
                      <span className="w-12 text-center text-xs text-muted-foreground" />
                      <span className="text-center text-xs font-medium text-muted-foreground">Your Team</span>
                      <span className="text-center text-xs text-muted-foreground">vs</span>
                      <span className="text-center text-xs font-medium text-muted-foreground">Opponents</span>
                      <span className="w-8" />
                    </div>

                    <div className="space-y-2">
                      {sets.map((set, i) => {
                        const setWinner =
                          set.team1 > set.team2
                            ? 'team1'
                            : set.team2 > set.team1
                            ? 'team2'
                            : null
                        const isTied = set.team1 === set.team2 && (set.team1 > 0 || set.team2 > 0)

                        return (
                          <div
                            key={i}
                            className={cn(
                              'grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 rounded-lg px-3 py-2',
                              isTied
                                ? 'bg-destructive/10'
                                : 'bg-secondary/20',
                            )}
                          >
                            {/* Set label + winner indicator */}
                            <div className="flex w-12 flex-col items-center gap-0.5">
                              <span className="text-xs text-muted-foreground">Set {i + 1}</span>
                              {setWinner && (
                                <Trophy
                                  className={cn(
                                    'h-3 w-3',
                                    setWinner === 'team1' ? 'text-primary' : 'text-orange-500',
                                  )}
                                />
                              )}
                            </div>

                            <Input
                              type="number"
                              min="0"
                              value={set.team1 === 0 ? '' : set.team1}
                              placeholder="0"
                              onChange={e => updateSet(i, 'team1', e.target.value)}
                              className={cn(
                                'text-center text-base font-semibold',
                                setWinner === 'team1' && 'border-primary ring-1 ring-primary/30',
                              )}
                            />

                            <span className="text-center text-sm text-muted-foreground">–</span>

                            <Input
                              type="number"
                              min="0"
                              value={set.team2 === 0 ? '' : set.team2}
                              placeholder="0"
                              onChange={e => updateSet(i, 'team2', e.target.value)}
                              className={cn(
                                'text-center text-base font-semibold',
                                setWinner === 'team2' && 'border-orange-500 ring-1 ring-orange-500/30',
                              )}
                            />

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeSet(i)}
                              disabled={sets.length === 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={addSet}
                    >
                      <PlusCircle className="h-4 w-4" />
                      Add Set
                    </Button>

                    {hasTiedSet && (
                      <p className="text-xs text-destructive">Each set must have a clear winner (no ties).</p>
                    )}
                    {overallTied && !hasTiedSet && (
                      <p className="text-xs text-destructive">The overall match cannot be tied.</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={!canSubmit}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Match'
                    )}
                  </Button>
                </form>
              )) : seasonNotStarted && activeSeason ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <CalendarClock className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{activeSeason.name} hasn&apos;t started yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Season opens on <span className="font-medium text-foreground">{formatDisplayDate(activeSeason.startedAt)}</span>
                  </p>
                </div>
              ) : seasonHasEnded && activeSeason ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <CalendarClock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Season has ended</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeSeason.name} ended on <span className="font-medium text-foreground">{formatDisplayDate(activeSeason.endedAt!)}</span>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <CalendarClock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">No active season</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Check back when a new season is announced.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify">
          <div className="space-y-4">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : verifiableMatches.length > 0 ? (
              verifiableMatches.map(match => (
                <VerificationCard
                  key={match.id}
                  match={match}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">All Caught Up!</h3>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    No pending matches to verify.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="awaiting">
          <div className="space-y-4">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : awaitingMatches.length > 0 ? (
              awaitingMatches.map(match => {
                const daysLeft = Math.ceil(
                  (new Date(match.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                )
                return (
                  <Card key={match.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1">
                          <Hourglass className="h-3 w-3" />
                          Awaiting Confirmation
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(match.submittedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-4">
                        {/* Team 1 (you) */}
                        <div className="flex flex-1 flex-col items-center gap-2 rounded-lg bg-primary/10 p-3">
                          <div className="flex -space-x-2">
                            {[match.team1Player1, match.team1Player2].map(p => (
                              <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                                <AvatarFallback className="bg-secondary text-xs">
                                  {getInitials(p.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <div className="text-center">
                            <p className="text-xs">{match.team1Player1.name}</p>
                            <p className="text-xs">{match.team1Player2.name}</p>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-lg font-bold">{match.team1Sets}</span>
                            <span className="text-xs text-muted-foreground">–</span>
                            <span className="text-lg font-bold">{match.team2Sets}</span>
                          </div>
                          {match.setScores && match.setScores.length > 0 && (
                            <div className="flex flex-col items-center gap-0.5">
                              {match.setScores.map((s, i) => (
                                <span key={i} className="font-mono text-xs text-muted-foreground">
                                  {s.team1}–{s.team2}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Team 2 (opponents) */}
                        <div className="flex flex-1 flex-col items-center gap-2 rounded-lg bg-secondary/30 p-3">
                          <div className="flex -space-x-2">
                            {[match.team2Player1, match.team2Player2].map(p => (
                              <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                                <AvatarFallback className="bg-secondary text-xs">
                                  {getInitials(p.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <div className="text-center">
                            <p className="text-xs">{match.team2Player1.name}</p>
                            <p className="text-xs">{match.team2Player2.name}</p>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} if not verified
                      </p>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <Hourglass className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">No Pending Matches</h3>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    Matches you submit will appear here until the other team verifies them.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
