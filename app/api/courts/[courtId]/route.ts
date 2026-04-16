import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courts } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courtId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId } = await params
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

  await db
    .update(courts)
    .set({
      name: name.trim(),
      team1Player1Id,
      team1Player2Id,
      team2Player1Id,
      team2Player2Id,
    })
    .where(eq(courts.id, courtId))

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courtId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId } = await params

  await db.delete(courts).where(eq(courts.id, courtId))

  return NextResponse.json({ ok: true })
}