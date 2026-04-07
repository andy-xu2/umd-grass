// GET  /api/matches — list all matches involving the current user
// POST /api/matches — submit a new pending match

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, users, rrChanges, seasons } from '@/drizzle/schema'
import { eq, or, and, inArray, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { MatchResponse } from '@/lib/types'

export async function buildMatchesForUser(userId: string): Promise<MatchResponse[]> {
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
    .where(
      or(
        eq(matches.team1Player1Id, userId),
        eq(matches.team1Player2Id, userId),
        eq(matches.team2Player1Id, userId),
        eq(matches.team2Player2Id, userId),
      ),
    )
    .orderBy(desc(matches.submittedAt))

  if (rows.length === 0) return []

  const rrRows = await db
    .select({ matchId: rrChanges.matchId, delta: rrChanges.delta })
    .from(rrChanges)
    .where(
      and(
        eq(rrChanges.userId, userId),
        inArray(
          rrChanges.matchId,
          rows.map(r => r.id),
        ),
      ),
    )

  const rrMap = new Map(rrRows.map(r => [r.matchId, r.delta]))

  return rows.map(row => ({
    id: row.id,
    seasonId: row.seasonId,
    submittedBy: row.submittedBy,
    team1Player1: {
      id: row.team1Player1Id,
      name: row.team1Player1Name,
      avatarUrl: row.team1Player1Avatar,
    },
    team1Player2: {
      id: row.team1Player2Id,
      name: row.team1Player2Name,
      avatarUrl: row.team1Player2Avatar,
    },
    team2Player1: {
      id: row.team2Player1Id,
      name: row.team2Player1Name,
      avatarUrl: row.team2Player1Avatar,
    },
    team2Player2: {
      id: row.team2Player2Id,
      name: row.team2Player2Name,
      avatarUrl: row.team2Player2Avatar,
    },
    team1Sets: row.team1Sets,
    team2Sets: row.team2Sets,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    rrChange: rrMap.get(row.id) ?? null,
  }))
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await buildMatchesForUser(user.id)
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { teammateId, opponent1Id, opponent2Id, team1Sets, team2Sets } = body as {
    teammateId?: string
    opponent1Id?: string
    opponent2Id?: string
    team1Sets?: number
    team2Sets?: number
  }

  if (!teammateId || !opponent1Id || !opponent2Id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof team1Sets !== 'number' || typeof team2Sets !== 'number') {
    return NextResponse.json({ error: 'Score is required' }, { status: 400 })
  }
  if (team1Sets === team2Sets) {
    return NextResponse.json({ error: 'Match cannot end in a tie' }, { status: 400 })
  }
  if (team1Sets < 0 || team2Sets < 0) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const allIds = [user.id, teammateId, opponent1Id, opponent2Id]
  if (new Set(allIds).size !== 4) {
    return NextResponse.json({ error: 'All four players must be different' }, { status: 400 })
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 400 })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [match] = await db
    .insert(matches)
    .values({
      seasonId: activeSeason.id,
      submittedBy: user.id,
      team1Player1Id: user.id,
      team1Player2Id: teammateId,
      team2Player1Id: opponent1Id,
      team2Player2Id: opponent2Id,
      team1Sets,
      team2Sets,
      expiresAt,
    })
    .returning()

  return NextResponse.json(match, { status: 201 })
}
