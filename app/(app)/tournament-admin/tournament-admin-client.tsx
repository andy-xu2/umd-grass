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
}

export default function TournamentAdminClient() {
  const [division, setDivision] = useState<Division>('AA')
  const [pools, setPools] = useState<Pool[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])

  const [editingGameId, setEditingGameId] = useState<string | null>(null)

  const [set1t1, setSet1t1] = useState('')
  const [set1t2, setSet1t2] = useState('')
  const [set2t1, setSet2t1] = useState('')
  const [set2t2, setSet2t2] = useState('')

  async function fetchTournamentData() {
    const res = await fetch(
      `/api/tournament/pools?division=${division}&tournamentId=${TOURNAMENT_ID}`,
    )

    if (!res.ok) {
      toast.error('Failed to load tournament')
      return
    }

    const data = await res.json()

    setPools(data.pools ?? [])
    setTeams(data.teams ?? [])
    setGames(data.games ?? [])
  }

  useEffect(() => {
    fetchTournamentData()
  }, [division])

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'Unknown'
  }

  function getPoolGames(poolId: string) {
    return games
      .filter(g => g.poolId === poolId)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  async function makeCurrent(gameId: string) {
    const res = await fetch(`/api/tournament/games/${gameId}/make-current`, {
      method: 'POST',
    })

    if (res.ok) {
      toast.success('Set as current')
      fetchTournamentData()
    } else {
      toast.error('Failed')
    }
  }

  async function resetGame(gameId: string) {
    const confirmReset = confirm('Reset this game?')
    if (!confirmReset) return

    const res = await fetch(`/api/tournament/games/${gameId}/reset`, {
      method: 'POST',
    })

    if (res.ok) {
      toast.success('Game reset')
      fetchTournamentData()
    } else {
      toast.error('Failed')
    }
  }

  async function saveScore(gameId: string) {
    const scores: SetScore[] = []

    if (set1t1 && set1t2) {
      scores.push({
        team1: Number(set1t1),
        team2: Number(set1t2),
      })
    }

    if (set2t1 && set2t2) {
      scores.push({
        team1: Number(set2t1),
        team2: Number(set2t2),
      })
    }

    const res = await fetch(`/api/tournament/games/${gameId}/admin-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setScores: scores }),
    })

    if (res.ok) {
      toast.success('Score updated')
      setEditingGameId(null)
      fetchTournamentData()
    } else {
      toast.error('Failed')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tournament Admin</h1>

      <Tabs value={division} onValueChange={v => setDivision(v as Division)}>
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
              <div key={game.id} className="border p-3 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">
                      {getTeamName(game.team1Id)} vs {getTeamName(game.team2Id)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {game.status}
                    </p>
                  </div>

                  <div className="flex gap-2">
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
                      Edit
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
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <Label>Set 1</Label>
                      <div className="flex gap-2">
                        <Input
                          value={set1t1}
                          onChange={e => setSet1t1(e.target.value)}
                        />
                        <Input
                          value={set1t2}
                          onChange={e => setSet1t2(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Set 2</Label>
                      <div className="flex gap-2">
                        <Input
                          value={set2t1}
                          onChange={e => setSet2t1(e.target.value)}
                        />
                        <Input
                          value={set2t2}
                          onChange={e => setSet2t2(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="col-span-2 flex gap-2">
                      <Button onClick={() => saveScore(game.id)}>
                        Save
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
    </div>
  )
}