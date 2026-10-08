import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { seasons } from '@/drizzle/schema'
import { db } from '@/lib/db'
import { fetchRrHistory } from '@/lib/rr-history'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let seasonId = request.nextUrl.searchParams.get('seasonId')
  if (seasonId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seasonId)) {
    return NextResponse.json({ error: 'Invalid season ID' }, { status: 400 })
  }

  try {
    if (!seasonId) {
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons)
        .where(eq(seasons.isActive, true)).limit(1)
      seasonId = activeSeason?.id ?? null
    }
    const history = seasonId ? await fetchRrHistory(user.id, seasonId) : []
    return NextResponse.json(history, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Failed to load RR history:', error)
    return NextResponse.json({ error: 'Failed to load RR history' }, { status: 500 })
  }
}
