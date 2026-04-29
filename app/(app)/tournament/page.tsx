import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { canManageTournament } from '@/lib/tournament-admin'
import TournamentClient from './tournament-client'

export default async function TournamentPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/')
  }

  const allowed = await canManageTournament(user.id)

  if (!allowed) {
    redirect('/')
  }

  return <TournamentClient />
}