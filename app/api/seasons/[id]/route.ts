// PATCH /api/seasons/[id] — update season start/end dates (admin only)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { seasons } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as { startDate?: string | null; endDate?: string | null; name?: string }

  const updates: { startedAt?: Date; endedAt?: Date | null; name?: string } = {}
  if ('name' in body && typeof body.name === 'string' && body.name.trim()) {
    updates.name = body.name.trim()
  }
  if ('startDate' in body) {
    updates.startedAt = body.startDate ? new Date(body.startDate + 'T12:00:00Z') : new Date()
  }
  if ('endDate' in body) {
    updates.endedAt = body.endDate ? new Date(body.endDate + 'T12:00:00Z') : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(seasons)
    .set(updates)
    .where(eq(seasons.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    isActive: updated.isActive,
    startedAt: updated.startedAt.toISOString(),
    endedAt: updated.endedAt?.toISOString() ?? null,
  })
}
