import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'
import {
  MatchVerificationError,
  verifyMatch,
  type VerificationAction,
} from '@/lib/match-verification'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as { action?: string }
  const { action } = body

  if (action !== 'confirm' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "confirm" or "reject"' },
      { status: 400 },
    )
  }

  try {
    const result = await verifyMatch(id, user.id, action as VerificationAction)

    invalidateLeaderboardCache(result.seasonId)

    return NextResponse.json({
      ok: true,
      recomputed: result.recomputed,
    })
  } catch (error) {
    if (error instanceof MatchVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('verify RR update failed:', error)

    return NextResponse.json(
      { error: 'Failed to update RR after verification' },
      { status: 500 },
    )
  }
}
