import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const name = (user.user_metadata?.name as string) ?? user.email ?? 'Unknown'

  await db.insert(users).values({
    id: user.id,
    email: user.email!,
    name,
  }).onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
