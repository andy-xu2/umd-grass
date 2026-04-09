import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import type { Season, UserWithStats } from '@/lib/types'
import AdminClient from './admin-client'
import { isAdmin } from '@/lib/utils'

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user || !isAdmin(user.id)) redirect('/dashboard')

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

  let initialUsers: UserWithStats[] = []
  if (seasonId) {
    const [allUsers, allStats] = await Promise.all([
      db.select().from(users),
      db.select().from(seasonStats).where(eq(seasonStats.seasonId, seasonId)),
    ])
    const statsMap = new Map(allStats.map(s => [s.userId, s]))

    initialUsers = allUsers.map(u => {
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
  }

  return (
    <AdminClient
      initialSeasons={seasonList}
      initialSeasonId={seasonId}
      initialUsers={initialUsers}
    />
  )
}
