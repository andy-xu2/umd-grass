// GET  /api/matches — list all matches involving the current user
// POST /api/matches — submit a new pending match

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches, users, rrChanges, seasons } from '@/drizzle/schema'
import { eq, or, and, inArray, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { MatchResponse, SetScore } from '@/lib/types'
import { fromZonedTime } from 'date-fns-tz'
import { effectiveStatus, isUuid, playedAtError, setScoresError } from '@/lib/match-input'

export async function buildMatchesForUser(userId: string, limit?: number): Promise<MatchResponse[]> {
  const t1p1 = alias(users, 't1p1')
  const t1p2 = alias(users, 't1p2')
  const t2p1 = alias(users, 't2p1')
  const t2p2 = alias(users, 't2p2')

  const baseQuery = db
    .select({
      id: matches.id,
      seasonId: matches.seasonId,
      submittedBy: matches.submittedBy,
      team1Player1Id: matches.team1Player1Id,
      team1Player1Name: t1p1.name,
      team1Player1Avatar: t1p1.avatarUrl,
      team1Player1Deleted: t1p1.isDeleted,
      team1Player2Id: matches.team1Player2Id,
      team1Player2Name: t1p2.name,
      team1Player2Avatar: t1p2.avatarUrl,
      team1Player2Deleted: t1p2.isDeleted,
      team2Player1Id: matches.team2Player1Id,
      team2Player1Name: t2p1.name,
      team2Player1Avatar: t2p1.avatarUrl,
      team2Player1Deleted: t2p1.isDeleted,
      team2Player2Id: matches.team2Player2Id,
      team2Player2Name: t2p2.name,
      team2Player2Avatar: t2p2.avatarUrl,
      team2Player2Deleted: t2p2.isDeleted,
      setScores: matches.setScores,
      team1Sets: matches.team1Sets,
      team2Sets: matches.team2Sets,
      status: matches.status,
      submittedAt: matches.submittedAt,
      playedAt: matches.playedAt,
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
    .orderBy(desc(matches.playedAt), desc(matches.submittedAt))
    .$dynamic()

  const rows = await (limit ? baseQuery.limit(limit) : baseQuery)

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
  const now = new Date()

  return rows.map(row => ({
    id: row.id,
    seasonId: row.seasonId,
    submittedBy: row.submittedBy,
    team1Player1: {
      id: row.team1Player1Id,
      name: row.team1Player1Deleted ? 'Deleted User' : row.team1Player1Name,
      avatarUrl: row.team1Player1Deleted ? null : row.team1Player1Avatar,
    },
    team1Player2: {
      id: row.team1Player2Id,
      name: row.team1Player2Deleted ? 'Deleted User' : row.team1Player2Name,
      avatarUrl: row.team1Player2Deleted ? null : row.team1Player2Avatar,
    },
    team2Player1: {
      id: row.team2Player1Id,
      name: row.team2Player1Deleted ? 'Deleted User' : row.team2Player1Name,
      avatarUrl: row.team2Player1Deleted ? null : row.team2Player1Avatar,
    },
    team2Player2: {
      id: row.team2Player2Id,
      name: row.team2Player2Deleted ? 'Deleted User' : row.team2Player2Name,
      avatarUrl: row.team2Player2Deleted ? null : row.team2Player2Avatar,
    },
    setScores: row.setScores as SetScore[] | null,
    team1Sets: row.team1Sets,
    team2Sets: row.team2Sets,
    status: effectiveStatus(row.status, row.expiresAt, now),
    submittedAt: row.submittedAt.toISOString(),
    playedAt: (row.playedAt ?? row.submittedAt).toISOString(),
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
  const { teammateId, opponent1Id, opponent2Id, sets, playedDate, playedTime } = body as {
    teammateId?: string
    opponent1Id?: string
    opponent2Id?: string
    sets?: SetScore[]
    playedDate?: string
    playedTime?: string
  }

  if (!teammateId || !opponent1Id || !opponent2Id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!playedDate || !playedTime) {
    return NextResponse.json({ error: 'Played date and time are required' }, { status: 400 })
  }
  const setsProblem = setScoresError(sets)
  if (setsProblem) {
    return NextResponse.json({ error: setsProblem }, { status: 400 })
  }
  // Store only the two score fields, never extra keys from the request body.
  const cleanSets = (sets as SetScore[]).map(({ team1, team2 }) => ({ team1, team2 }))
  const team1Sets = cleanSets.filter(s => s.team1 > s.team2).length
  const team2Sets = cleanSets.length - team1Sets

  if (![teammateId, opponent1Id, opponent2Id].every(isUuid)) {
    return NextResponse.json({ error: 'Invalid player id' }, { status: 400 })
  }
  // Lowercase so an upper-case copy of an id can't pass the uniqueness check.
  const otherIds = [teammateId, opponent1Id, opponent2Id].map(id => id.toLowerCase())

  const allIds = [user.id, ...otherIds]
  if (new Set(allIds).size !== 4) {
    return NextResponse.json({ error: 'All four players must be different' }, { status: 400 })
  }

  const activePlayers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, otherIds), eq(users.isDeleted, false)))
  if (activePlayers.length !== otherIds.length) {
    return NextResponse.json({ error: 'One or more players do not exist or have been deleted' }, { status: 400 })
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true))
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 400 })
  }

  const now = new Date()

  const playedAt = fromZonedTime(
    `${playedDate} ${playedTime}:00`,
    'America/New_York',
  )  
  if (Number.isNaN(playedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid played date or time' }, { status: 400 })
  }

  if (activeSeason.startedAt > now) {
    return NextResponse.json({ error: 'Season has not started yet' }, { status: 400 })
  }
  if (activeSeason.endedAt && activeSeason.endedAt < now) {
    return NextResponse.json({ error: 'Season has ended' }, { status: 400 })
  }
  const playedAtProblem = playedAtError(playedAt, activeSeason.startedAt, now)
  if (playedAtProblem) {
    return NextResponse.json({ error: playedAtProblem }, { status: 400 })
  }
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
      setScores: cleanSets,
      team1Sets,
      team2Sets,
      playedAt,
      expiresAt,
    })
    .returning()

  return NextResponse.json(match, { status: 201 })
}
