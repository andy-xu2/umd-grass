import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { canManageTournament } from '@/lib/tournament-admin'
import TournamentClient from './tournament-client'

// app/(app)/tournament/page.tsx
export default async function TournamentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <TournamentClient currentUserId={user?.id ?? null} />
}