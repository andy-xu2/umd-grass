import { NextResponse } from 'next/server'
import { recalculateSeasonRr } from '@/lib/recalculate-rr'
import { invalidateLeaderboardCache } from '@/lib/leaderboard'

export async function POST(req: Request) {
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
