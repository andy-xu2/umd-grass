'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { Search, Users, ChevronRight } from 'lucide-react'

interface Player {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
}

interface Props {
  initialPlayers: Player[]
}

export default function PlayersClient({ initialPlayers }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return initialPlayers
    return initialPlayers.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [initialPlayers, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-sm text-muted-foreground">Browse all players</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search players by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {search ? `Results (${filtered.length})` : `All Players (${initialPlayers.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {filtered.length > 0 ? (
            filtered.map(player => (
              <button
                key={player.id}
                onClick={() => router.push(`/players/${player.id}`)}
                className="flex w-full items-center gap-4 rounded-lg bg-secondary/30 p-4 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="h-10 w-10 shrink-0 border border-border">
                  {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt={player.name} />}
                  <AvatarFallback className="bg-secondary text-sm">
                    {getInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="flex-1 truncate font-semibold">{player.name}</p>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Users className="h-10 w-10 opacity-40" />
              <p>
                {initialPlayers.length === 0
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
