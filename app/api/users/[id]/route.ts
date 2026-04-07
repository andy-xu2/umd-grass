import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, seasonStats, seasons } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [profile] = await db.select().from(users).where(eq(users.id, id))
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))

  let stats = null
  if (activeSeason) {
    const [seasonStat] = await db
      .select()
      .from(seasonStats)
      .where(and(eq(seasonStats.userId, id), eq(seasonStats.seasonId, activeSeason.id)))
    stats = seasonStat ?? null
  }

  return NextResponse.json({ ...profile, stats })
}
