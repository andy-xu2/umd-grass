'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Play, Plus, Minus, Trophy } from 'lucide-react'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

type Division = 'AA' | 'BB'
type View = 'pool' | 'playoffs'
type GameStatus = 'pending' | 'live' | 'complete'

type SetScore = {
  team1: number
  team2: number
}

type LiveScore = {
  team1: number
  team2: number
}

type Pool = {
  id: string
  tournamentId: string
  division: Division
  name: string
}

type Team = {
  id: string
  poolId: string
  name: string
}

type Game = {
  id: string
  poolId: string
  team1Id: string
  team2Id: string
  status: GameStatus
  setScores: SetScore[]
  liveScore: LiveScore | null
  orderIndex: number
  scoredBy: string | null
}

type Standing = {
  team: Team
  seed: number
  setsWon: number
  setsLost: number
  pointDiff: number
}

type PlayoffSlot = {
  team: Team
  pool: string
  poolSeed: number
  setsWon: number
  setsLost: number
  pointDiff: number
}

type PlaceholderSlot = {
  placeholder: string
}

type PlayoffGame = {
  id: string
  tournamentId: string
  division: Division
  round: string
  label: string
  team1Id: string | null
  team2Id: string | null
  team1Source: string | null
  team2Source: string | null
  status: GameStatus
  setScores: SetScore[]
  liveScore: LiveScore | null
  orderIndex: number
}

const workTeamByOrder: Record<number, number> = {
  1: 4,
  2: 3,
  3: 2,
  4: 4,
  5: 1,
  6: 3,
}

