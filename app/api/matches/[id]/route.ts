// DELETE /api/matches/[id] — admin only
// Deletes a CONFIRMED match and chronologically replays the remaining season.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'
import { recalculateSeasonRrTx } from '@/lib/recalculate-rr'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const result = await db.transaction(async tx => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, id))
    if (!match) return { error: 'Match not found', status: 404 } as const
    if (match.status !== 'CONFIRMED') {
      return { error: 'Only confirmed matches can be deleted', status: 400 } as const
    }

    await tx.delete(matches).where(eq(matches.id, id))
    await recalculateSeasonRrTx(tx, match.seasonId)
    return { seasonId: match.seasonId } as const
  })

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }

  invalidateLeaderboardCache(result.seasonId)

  return NextResponse.json({ ok: true })
}
