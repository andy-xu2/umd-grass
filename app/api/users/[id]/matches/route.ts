// GET /api/users/[id]/matches — match history for any user (auth required)
// Returns matches from that player's perspective (rrChange reflects their delta).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buildMatchesForUser } from '@/app/api/matches/route'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await buildMatchesForUser(id)
  return NextResponse.json(result)
}
