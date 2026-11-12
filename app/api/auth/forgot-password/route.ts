// POST /api/auth/forgot-password
// Generates a Supabase password-recovery link via the Admin API and
// delivers it through Resend instead of Supabase's own mailer.

import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPasswordResetEmail } from '@/lib/resend'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Always return success to prevent email enumeration
  const successResponse = NextResponse.json({ ok: true })

  try {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })

    if (error || !data?.properties?.hashed_token) {
      console.error('[forgot-password] generateLink failed:', error)
      return successResponse
    }

    // Supabase's own action_link redirects with tokens in the URL #fragment, which
    // the server callback can't read. Send our callback the token hash instead.
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?${new URLSearchParams({
      token_hash: data.properties.hashed_token,
      type: 'recovery',
      next: '/reset-password',
    })}`

    const result = await sendPasswordResetEmail(email, resetLink)
    console.log('[forgot-password] Resend result:', JSON.stringify(result))
  } catch (err) {
    console.error('[forgot-password] unexpected error:', err)
  }

  return successResponse
}