export default function TournamentPage({ currentUserId }: { currentUserId: string | null }) {  const [division, setDivision] = useState<Division>('AA')
  const [view, setView] = useState<View>('pool')
  const [pools, setPools] = useState<Pool[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [playoffGames, setPlayoffGames] = useState<PlayoffGame[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const loadTournament = useCallback(async () => {
    setLoading(true)

    const [poolRes, playoffRes] = await Promise.all([
      fetch(`/api/tournament/pools?division=${division}&tournamentId=${TOURNAMENT_ID}`),
      fetch(`/api/tournament/playoffs?division=${division}&tournamentId=${TOURNAMENT_ID}`),
    ])

    if (poolRes.ok) {
      const data = await poolRes.json()
      setPools(data.pools ?? [])
      setTeams(data.teams ?? [])
      setGames(data.games ?? [])
    }

    if (playoffRes.ok) {
      const data = await playoffRes.json()
      setPlayoffGames(data.games ?? [])
    }

    setLoading(false)
  }, [division])

  useEffect(() => {
    loadTournament()
  }, [loadTournament])

  const teamById = useMemo(() => {
    return new Map(teams.map(team => [team.id, team]))
  }, [teams])

  function getTeamName(id: string) {
    return teamById.get(id)?.name ?? 'Unknown'
  }

  function getPoolTeams(poolId: string) {
    return teams
      .filter(team => team.poolId === poolId)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  function getTeamNumber(teamId: string) {
    const team = teamById.get(teamId)
    if (!team) return 0

    return getPoolTeams(team.poolId).findIndex(t => t.id === teamId) + 1
  }

  function getLocalOrderIndex(game: Game) {
    const a = getTeamNumber(game.team1Id)
    const b = getTeamNumber(game.team2Id)
    const low = Math.min(a, b)
    const high = Math.max(a, b)

    if (low === 1 && high === 3) return 1
    if (low === 2 && high === 4) return 2
    if (low === 1 && high === 4) return 3
    if (low === 2 && high === 3) return 4
    if (low === 3 && high === 4) return 5
    if (low === 1 && high === 2) return 6

    return game.orderIndex
  }

  function getWorkTeamName(game: Game) {
    const workNum = workTeamByOrder[getLocalOrderIndex(game)]
    const poolTeams = getPoolTeams(game.poolId)

    return poolTeams[workNum - 1]?.name ?? 'TBD'
  }

  function getPoolGames(poolId: string) {
    return games
      .filter(game => game.poolId === poolId)
      .sort((a, b) => getLocalOrderIndex(a) - getLocalOrderIndex(b))
  }

  function getCurrentGame(poolId: string) {
    return getPoolGames(poolId).find(game => game.status === 'live') ?? null
  }

  function getNextGame(poolId: string) {
    const poolGames = getPoolGames(poolId)
    const current = poolGames.find(game => game.status === 'live')

    // If no game is currently live, use the first pending game in scheduled order.
    if (!current) {
        return poolGames.find(game => game.status === 'pending') ?? null
    }

    const currentOrder = getLocalOrderIndex(current)

    // Prefer the next pending game after the current game.
    const nextAfterCurrent = poolGames.find(
        game =>
        game.status === 'pending' &&
        getLocalOrderIndex(game) > currentOrder,
    )

    if (nextAfterCurrent) return nextAfterCurrent

    // If there are no later pending games, loop back to the first pending game.
    return poolGames.find(game => game.status === 'pending') ?? null
  }

  function calculateStandings(poolId: string): Standing[] {
    const poolTeams = getPoolTeams(poolId)

    const standings = poolTeams.map((team, index) => ({
      team,
      seed: index + 1,
      setsWon: 0,
      setsLost: 0,
      pointDiff: 0,
    }))

    const standingByTeam = new Map(standings.map(s => [s.team.id, s]))

    for (const game of getPoolGames(poolId)) {
      if (game.status === 'pending') continue

      const team1 = standingByTeam.get(game.team1Id)
      const team2 = standingByTeam.get(game.team2Id)
      if (!team1 || !team2) continue

      for (const set of game.setScores ?? []) {
        if (set.team1 > set.team2) {
          team1.setsWon += 1
          team2.setsLost += 1
        } else if (set.team2 > set.team1) {
          team2.setsWon += 1
          team1.setsLost += 1
        }

        team1.pointDiff += set.team1 - set.team2
        team2.pointDiff += set.team2 - set.team1
      }
    }

    return standings.sort((a, b) => {
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff
      return a.setsLost - b.setsLost
    })
  }

  function getTeamGames(teamId: string) {
    return games
      .filter(game => game.team1Id === teamId || game.team2Id === teamId)
      .sort((a, b) => getLocalOrderIndex(a) - getLocalOrderIndex(b))
  }

  function formatResult(game: Game, teamId: string) {
    if (game.status === 'pending') return 'Upcoming'
    if (game.status === 'live') return 'Live'

    const isTeam1 = game.team1Id === teamId
    const teamSets = game.setScores.filter(set =>
      isTeam1 ? set.team1 > set.team2 : set.team2 > set.team1,
    ).length

    const oppSets = game.setScores.length - teamSets
    const result = teamSets > oppSets ? 'W' : 'L'
    const scores = game.setScores.map(set => `${set.team1}-${set.team2}`).join(', ')

    return `${result} ${teamSets}-${oppSets} (${scores})`
  }

  function getPoolQualifiers() {
    return pools.flatMap(pool => {
      const standings = calculateStandings(pool.id)

      return standings.slice(0, 2).map((standing, index) => ({
        team: standing.team,
        pool: pool.name,
        poolSeed: index + 1,
        setsWon: standing.setsWon,
        setsLost: standing.setsLost,
        pointDiff: standing.pointDiff,
      }))
    })
  }

  function getRankedPlayoffTeams() {
    return getPoolQualifiers().sort((a, b) => {
      if (a.poolSeed !== b.poolSeed) return a.poolSeed - b.poolSeed
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff
      return a.setsLost - b.setsLost
    })
  }

  function getAABracket() {
    const teams = getRankedPlayoffTeams()

    return [
      { label: 'QF 1', team1: teams[0], team2: teams[7] },
      { label: 'QF 2', team1: teams[3], team2: teams[4] },
      { label: 'QF 3', team1: teams[1], team2: teams[6] },
      { label: 'QF 4', team1: teams[2], team2: teams[5] },
    ]
  }

  function getBBBracket() {
    const teams = getRankedPlayoffTeams()

    return {
      playIns: [
        { label: 'Play-In 1', team1: teams[6], team2: teams[9] },
        { label: 'Play-In 2', team1: teams[7], team2: teams[8] },
      ],
      quarters: [
        { label: 'QF 1', team1: teams[0], team2: { placeholder: 'Winner Play-In 2' } },
        { label: 'QF 2', team1: teams[3], team2: teams[4] },
        { label: 'QF 3', team1: teams[1], team2: { placeholder: 'Winner Play-In 1' } },
        { label: 'QF 4', team1: teams[2], team2: teams[5] },
      ],
    }
  }

  function renderBracketTeam(slot?: PlayoffSlot | PlaceholderSlot) {
    if (!slot) {
      return <span className="text-muted-foreground">TBD</span>
    }

    if ('placeholder' in slot) {
      return <span className="text-muted-foreground">{slot.placeholder}</span>
    }

    return (
      <div>
        <p className="font-medium">{slot.team.name}</p>
        <p className="text-xs text-muted-foreground">
          {slot.pool} #{slot.poolSeed} · Sets {slot.setsWon}-{slot.setsLost} · Diff{' '}
          {slot.pointDiff > 0 ? '+' : ''}
          {slot.pointDiff}
        </p>
      </div>
    )
  }

  async function startGame(game: Game) {
    setIsUpdating(true)

    const res = await fetch(`/api/tournament/games/${game.id}/start`, {
      method: 'POST',
    })

    if (res.ok) {
      await loadTournament()
    }

    setIsUpdating(false)
  }

  async function cancelLiveGame(game: Game) {
    setIsUpdating(true)

    const res = await fetch(`/api/tournament/games/${game.id}/cancel`, {
      method: 'POST',
    })

    if (res.ok) {
      await loadTournament()
    }

    setIsUpdating(false)
  }

  async function updateLiveScore(game: Game, score: LiveScore) {
    const cleanScore = {
      team1: Math.max(0, score.team1),
      team2: Math.max(0, score.team2),
    }

    setGames(prev =>
      prev.map(g => (g.id === game.id ? { ...g, liveScore: cleanScore } : g)),
    )

    await fetch(`/api/tournament/games/${game.id}/live`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanScore),
    })
  }

  async function completeGame(game: Game) {
      if (!game.liveScore) return

    if (game.liveScore.team1 === game.liveScore.team2) {
        alert('Score cannot be tied.')
        return
    }

    setIsUpdating(true)

    const completedSets = [...(game.setScores ?? []), game.liveScore]
    const TOTAL_SETS = 2 // pool play is always 2 sets

    if (completedSets.length < TOTAL_SETS) {
        // Save the set result but keep the game live, reset score for next set
        await fetch(`/api/tournament/games/${game.id}/admin-score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            setScores: completedSets,
            status: 'live',
        }),
        })

        // Reset live score for next set
        await fetch(`/api/tournament/games/${game.id}/live`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team1: 0, team2: 0 }),
        })
    } else {
        // All sets done — mark complete
        await fetch(`/api/tournament/games/${game.id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game.liveScore),
        })
    }

    await loadTournament()
    setIsUpdating(false)
  }

  function GameMini({ game, label }: { game: Game | null; label: string }) {
    if (!game) {
      return (
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">None</p>
        </div>
      )
    }

    return (
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">
          {getTeamName(game.team1Id)} vs {getTeamName(game.team2Id)}
        </p>
        <p className="text-xs text-muted-foreground">
          Work: {getWorkTeamName(game)}
        </p>
      </div>
    )
  }

  async function startPlayoffGame(game: PlayoffGame) {
    setIsUpdating(true)

    const res = await fetch(`/api/tournament/playoffs/${game.id}/start`, {
      method: 'POST',
    })

    if (res.ok) await loadTournament()

    setIsUpdating(false)
  }

  async function updatePlayoffLiveScore(game: PlayoffGame, score: LiveScore) {
    const cleanScore = {
      team1: Math.max(0, score.team1),
      team2: Math.max(0, score.team2),
    }

    setPlayoffGames(prev =>
      prev.map(g => g.id === game.id ? { ...g, liveScore: cleanScore } : g),
    )

    await fetch(`/api/tournament/playoffs/${game.id}/live`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanScore),
    })
  }

  async function cancelPlayoffGame(game: PlayoffGame) {
    setIsUpdating(true)

    const res = await fetch(`/api/tournament/playoffs/${game.id}/cancel`, {
      method: 'POST',
    })

    if (res.ok) await loadTournament()

    setIsUpdating(false)
  }

  async function completePlayoffGame(game: PlayoffGame) {
    if (!game.liveScore) return

    if (game.liveScore.team1 === game.liveScore.team2) {
      alert('Score cannot be tied.')
      return
    }

    setIsUpdating(true)

    const res = await fetch(`/api/tournament/playoffs/${game.id}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game.liveScore),
    })

    if (res.ok) await loadTournament()

    setIsUpdating(false)
  }

  function LiveScorer({ game }: { game: Game }) {
    const score = game.liveScore ?? { team1: 0, team2: 0 }
    const isScorer = currentUserId && game.scoredBy === currentUserId

    return (
        <div
        className="space-y-3 rounded-lg border bg-secondary/20 p-3"
        onClick={event => event.stopPropagation()}
        >
        <div className="flex items-center justify-between">
            <div>
            <p className="text-xs font-medium text-muted-foreground">Current</p>
            <p className="font-semibold">
                {getTeamName(game.team1Id)} vs {getTeamName(game.team2Id)}
            </p>
            </div>
            <Badge>Live</Badge>
        </div>

        {(['team1', 'team2'] as const).map(key => (
            <div key={key} className="flex items-center justify-between rounded-md bg-background p-2">
            <span className="text-sm font-medium">
                {key === 'team1' ? getTeamName(game.team1Id) : getTeamName(game.team2Id)}
            </span>

            <div className="flex items-center gap-2">
                {isScorer ? (
                <>
                    <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateLiveScore(game, { ...score, [key]: score[key] - 1 })}
                    >
                    <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-lg font-bold">{score[key]}</span>
                    <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateLiveScore(game, { ...score, [key]: score[key] + 1 })}
                    >
                    <Plus className="h-4 w-4" />
                    </Button>
                </>
                ) : (
                <span className="w-8 text-center text-lg font-bold">{score[key]}</span>
                )}
            </div>
            </div>
        ))}

        {isScorer ? (
            <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => cancelLiveGame(game)} disabled={isUpdating}>
                Cancel
            </Button>
            <Button onClick={() => completeGame(game)} disabled={isUpdating}>
                Complete Set {(game.setScores?.length ?? 0) + 1}
            </Button>
            </div>
        ) : (
            <p className="text-xs text-center text-muted-foreground">
            Scoring in progress by another user
            </p>
        )}
        </div>
    )
  }

  function BracketMatch({
    game,
    team1,
    team2,
  }: {
    game: PlayoffGame
    team1?: PlayoffSlot | PlaceholderSlot
    team2?: PlayoffSlot | PlaceholderSlot
  }) {
    if (game.status === 'live') {
      return <PlayoffLiveScorer game={game} />
    }

    return (
      <div className="min-w-[240px] rounded-lg border bg-background p-3 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{game.label}</p>

        <div className="space-y-2">
          <div className="rounded-md border bg-secondary/30 p-2">
            {renderBracketTeam(team1)}
          </div>

          <div className="rounded-md border bg-secondary/30 p-2">
            {renderBracketTeam(team2)}
          </div>
        </div>

        {game.status === 'pending' && (
          <Button
            className="mt-3 w-full"
            size="sm"
            onClick={() => startPlayoffGame(game)}
            disabled={isUpdating}
          >
            <Play className="mr-2 h-4 w-4" />
            Score
          </Button>
        )}

        {game.status === 'complete' && (
          <Badge className="mt-3">Complete</Badge>
        )}
      </div>
    )
  }

  function PlayoffView() {
    const playoffGameByLabel = new Map(playoffGames.map(game => [game.label, game]))

    if (division === 'AA') {
      const quarters = getAABracket()

      return (
        <Card>
          <CardHeader>
            <CardTitle>AA Bracket Projection</CardTitle>
            <CardDescription>
              Top 2 from each pool autofill into the bracket.
            </CardDescription>
          </CardHeader>

          <CardContent className="overflow-x-auto">
            <div className="flex min-w-[900px] items-center gap-10">
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Quarterfinals
                </h3>

                {quarters.map(match => {
                  const game = playoffGameByLabel.get(match.label)
                  if (!game) return null

                  return (
                    <BracketMatch
                      key={match.label}
                      game={game}
                      team1={match.team1}
                      team2={match.team2}
                    />
                  )
                })}
              </div>

              <div className="space-y-20">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Semifinals
                </h3>

                {playoffGameByLabel.get('SF 1') && (
                  <BracketMatch
                    game={playoffGameByLabel.get('SF 1')!}
                    team1={{ placeholder: 'Winner QF 1' }}
                    team2={{ placeholder: 'Winner QF 2' }}
                  />
                )}

                {playoffGameByLabel.get('SF 2') && (
                  <BracketMatch
                    game={playoffGameByLabel.get('SF 2')!}
                    team1={{ placeholder: 'Winner QF 3' }}
                    team2={{ placeholder: 'Winner QF 4' }}
                  />
                )}
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Final
                </h3>

                {playoffGameByLabel.get('Final') && (
                  <BracketMatch
                    game={playoffGameByLabel.get('Final')!}
                    team1={{ placeholder: 'Winner SF 1' }}
                    team2={{ placeholder: 'Winner SF 2' }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    const bracket = getBBBracket()

    return (
      <Card>
        <CardHeader>
          <CardTitle>BB Bracket Projection</CardTitle>
          <CardDescription>
            Top 2 from each pool autofill. Seeds 7–10 play into quarterfinals.
          </CardDescription>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <div className="flex min-w-[1100px] items-center gap-10">
            <div className="space-y-10">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Play-In
              </h3>

              {bracket.playIns.map(match => {
                const game = playoffGameByLabel.get(match.label)
                if (!game) return null

                return (
                  <BracketMatch
                    key={match.label}
                    game={game}
                    team1={match.team1}
                    team2={match.team2}
                  />
                )
              })}
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Quarterfinals
              </h3>

              {bracket.quarters.map(match => {
                const game = playoffGameByLabel.get(match.label)
                if (!game) return null

                return (
                  <BracketMatch
                    key={match.label}
                    game={game}
                    team1={match.team1}
                    team2={match.team2}
                  />
                )
              })}
            </div>

            <div className="space-y-20">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Semifinals
              </h3>

              {playoffGameByLabel.get('SF 1') && (
                <BracketMatch
                  game={playoffGameByLabel.get('SF 1')!}
                  team1={{ placeholder: 'Winner QF 1' }}
                  team2={{ placeholder: 'Winner QF 2' }}
                />
              )}

              {playoffGameByLabel.get('SF 2') && (
                <BracketMatch
                  game={playoffGameByLabel.get('SF 2')!}
                  team1={{ placeholder: 'Winner QF 3' }}
                  team2={{ placeholder: 'Winner QF 4' }}
                />
              )}
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Final
              </h3>

              {playoffGameByLabel.get('Final') && (
                <BracketMatch
                  game={playoffGameByLabel.get('Final')!}
                  team1={{ placeholder: 'Winner SF 1' }}
                  team2={{ placeholder: 'Winner SF 2' }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  function PlayoffLiveScorer({ game }: { game: PlayoffGame }) {
    const score = game.liveScore ?? { team1: 0, team2: 0 }

    const team1Name = game.team1Id ? getTeamName(game.team1Id) : game.team1Source ?? 'TBD'
    const team2Name = game.team2Id ? getTeamName(game.team2Id) : game.team2Source ?? 'TBD'

    return (
      <div className="space-y-3 rounded-lg border bg-secondary/20 p-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Live</p>
          <p className="font-semibold">{game.label}</p>
        </div>

        {(['team1', 'team2'] as const).map(key => (
          <div key={key} className="flex items-center justify-between rounded-md bg-background p-2">
            <span className="text-sm font-medium">
              {key === 'team1' ? team1Name : team2Name}
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  updatePlayoffLiveScore(game, {
                    ...score,
                    [key]: score[key] - 1,
                  })
                }
              >
                <Minus className="h-4 w-4" />
              </Button>

              <span className="w-8 text-center text-lg font-bold">{score[key]}</span>

              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  updatePlayoffLiveScore(game, {
                    ...score,
                    [key]: score[key] + 1,
                  })
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => cancelPlayoffGame(game)}>
            Cancel
          </Button>
          <Button onClick={() => completePlayoffGame(game)}>
            Complete Set
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tournament</h1>
        <p className="text-sm text-muted-foreground">
          Pool play rankings, live scoring, and projected playoffs.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Tabs value={division} onValueChange={value => setDivision(value as Division)}>
          <TabsList>
            <TabsTrigger value="AA">AA</TabsTrigger>
            <TabsTrigger value="BB">BB</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={view} onValueChange={value => setView(value as View)}>
          <TabsList>
            <TabsTrigger value="pool">Pool Play</TabsTrigger>
            <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'pool' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {pools.map(pool => {
            const standings = calculateStandings(pool.id)
            const current = getCurrentGame(pool.id)
            const next = getNextGame(pool.id)

            return (
              <Card
                key={pool.id}
                className="cursor-pointer transition hover:bg-secondary/20"
                onClick={() => {
                  setSelectedPool(pool)
                  setSelectedTeamId(null)
                }}
              >
                <CardHeader>
                  <CardTitle>{pool.name}</CardTitle>
                  <CardDescription>Top 2 advance</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {standings.map((standing, index) => (
                      <div
                        key={standing.team.id}
                        className="grid grid-cols-[32px_1fr_70px_70px] items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-semibold">{index + 1}</span>
                        <span className="font-medium">{standing.team.name}</span>
                        <span>{standing.setsWon}-{standing.setsLost}</span>
                        <span>
                          {standing.pointDiff > 0 ? '+' : ''}
                          {standing.pointDiff}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {current ? (
                      <LiveScorer game={current} />
                    ) : (
                      <GameMini game={null} label="Current" />
                    )}

                    <div className="space-y-3">
                      <GameMini game={next} label="Next" />

                      {next && !current && (
                        <Button
                          className="w-full"
                          disabled={isUpdating}
                          onClick={event => {
                            event.stopPropagation()
                            startGame(next)
                          }}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Score This Game
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <PlayoffView />
      )}

      <Dialog
        open={!!selectedPool}
        onOpenChange={open => {
          if (!open) setSelectedPool(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedPool?.name}</DialogTitle>
          </DialogHeader>

          {selectedPool && (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                {calculateStandings(selectedPool.id).map((standing, index) => (
                  <button
                    key={standing.team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(standing.team.id)}
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span>
                      {index + 1}. {standing.team.name}
                    </span>
                    {index < 2 && <Trophy className="h-4 w-4" />}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {!selectedTeamId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a team to view its schedule.
                  </p>
                ) : (
                  getTeamGames(selectedTeamId).map(game => {
                    const opponentId =
                      game.team1Id === selectedTeamId ? game.team2Id : game.team1Id

                    return (
                      <div key={game.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">vs {getTeamName(opponentId)}</p>
                            <p className="text-xs text-muted-foreground">
                              Game {getLocalOrderIndex(game)} · Work: {getWorkTeamName(game)}
                            </p>
                          </div>

                          <Badge>{formatResult(game, selectedTeamId)}</Badge>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}