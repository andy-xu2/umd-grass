// GET  /api/users — list all users with their active-season stats (auth required)
// POST /api/users — create a row in the public `users` table after TOTP enrollment

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasons, seasonStats } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import type { UserWithStats } from '@/lib/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))

  const allUsers = await db.select().from(users)

  if (!activeSeason) {
    const result: UserWithStats[] = allUsers.map(u => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      stats: null,
    }))
    return NextResponse.json(result)
  }

  const allStats = await db
    .select()
    .from(seasonStats)
    .where(eq(seasonStats.seasonId, activeSeason.id))

  const statsMap = new Map(allStats.map(s => [s.userId, s]))

  const result: UserWithStats[] = allUsers.map(u => {
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

  return NextResponse.json(result)
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const name = (user.user_metadata?.name as string) ?? user.email ?? 'Unknown'

  await db.insert(users).values({
    id: user.id,
    email: user.email!,
    name,
  }).onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
