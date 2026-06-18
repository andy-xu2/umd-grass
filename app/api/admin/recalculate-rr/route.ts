import { NextResponse } from 'next/server'
import { recalculateSeasonRr } from '@/lib/recalculate-rr'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'
import { createClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/utils'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get('seasonId')

  if (!seasonId) {
    return NextResponse.json(
      { error: 'Missing seasonId' },
      { status: 400 },
    )
  }

  try {
    await recalculateSeasonRr(seasonId)
    invalidateLeaderboardCache(seasonId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('recalculate-rr failed:', err)

    return NextResponse.json(
      { error: 'Failed to recalculate RR' },
      { status: 500 },
    )
  }
}
