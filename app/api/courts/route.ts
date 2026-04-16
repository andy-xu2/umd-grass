import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courts, courtQueueEntries, users } from '@/drizzle/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { CourtResponse, QueueTeamResponse } from '@/lib/types'

export async function GET() {
  const t1p1 = alias(users, 't1p1')
  const t1p2 = alias(users, 't1p2')
  const t2p1 = alias(users, 't2p1')
  const t2p2 = alias(users, 't2p2')

  const rows = await db
    .select({
      id: courts.id,
      name: courts.name,
      createdBy: courts.createdBy,
      createdAt: courts.createdAt,

      team1Player1Id: courts.team1Player1Id,
      team1Player1Name: t1p1.name,
      team1Player1Avatar: t1p1.avatarUrl,

      team1Player2Id: courts.team1Player2Id,
      team1Player2Name: t1p2.name,
      team1Player2Avatar: t1p2.avatarUrl,

      team2Player1Id: courts.team2Player1Id,
      team2Player1Name: t2p1.name,
      team2Player1Avatar: t2p1.avatarUrl,

      team2Player2Id: courts.team2Player2Id,
      team2Player2Name: t2p2.name,
      team2Player2Avatar: t2p2.avatarUrl,
    })
    .from(courts)
    .innerJoin(t1p1, eq(courts.team1Player1Id, t1p1.id))
    .innerJoin(t1p2, eq(courts.team1Player2Id, t1p2.id))
    .innerJoin(t2p1, eq(courts.team2Player1Id, t2p1.id))
    .innerJoin(t2p2, eq(courts.team2Player2Id, t2p2.id))
    .orderBy(desc(courts.createdAt))

  const courtIds = rows.map(r => r.id)

  let queueRows: Array<{
    id: string
    courtId: string
    position: number
    createdAt: Date
    player1Id: string
    player1Name: string
    player1Avatar: string | null
    player2Id: string
    player2Name: string
    player2Avatar: string | null
  }> = []

  if (courtIds.length > 0) {
    const q1 = alias(users, 'q1')
    const q2 = alias(users, 'q2')

    queueRows = await db
      .select({
        id: courtQueueEntries.id,
        courtId: courtQueueEntries.courtId,
        position: courtQueueEntries.position,
        createdAt: courtQueueEntries.createdAt,

        player1Id: courtQueueEntries.player1Id,
        player1Name: q1.name,
        player1Avatar: q1.avatarUrl,

        player2Id: courtQueueEntries.player2Id,
        player2Name: q2.name,
        player2Avatar: q2.avatarUrl,
      })
      .from(courtQueueEntries)
      .innerJoin(q1, eq(courtQueueEntries.player1Id, q1.id))
      .innerJoin(q2, eq(courtQueueEntries.player2Id, q2.id))
      .orderBy(asc(courtQueueEntries.position))
  }

  const queueByCourt = new Map<string, QueueTeamResponse[]>()

  for (const row of queueRows) {
    const arr = queueByCourt.get(row.courtId) ?? []
    arr.push({
      id: row.id,
      courtId: row.courtId,
      player1: {
        id: row.player1Id,
        name: row.player1Name,
        avatarUrl: row.player1Avatar,
      },
      player2: {
        id: row.player2Id,
        name: row.player2Name,
        avatarUrl: row.player2Avatar,
      },
      position: row.position,
      createdAt: row.createdAt.toISOString(),
    })
    queueByCourt.set(row.courtId, arr)
  }

  const result: CourtResponse[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),

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
    queue: queueByCourt.get(row.id) ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    name?: string
    team1Player1Id?: string
    team1Player2Id?: string
    team2Player1Id?: string
    team2Player2Id?: string
  }

  const {
    name,
    team1Player1Id,
    team1Player2Id,
    team2Player1Id,
    team2Player2Id,
  } = body

  if (!name || !team1Player1Id || !team1Player2Id || !team2Player1Id || !team2Player2Id) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const ids = [team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id]
  if (new Set(ids).size !== 4) {
    return NextResponse.json({ error: 'All four players must be different' }, { status: 400 })
  }

  const [created] = await db
    .insert(courts)
    .values({
      name: name.trim(),
      createdBy: user.id,
      team1Player1Id,
      team1Player2Id,
      team2Player1Id,
      team2Player2Id,
    })
    .returning()

  return NextResponse.json(created)
}