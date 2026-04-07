import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/drizzle/schema'

// Reuse the same postgres connection across hot-reloads in Next.js dev mode.
// In production, each serverless function gets its own fresh connection.
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql }

const client =
  globalForDb._pgClient ??
  postgres(process.env.DATABASE_URL!, {
    // pgBouncer in transaction mode requires prepare: false
    prepare: false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb._pgClient = client
}

export const db = drizzle(client, { schema })
