'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VerificationCard } from '@/components/verification-card'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, CheckCircle, PlusCircle, Clock } from 'lucide-react'
import type { UserWithStats, MatchResponse } from '@/lib/types'

export default function SubmitMatchPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<UserWithStats[]>([])
  const [myMatches, setMyMatches] = useState<MatchResponse[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [teammate, setTeammate] = useState('')
  const [opponent1, setOpponent1] = useState('')
  const [opponent2, setOpponent2] = useState('')
  const [yourScore, setYourScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [usersRes, matchesRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/matches'),
    ])
    if (usersRes.ok) setAllUsers(await usersRes.json())
    if (matchesRes.ok) setMyMatches(await matchesRes.json())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
    loadData().finally(() => setLoadingData(false))
  }, [loadData])

  const otherUsers = allUsers.filter(u => u.id !== currentUserId)

  const verifiableMatches = myMatches.filter(
    m =>
      m.status === 'PENDING' &&
      currentUserId &&
      (m.team2Player1.id === currentUserId || m.team2Player2.id === currentUserId),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    const team1Sets = parseInt(yourScore, 10)
    const team2Sets = parseInt(opponentScore, 10)

    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teammateId: teammate, opponent1Id: opponent1, opponent2Id: opponent2, team1Sets, team2Sets }),
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
    setYourScore('')
    setOpponentScore('')
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

  function displayRr(u: UserWithStats) {
    if (!u.stats) return 'Unranked'
    if (!u.stats.isRevealed) return 'Unranked'
    return `${u.stats.rr} RR`
  }

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
              {submitted ? (
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
                      <Select value={teammate} onValueChange={setTeammate} disabled={loadingData}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose your teammate" />
                        </SelectTrigger>
                        <SelectContent>
                          {otherUsers
                            .filter(u => u.id !== opponent1 && u.id !== opponent2)
                            .map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name} ({displayRr(u)})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Opponent Team */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Opponent Team</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Opponent 1</Label>
                        <Select value={opponent1} onValueChange={setOpponent1} disabled={loadingData}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select opponent" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherUsers
                              .filter(u => u.id !== teammate && u.id !== opponent2)
                              .map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name} ({displayRr(u)})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Opponent 2</Label>
                        <Select value={opponent2} onValueChange={setOpponent2} disabled={loadingData}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select opponent" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherUsers
                              .filter(u => u.id !== teammate && u.id !== opponent1)
                              .map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name} ({displayRr(u)})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Score</h3>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div className="space-y-2">
                        <Label>Your Team (sets)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="9"
                          value={yourScore}
                          onChange={e => setYourScore(e.target.value)}
                          className="text-center text-lg"
                          required
                        />
                      </div>
                      <span className="mt-6 text-muted-foreground">vs</span>
                      <div className="space-y-2">
                        <Label>Opponents (sets)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="9"
                          value={opponentScore}
                          onChange={e => setOpponentScore(e.target.value)}
                          className="text-center text-lg"
                          required
                        />
                      </div>
                    </div>
                    {yourScore && opponentScore && yourScore === opponentScore && (
                      <p className="text-xs text-destructive">Score cannot be a tie.</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !teammate ||
                      !opponent1 ||
                      !opponent2 ||
                      !yourScore ||
                      !opponentScore ||
                      yourScore === opponentScore ||
                      isSubmitting
                    }
                  >
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
      </Tabs>
    </div>
  )
}
