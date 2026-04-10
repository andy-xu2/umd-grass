import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq, asc } from 'drizzle-orm'
import PlayersClient from './players-client'

export default async function PlayersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const allUsers = await db.select().from(users).where(eq(users.isDeleted, false)).orderBy(asc(users.name))

  const players = allUsers.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  }))

  return <PlayersClient initialPlayers={players} />
}
