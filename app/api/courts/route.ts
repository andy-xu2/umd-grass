import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courts, courtQueueEntries, users } from '@/drizzle/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { CourtResponse, QueueTeamResponse } from '@/lib/types'

export async function GET() {
  const rows = await db
    .select({
      id: courts.id,
      name: courts.name,
      createdBy: courts.createdBy,
      createdAt: courts.createdAt,
    })
    .from(courts)
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
      player1: { id: row.player1Id, name: row.player1Name, avatarUrl: row.player1Avatar },
      player2: { id: row.player2Id, name: row.player2Name, avatarUrl: row.player2Avatar },
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
    queue: queueByCourt.get(row.id) ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { name?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Court name is required' }, { status: 400 })
  }

  const [created] = await db
    .insert(courts)
    .values({ name: body.name.trim(), createdBy: user.id })
    .returning()

  return NextResponse.json(created)
}
