import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/utils'
import { canManageTournament } from '@/lib/tournament-admin'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({
      isAdmin: false,
      isTournamentAdmin: false,
    })
  }

  const admin = isAdmin(user.id)
  const tournamentAdmin = await canManageTournament(user.id)

  return NextResponse.json({
    isAdmin: admin,
    isTournamentAdmin: tournamentAdmin,
  })
}