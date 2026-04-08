// GET /api/users/[id]            — public profile for any user + active-season stats + rank
// GET /api/users/[id]?seasonId=  — same but for the specified season

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users, seasonStats, seasons } from '@/drizzle/schema'
import { eq, and, gt, count } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [profile] = await db.select().from(users).where(eq(users.id, id))
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const seasonIdParam = searchParams.get('seasonId')

  let resolvedSeasonId: string | null = seasonIdParam
  if (!resolvedSeasonId) {
    const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    resolvedSeasonId = activeSeason?.id ?? null
  }

  let stats = null
  let rank: number | null = null

  if (resolvedSeasonId) {
    const [seasonStat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, id), eq(seasonStats.seasonId, resolvedSeasonId)))

    if (seasonStat) {
      stats = seasonStat

      if (seasonStat.isRevealed) {
        const [{ value }] = await db
          .select({ value: count() })
          .from(seasonStats)
          .where(
            and(
              eq(seasonStats.seasonId, resolvedSeasonId),
              eq(seasonStats.isRevealed, true),
              gt(seasonStats.rr, seasonStat.rr),
            ),
          )
        rank = Number(value) + 1
      }
    }
  }

  return NextResponse.json({
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    stats,
    rank,
  })
}
