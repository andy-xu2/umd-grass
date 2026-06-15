'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  useRealtimeRefresh,
  type RealtimeTable,
} from '@/hooks/use-realtime-refresh'

type RealtimeRouteRefreshProps = {
  channelName: string
  tables: readonly RealtimeTable[]
}

/**
 * Refreshes a Server Component route when its backing tables change.
 * The rendered component is intentionally empty.
 */
export function RealtimeRouteRefresh({
  channelName,
  tables,
}: RealtimeRouteRefreshProps) {
  const router = useRouter()
  const refreshRoute = useCallback(() => router.refresh(), [router])

  useRealtimeRefresh({
    channelName,
    tables,
    onRefresh: refreshRoute,
  })

  return null
}
