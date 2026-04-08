'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SeasonSelector } from '@/components/season-selector'
import { cn, getInitials } from '@/lib/utils'
import { getSkillTier } from '@/lib/mock-data'
import { Search, Users } from 'lucide-react'
import type { UserWithStats, Season } from '@/lib/types'

interface Props {
  initialPlayers: UserWithStats[]
  initialSeasonId: string | null
  initialSeasons: Season[]
}

export default function PlayersClient({ initialPlayers, initialSeasonId, initialSeasons }: Props) {
  const router = useRouter()
  const [players, setPlayers] = useState<UserWithStats[]>(initialPlayers)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [seasonId, setSeasonId] = useState<string | null>(initialSeasonId)
  const loadedSeasonId = useRef<string | null>(initialSeasonId)

  const loadSeason = useCallback(async (sid: string) => {
    setLoading(true)
    const res = await fetch(`/api/users?seasonId=${sid}`)
    if (res.ok) {
      const data: UserWithStats[] = await res.json()
      setPlayers(data.sort((a, b) => a.name.localeCompare(b.name)))
      loadedSeasonId.current = sid
    }
    setLoading(false)
  }, [])

  function handleSeasonChange(sid: string | null) {
    setSeasonId(sid)
    setSearch('')
    if (sid && sid !== loadedSeasonId.current) loadSeason(sid)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return players
    return players.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [players, search])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-sm text-muted-foreground">Search and browse all players</p>
        </div>
        <SeasonSelector
          value={seasonId}
          onChange={handleSeasonChange}
          className="w-44"
          initialSeasons={initialSeasons}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search players by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      {/* Player list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading
              ? 'Loading...'
              : search
                ? `Results (${filtered.length})`
                : `All Players (${players.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
            ))
          ) : filtered.length > 0 ? (
            filtered.map(player => (
              <PlayerRow
                key={player.id}
                player={player}
                onClick={() => router.push(`/players/${player.id}`)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <Users className="h-10 w-10 opacity-40" />
              <p>
                {players.length === 0
                  ? 'No players found.'
                  : `No players matching "${search}"`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PlayerRow({
  player,
  onClick,
}: {
  player: UserWithStats
  onClick: () => void
}) {
  const stats = player.stats
  const isRevealed = stats?.isRevealed ?? false
  const rr = isRevealed ? (stats?.rr ?? 800) : 800
  const gamesPlayed = stats?.gamesPlayed ?? 0
  const unranked = !isRevealed || gamesPlayed < 5
  const tier = getSkillTier(rr)

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg bg-secondary/30 p-4 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar className="h-10 w-10 border border-border shrink-0">
        {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt={player.name} />}
        <AvatarFallback className="bg-secondary text-sm">
          {getInitials(player.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{player.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {unranked ? (
            <span className="text-xs text-muted-foreground">Unranked</span>
          ) : (
            <span className={cn('text-xs font-medium', tier.color)}>{tier.name}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        {unranked ? (
          <Badge variant="secondary" className="text-xs">Unranked</Badge>
        ) : (
          <>
            <p className="text-lg font-bold text-primary">{rr}</p>
            <p className="text-xs text-muted-foreground">RR</p>
          </>
        )}
      </div>
    </button>
  )
}
