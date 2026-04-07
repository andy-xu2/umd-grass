// GET /api/matches/pending-count — count of PENDING matches the current user needs to verify

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq, or, and } from 'drizzle-orm'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'PENDING'),
        or(
          eq(matches.team2Player1Id, user.id),
          eq(matches.team2Player2Id, user.id),
        ),
      ),
    )

  return NextResponse.json({ count: rows.length })
}
