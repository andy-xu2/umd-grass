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
  const body = (await request.json()) as { name?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Court name is required' }, { status: 400 })
  }

  await db.update(courts).set({ name: body.name.trim() }).where(eq(courts.id, courtId))

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
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
