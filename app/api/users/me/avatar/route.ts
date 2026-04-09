// POST /api/users/me/avatar — upload avatar via server using service_role key (bypasses Storage RLS)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[avatar upload] Supabase storage error:', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)
  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

  await db.update(users).set({ avatarUrl: cacheBustedUrl }).where(eq(users.id, user.id))

  return NextResponse.json({ avatarUrl: cacheBustedUrl })
}
