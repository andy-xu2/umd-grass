import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq, and, gt, count, desc } from 'drizzle-orm'
import type { Season } from '@/lib/types'
import ProfileClient from './profile-client'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Batch 1: profile + all seasons — parallel
  const [[profile], allSeasons] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)),
    db.select().from(seasons).orderBy(desc(seasons.startedAt)),
  ])
  if (!profile) redirect('/login')

  const seasonList: Season[] = allSeasons.map(s => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  const seasonId = allSeasons.find(s => s.isActive)?.id ?? null

  let stats = null
  let rank: number | null = null

  if (seasonId) {
    // Batch 2: season stats for this user
    const [stat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, user.id), eq(seasonStats.seasonId, seasonId)))

    if (stat) {
      stats = {
        rr: stat.rr,
        gamesPlayed: stat.gamesPlayed,
        wins: stat.wins,
        losses: stat.losses,
        isRevealed: stat.isRevealed,
      }

      // Batch 3: rank count only if revealed
      if (stat.isRevealed) {
        const [{ value }] = await db
          .select({ value: count() })
          .from(seasonStats)
          .where(
            and(
              eq(seasonStats.seasonId, seasonId),
              eq(seasonStats.isRevealed, true),
              gt(seasonStats.rr, stat.rr),
            ),
          )
        rank = Number(value) + 1
      }
    }
  }

  return (
    <ProfileClient
      initialProfile={{
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        stats,
        rank,
      }}
      initialSeasonId={seasonId}
      initialSeasons={seasonList}
    />
  )
}
