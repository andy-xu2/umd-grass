import { createClient } from '@/lib/supabase-server'
import TournamentClient from './tournament-client'

export default async function TournamentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <TournamentClient currentUserId={user?.id ?? null} />
}
