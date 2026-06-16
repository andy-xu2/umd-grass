'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

export type RealtimeTable =
  | 'matches'
  | 'season_stats'
  | 'rr_changes'
  | 'courts'
  | 'court_queue_entries'

type RealtimeRefreshOptions = {
  channelName: string
  tables: readonly RealtimeTable[]
  onRefresh: () => void | Promise<void>
  enabled?: boolean
  debounceMs?: number
  filter?: string
  refreshOnInitialSubscribe?: boolean
}

/**
 * Refetches authoritative API data after a relevant Supabase Postgres change.
 * Closely grouped changes (for example a match plus four RR updates) collapse
 * into one refresh instead of producing a burst of requests.
 */
export function useRealtimeRefresh({
  channelName,
  tables,
  onRefresh,
  enabled = true,
  debounceMs = 250,
  filter,
  refreshOnInitialSubscribe = true,
}: RealtimeRefreshOptions) {
  const refreshRef = useRef(onRefresh)

  useEffect(() => {
    refreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled || tables.length === 0) return

    const supabase = createClient()
    const channel = supabase.channel(channelName)
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let hasSubscribed = false

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        void Promise.resolve()
          .then(() => refreshRef.current())
          .catch(error => {
            console.error('Realtime refresh failed:', error)
          })
      }, debounceMs)
    }

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        scheduleRefresh,
      )
    }

    channel.subscribe(status => {
      if (status !== 'SUBSCRIBED') return

      if (hasSubscribed || refreshOnInitialSubscribe) scheduleRefresh()
      hasSubscribed = true
    })

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [channelName, debounceMs, enabled, filter, refreshOnInitialSubscribe, tables])
}
