// GET /api/admin/matches?seasonId=<uuid>
// Admin only: list all confirmed matches for a season, newest first.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, users, seasons, rrChanges } from '@/drizzle/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { isAdmin } from '@/lib/utils'
import type { MatchResponse, SetScore } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  let seasonId = searchParams.get('seasonId')

  if (!seasonId) {
    const [active] = await db.select().from(seasons).where(eq(seasons.isActive, true))
    seasonId = active?.id ?? null
  }

  if (!seasonId) return NextResponse.json([])

  const t1p1 = alias(users, 't1p1')
  const t1p2 = alias(users, 't1p2')
  const t2p1 = alias(users, 't2p1')
  const t2p2 = alias(users, 't2p2')

  const rows = await db
    .select({
      id: matches.id,
      seasonId: matches.seasonId,
      submittedBy: matches.submittedBy,
      team1Player1Id: matches.team1Player1Id,
      team1Player1Name: t1p1.name,
      team1Player1Avatar: t1p1.avatarUrl,
      team1Player2Id: matches.team1Player2Id,
      team1Player2Name: t1p2.name,
      team1Player2Avatar: t1p2.avatarUrl,
      team2Player1Id: matches.team2Player1Id,
      team2Player1Name: t2p1.name,
      team2Player1Avatar: t2p1.avatarUrl,
      team2Player2Id: matches.team2Player2Id,
      team2Player2Name: t2p2.name,
      team2Player2Avatar: t2p2.avatarUrl,
      setScores: matches.setScores,
      team1Sets: matches.team1Sets,
      team2Sets: matches.team2Sets,
      status: matches.status,
      submittedAt: matches.submittedAt,
      expiresAt: matches.expiresAt,
      verifiedBy: matches.verifiedBy,
      verifiedAt: matches.verifiedAt,
    })
    .from(matches)
    .innerJoin(t1p1, eq(matches.team1Player1Id, t1p1.id))
    .innerJoin(t1p2, eq(matches.team1Player2Id, t1p2.id))
    .innerJoin(t2p1, eq(matches.team2Player1Id, t2p1.id))
    .innerJoin(t2p2, eq(matches.team2Player2Id, t2p2.id))
    .where(and(eq(matches.seasonId, seasonId), eq(matches.status, 'CONFIRMED')))
    .orderBy(desc(matches.submittedAt))
    .limit(100)

  if (rows.length === 0) return NextResponse.json([])

  const allRrChanges = await db
    .select()
    .from(rrChanges)
    .where(
      and(
        eq(rrChanges.seasonId, seasonId),
        inArray(rrChanges.matchId, rows.map(r => r.id)),
      ),
    )

  const rrByMatch = new Map<string, typeof allRrChanges>()
  for (const c of allRrChanges) {
    const arr = rrByMatch.get(c.matchId) ?? []
    arr.push(c)
    rrByMatch.set(c.matchId, arr)
  }

  const result: MatchResponse[] = rows.map(row => ({
    id: row.id,
    seasonId: row.seasonId,
    submittedBy: row.submittedBy,
    team1Player1: { id: row.team1Player1Id, name: row.team1Player1Name, avatarUrl: row.team1Player1Avatar },
    team1Player2: { id: row.team1Player2Id, name: row.team1Player2Name, avatarUrl: row.team1Player2Avatar },
    team2Player1: { id: row.team2Player1Id, name: row.team2Player1Name, avatarUrl: row.team2Player1Avatar },
    team2Player2: { id: row.team2Player2Id, name: row.team2Player2Name, avatarUrl: row.team2Player2Avatar },
    setScores: row.setScores as SetScore[] | null,
    team1Sets: row.team1Sets,
    team2Sets: row.team2Sets,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    rrChange: null,
  }))

  return NextResponse.json(result)
}
