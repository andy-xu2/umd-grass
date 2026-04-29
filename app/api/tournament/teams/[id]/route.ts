import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { tournamentTeams } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as { name?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
  }

  await db
    .update(tournamentTeams)
    .set({ name: body.name.trim() })
    .where(eq(tournamentTeams.id, id))

  return NextResponse.json({ ok: true })
}