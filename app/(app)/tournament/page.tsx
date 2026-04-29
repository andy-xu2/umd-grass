import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/utils'
import TournamentClient from './tournament-client'

export default async function TournamentPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || !isAdmin(user.id)) {
    redirect('/')
  }

  return <TournamentClient />
}