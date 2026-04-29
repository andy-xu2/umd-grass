'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

type Division = 'AA' | 'BB'
type GameStatus = 'pending' | 'live' | 'complete'

type SetScore = {
  team1: number
  team2: number
}

type Pool = {
  id: string
  name: string
}

type Team = {
  id: string
  name: string
  poolId: string
}

type Game = {
  id: string
  poolId: string
  team1Id: string
  team2Id: string
  status: GameStatus
  setScores: SetScore[]
  orderIndex: number
}

type PlayoffGame = {
  id: string
  division: Division
  round: string
  label: string
  team1Id: string | null
  team2Id: string | null
  team1Source: string | null
  team2Source: string | null
  status: GameStatus
  setScores: SetScore[]
  orderIndex: number
}

export default function TournamentAdminClient() {
  const [division, setDivision] = useState<Division>('AA')

  const [pools, setPools] = useState<Pool[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [playoffGames, setPlayoffGames] = useState<PlayoffGame[]>([])

  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const [editingPlayoffGameId, setEditingPlayoffGameId] = useState<string | null>(null)

  const [set1t1, setSet1t1] = useState('')
  const [set1t2, setSet1t2] = useState('')
  const [set2t1, setSet2t1] = useState('')
  const [set2t2, setSet2t2] = useState('')

  const [playoffSet1Team1, setPlayoffSet1Team1] = useState('')
  const [playoffSet1Team2, setPlayoffSet1Team2] = useState('')
  const [playoffSet2Team1, setPlayoffSet2Team1] = useState('')
  const [playoffSet2Team2, setPlayoffSet2Team2] = useState('')
  const [playoffSet3Team1, setPlayoffSet3Team1] = useState('')
  const [playoffSet3Team2, setPlayoffSet3Team2] = useState('')

  async function fetchTournamentData() {
    const [poolRes, playoffRes] = await Promise.all([
      fetch(`/api/tournament/pools?division=${division}&tournamentId=${TOURNAMENT_ID}`),
      fetch(`/api/tournament/playoffs?division=${division}&tournamentId=${TOURNAMENT_ID}`),
    ])

    if (poolRes.ok) {
      const data = await poolRes.json()
      setPools(data.pools ?? [])
      setTeams(data.teams ?? [])
      setGames(data.games ?? [])
    } else {
      toast.error('Failed to load tournament pools')
    }

    if (playoffRes.ok) {
      const data = await playoffRes.json()
      setPlayoffGames(data.games ?? [])
    } else {
      toast.error('Failed to load playoff games')
    }
  }

  useEffect(() => {
    fetchTournamentData()
  }, [division])

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'Unknown'
  }

  function getPlayoffTeamName(game: PlayoffGame, side: 'team1' | 'team2') {
    const teamId = side === 'team1' ? game.team1Id : game.team2Id
    const source = side === 'team1' ? game.team1Source : game.team2Source

    if (teamId) return getTeamName(teamId)
    return source ?? 'TBD'
  }

  function getPoolGames(poolId: string) {
    return games
      .filter(g => g.poolId === poolId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
  }

  async function makeCurrent(gameId: string) {
    const res = await fetch(`/api/tournament/games/${gameId}/make-current`, {
      method: 'POST',
    })

    if (res.ok) {
      toast.success('Set as current')
      await fetchTournamentData()
    } else {
      toast.error('Failed to set current game')
    }
  }

  async function resetGame(gameId: string) {
    const confirmed = window.confirm(
      'Reset this game? This will clear its score and make it pending.',
    )

    if (!confirmed) return

    const res = await fetch(`/api/tournament/games/${gameId}/reset`, {
      method: 'POST',
    })

    if (res.ok) {
      toast.success('Game reset')
      await fetchTournamentData()
    } else {
      toast.error('Failed to reset game')
    }
  }

  async function saveScore(gameId: string) {
    const scores: SetScore[] = []

    if (set1t1 !== '' && set1t2 !== '') {
      scores.push({
        team1: Number(set1t1),
        team2: Number(set1t2),
      })
    }

    if (set2t1 !== '' && set2t2 !== '') {
      scores.push({
        team1: Number(set2t1),
        team2: Number(set2t2),
      })
    }

    const res = await fetch(`/api/tournament/games/${gameId}/admin-score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setScores: scores,
        status: scores.length > 0 ? 'complete' : 'pending',
      }),
    })

    if (res.ok) {
      toast.success('Score updated')
      setEditingGameId(null)
      setSet1t1('')
      setSet1t2('')
      setSet2t1('')
      setSet2t2('')
      await fetchTournamentData()
    } else {
      toast.error('Failed to update score')
    }
  }

  async function savePlayoffGameScore() {
    if (!editingPlayoffGameId) return

    const setScores: SetScore[] = []

    if (playoffSet1Team1 !== '' && playoffSet1Team2 !== '') {
      setScores.push({
        team1: Number(playoffSet1Team1),
        team2: Number(playoffSet1Team2),
      })
    }

    if (playoffSet2Team1 !== '' && playoffSet2Team2 !== '') {
      setScores.push({
        team1: Number(playoffSet2Team1),
        team2: Number(playoffSet2Team2),
      })
    }

    if (playoffSet3Team1 !== '' && playoffSet3Team2 !== '') {
      setScores.push({
        team1: Number(playoffSet3Team1),
        team2: Number(playoffSet3Team2),
      })
    }

    const res = await fetch(`/api/tournament/playoffs/${editingPlayoffGameId}/admin-score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setScores,
        status: setScores.length > 0 ? 'complete' : 'pending',
      }),
    })

    if (res.ok) {
      toast.success('Playoff score updated')
      setEditingPlayoffGameId(null)
      setPlayoffSet1Team1('')
      setPlayoffSet1Team2('')
      setPlayoffSet2Team1('')
      setPlayoffSet2Team2('')
      setPlayoffSet3Team1('')
      setPlayoffSet3Team2('')
      await fetchTournamentData()
    } else {
      toast.error('Failed to update playoff score')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tournament Admin</h1>

      <Tabs value={division} onValueChange={value => setDivision(value as Division)}>
        <TabsList>
          <TabsTrigger value="AA">AA</TabsTrigger>
          <TabsTrigger value="BB">BB</TabsTrigger>
        </TabsList>
      </Tabs>

      {pools.map(pool => (
        <Card key={pool.id}>
          <CardHeader>
            <CardTitle>{pool.name}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {getPoolGames(pool.id).map(game => (
              <div key={game.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      Game {game.orderIndex}: {getTeamName(game.team1Id)} vs{' '}
                      {getTeamName(game.team2Id)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {game.status}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={game.status === 'live'}
                      onClick={() => makeCurrent(game.id)}
                    >
                      Make Current
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingGameId(game.id)
                        setSet1t1(String(game.setScores?.[0]?.team1 ?? ''))
                        setSet1t2(String(game.setScores?.[0]?.team2 ?? ''))
                        setSet2t1(String(game.setScores?.[1]?.team1 ?? ''))
                        setSet2t2(String(game.setScores?.[1]?.team2 ?? ''))
                      }}
                    >
                      Edit Score
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => resetGame(game.id)}
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                {editingGameId === game.id && (
                  <div className="space-y-3 rounded-md bg-secondary/30 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Set 1 {getTeamName(game.team1Id)}</Label>
                        <Input
                          type="number"
                          value={set1t1}
                          onChange={e => setSet1t1(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Set 1 {getTeamName(game.team2Id)}</Label>
                        <Input
                          type="number"
                          value={set1t2}
                          onChange={e => setSet1t2(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Set 2 {getTeamName(game.team1Id)}</Label>
                        <Input
                          type="number"
                          value={set2t1}
                          onChange={e => setSet2t1(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Set 2 {getTeamName(game.team2Id)}</Label>
                        <Input
                          type="number"
                          value={set2t2}
                          onChange={e => setSet2t2(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => saveScore(game.id)}>
                        Save Score
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setEditingGameId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Playoff Games</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {playoffGames.map(game => (
            <div key={game.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {game.label}: {getPlayoffTeamName(game, 'team1')} vs{' '}
                    {getPlayoffTeamName(game, 'team2')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {game.round} · Status: {game.status}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPlayoffGameId(game.id)
                    setPlayoffSet1Team1(String(game.setScores?.[0]?.team1 ?? ''))
                    setPlayoffSet1Team2(String(game.setScores?.[0]?.team2 ?? ''))
                    setPlayoffSet2Team1(String(game.setScores?.[1]?.team1 ?? ''))
                    setPlayoffSet2Team2(String(game.setScores?.[1]?.team2 ?? ''))
                    setPlayoffSet3Team1(String(game.setScores?.[2]?.team1 ?? ''))
                    setPlayoffSet3Team2(String(game.setScores?.[2]?.team2 ?? ''))
                  }}
                >
                  Edit Score
                </Button>
              </div>

              {editingPlayoffGameId === game.id && (
                <div className="space-y-3 rounded-md bg-secondary/30 p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>Set 1 {getPlayoffTeamName(game, 'team1')}</Label>
                      <Input
                        type="number"
                        value={playoffSet1Team1}
                        onChange={e => setPlayoffSet1Team1(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Set 1 {getPlayoffTeamName(game, 'team2')}</Label>
                      <Input
                        type="number"
                        value={playoffSet1Team2}
                        onChange={e => setPlayoffSet1Team2(e.target.value)}
                      />
                    </div>

                    <div />

                    <div>
                      <Label>Set 2 {getPlayoffTeamName(game, 'team1')}</Label>
                      <Input
                        type="number"
                        value={playoffSet2Team1}
                        onChange={e => setPlayoffSet2Team1(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Set 2 {getPlayoffTeamName(game, 'team2')}</Label>
                      <Input
                        type="number"
                        value={playoffSet2Team2}
                        onChange={e => setPlayoffSet2Team2(e.target.value)}
                      />
                    </div>

                    <div />

                    <div>
                      <Label>Set 3 {getPlayoffTeamName(game, 'team1')}</Label>
                      <Input
                        type="number"
                        value={playoffSet3Team1}
                        onChange={e => setPlayoffSet3Team1(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Set 3 {getPlayoffTeamName(game, 'team2')}</Label>
                      <Input
                        type="number"
                        value={playoffSet3Team2}
                        onChange={e => setPlayoffSet3Team2(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={savePlayoffGameScore}>
                      Save Score
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setEditingPlayoffGameId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}