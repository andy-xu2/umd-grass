import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { courtQueueEntries } from '@/drizzle/schema'
import { eq, asc } from 'drizzle-orm'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courtId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courtId } = await params

  const [first] = await db
    .select()
    .from(courtQueueEntries)
    .where(eq(courtQueueEntries.courtId, courtId))
    .orderBy(asc(courtQueueEntries.position))
    .limit(1)

  if (!first) {
    return NextResponse.json({ error: 'Queue is empty' }, { status: 400 })
  }

  await db.delete(courtQueueEntries).where(eq(courtQueueEntries.id, first.id))

  const remaining = await db
    .select()
    .from(courtQueueEntries)
    .where(eq(courtQueueEntries.courtId, courtId))
    .orderBy(asc(courtQueueEntries.position))

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(courtQueueEntries)
      .set({ position: i + 1 })
      .where(eq(courtQueueEntries.id, remaining[i].id))
  }

  return NextResponse.json({ ok: true })
}
