import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'

export async function canManageTournament(userId: string) {
  if (isAdmin(userId)) return true

  const [user] = await db
    .select({ isTournamentAdmin: users.isTournamentAdmin })
    .from(users)
    .where(eq(users.id, userId))

  return user?.isTournamentAdmin === true
}