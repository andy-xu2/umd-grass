import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import type { UserWithStats, Season } from '@/lib/types'
import PlayersClient from './players-client'

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.startedAt))
  const seasonList: Season[] = allSeasons.map(s => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  const activeSeason = allSeasons.find(s => s.isActive) ?? null
  const seasonId = activeSeason?.id ?? null

  const allUsers = await db.select().from(users)

  let initialPlayers: UserWithStats[]

  if (!seasonId) {
    initialPlayers = allUsers
      .map(u => ({ ...u, createdAt: u.createdAt.toISOString(), stats: null }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } else {
    const allStats = await db
      .select()
      .from(seasonStats)
      .where(eq(seasonStats.seasonId, seasonId))

    const statsMap = new Map(allStats.map(s => [s.userId, s]))

    initialPlayers = allUsers
      .map(u => {
        const s = statsMap.get(u.id) ?? null
        return {
          ...u,
          createdAt: u.createdAt.toISOString(),
          stats: s
            ? {
                id: s.id,
                rr: s.rr,
                hiddenMmr: s.hiddenMmr,
                gamesPlayed: s.gamesPlayed,
                wins: s.wins,
                losses: s.losses,
                isRevealed: s.isRevealed,
              }
            : null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return <PlayersClient initialPlayers={initialPlayers} initialSeasonId={seasonId} initialSeasons={seasonList} />
}
