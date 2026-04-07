import { createBrowserClient } from '@supabase/ssr'

// Use this client in Client Components ('use client').
// It reads auth cookies automatically and keeps the session in sync.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
