'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VerificationCard } from '@/components/verification-card'
import { users, matches, currentUser } from '@/lib/mock-data'
import { Loader2, CheckCircle, PlusCircle, Clock } from 'lucide-react'

export default function SubmitMatchPage() {
  const [teammate, setTeammate] = useState('')
  const [opponent1, setOpponent1] = useState('')
  const [opponent2, setOpponent2] = useState('')
  const [yourScore, setYourScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const pendingMatches = matches.filter(m => m.status === 'pending')
  const otherUsers = users.filter(u => u.id !== currentUser.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    setSubmitted(true)
  }

  const handleReset = () => {
    setTeammate('')
    setOpponent1('')
    setOpponent2('')
    setYourScore('')
    setOpponentScore('')
    setSubmitted(false)
  }

  const handleConfirm = (matchId: string) => {
    console.log('Confirmed match:', matchId)
  }

  const handleReject = (matchId: string) => {
    console.log('Rejected match:', matchId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Matches</h1>
        <p className="text-sm text-muted-foreground">Submit new matches and verify pending ones</p>
      </div>

      <Tabs defaultValue="submit" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submit" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Submit Match
          </TabsTrigger>
          <TabsTrigger value="verify" className="gap-2">
            <Clock className="h-4 w-4" />
            Verify ({pendingMatches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Submit New Match</CardTitle>
              <CardDescription>
                Record a doubles match result. All players will need to verify before RR changes.
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
                    Your match is pending verification from other players.
                  </p>
                  <Button onClick={handleReset} className="mt-6">
                    Submit Another Match
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Your Team */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Your Team</h3>
                    <div className="rounded-lg bg-secondary/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                          <span className="text-sm font-semibold text-primary">
                            {currentUser.username.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{currentUser.username}</p>
                          <p className="text-xs text-muted-foreground">(You)</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Select Teammate</Label>
                      <Select value={teammate} onValueChange={setTeammate}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose your teammate" />
                        </SelectTrigger>
                        <SelectContent>
                          {otherUsers
                            .filter(u => u.id !== opponent1 && u.id !== opponent2)
                            .map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.username} ({user.rr} RR)
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
                        <Select value={opponent1} onValueChange={setOpponent1}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select opponent" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherUsers
                              .filter(u => u.id !== teammate && u.id !== opponent2)
                              .map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.username} ({user.rr} RR)
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Opponent 2</Label>
                        <Select value={opponent2} onValueChange={setOpponent2}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select opponent" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherUsers
                              .filter(u => u.id !== teammate && u.id !== opponent1)
                              .map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.username} ({user.rr} RR)
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Score (Optional)</h3>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div className="space-y-2">
                        <Label>Your Team</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="99"
                          value={yourScore}
                          onChange={(e) => setYourScore(e.target.value)}
                          className="text-center text-lg"
                        />
                      </div>
                      <span className="mt-6 text-muted-foreground">vs</span>
                      <div className="space-y-2">
                        <Label>Opponents</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="99"
                          value={opponentScore}
                          onChange={(e) => setOpponentScore(e.target.value)}
                          className="text-center text-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!teammate || !opponent1 || !opponent2 || isSubmitting}
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
            {pendingMatches.length > 0 ? (
              pendingMatches.map(match => (
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
