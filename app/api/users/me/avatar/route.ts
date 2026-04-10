// POST   /api/users/me/avatar — upload avatar via server using service_role key (bypasses Storage RLS)
// DELETE /api/users/me/avatar — remove avatar

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

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

  // Validate MIME type against allowlist (never trust file.name or file.type from client alone)
  const ext = ALLOWED_MIME_TYPES[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, GIF, and WebP images are allowed' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 })
  }

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
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)
  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

  await db.update(users).set({ avatarUrl: cacheBustedUrl }).where(eq(users.id, user.id))

  return NextResponse.json({ avatarUrl: cacheBustedUrl })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Remove all avatar files for this user (any extension)
  const { data: files } = await admin.storage.from('avatars').list(user.id)
  if (files && files.length > 0) {
    const paths = files.map(f => `${user.id}/${f.name}`)
    await admin.storage.from('avatars').remove(paths)
  }

  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id))

  return NextResponse.json({ ok: true })
}
