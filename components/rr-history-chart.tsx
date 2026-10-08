'use client'

import { useCallback, useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import type { RrHistoryEntry } from '@/lib/types'

const chartConfig = { rr: { label: 'RR', color: 'var(--primary)' } }
const realtimeTables = ['matches', 'rr_changes', 'season_stats'] as const
const timeZone = 'America/New_York'

interface Props {
  seasonId: string | null
  initialSeasonId: string | null
  initialHistory: RrHistoryEntry[]
}

export function RrHistoryChart({ seasonId, initialSeasonId, initialHistory }: Props) {
  const [result, setResult] = useState({ seasonId: initialSeasonId, history: initialHistory })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey(key => key + 1), [])

  useRealtimeRefresh({
    channelName: 'profile-rr-history',
    tables: realtimeTables,
    filter: seasonId ? `season_id=eq.${seasonId}` : undefined,
    enabled: !!seasonId,
    onRefresh: refresh,
  })

  useEffect(() => {
    if (!seasonId) return
    const controller = new AbortController()
    const url = `/api/users/me/rr-history?seasonId=${encodeURIComponent(seasonId)}`
    setLoading(true)
    setError(false)

    async function loadHistory() {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Failed to load RR history')
        const history: RrHistoryEntry[] = await response.json()
        if (!controller.signal.aborted) setResult({ seasonId, history })
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadHistory()
    return () => controller.abort()
  }, [seasonId, refreshKey])

  const history = result.seasonId === seasonId ? result.history : []
  const first = history[0]
  const points = first ? [
    { label: 'Start', rr: first.rrBefore, playedAt: first.playedAt, delta: null },
    ...history.map(entry => ({
      label: entry.matchId,
      rr: entry.rrAfter,
      playedAt: entry.playedAt,
      delta: entry.delta,
    })),
  ] : []
  const pointsByLabel = new Map(points.map(point => [point.label, point]))
  const pending = !!seasonId && (loading || result.seasonId !== seasonId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>RR History</CardTitle>
        <CardDescription>Your rating after each confirmed match in the selected season</CardDescription>
      </CardHeader>
      <CardContent aria-busy={pending && !error}>
        {!seasonId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Select a season to view your RR history.</p>
        ) : error ? (
          <div role="alert" className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Could not load your RR history.</p>
            <Button variant="outline" onClick={refresh}>Try again</Button>
          </div>
        ) : pending ? (
          <div role="status" aria-label="Loading RR history">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !first ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No RR history yet. Your graph will appear after a match is confirmed in this season.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {first.rrBefore} RR before your first match → {history[history.length - 1].rrAfter} RR after your latest match
            </p>
            <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto [&_.recharts-surface]:focus-visible:outline [&_.recharts-surface]:focus-visible:outline-2 [&_.recharts-surface]:focus-visible:outline-ring">
              <LineChart data={points} accessibilityLayer margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  tickFormatter={label => {
                    const point = pointsByLabel.get(label)
                    return label === 'Start' ? 'Start' : point ? formatInTimeZone(point.playedAt, timeZone, 'MMM d') : ''
                  }}
                />
                <YAxis tickLine={false} axisLine={false} width={48} allowDecimals={false} domain={['auto', 'auto']} />
                <ChartTooltip content={
                  <ChartTooltipContent labelFormatter={(_, payload) => {
                    const point = payload[0]?.payload as typeof points[number] | undefined
                    if (!point) return ''
                    if (point.delta === null) return 'Before your first match'
                    const change = `${point.delta > 0 ? '+' : ''}${point.delta} RR`
                    return `${formatInTimeZone(point.playedAt, timeZone, 'MMM d, yyyy h:mm a zzz')} (${change})`
                  }} />
                } />
                <Line type="linear" dataKey="rr" stroke="var(--color-rr)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
            <details className="mt-4 text-sm">
              <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View rating history as a table</summary>
              <div className="mt-3 max-h-64 overflow-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Confirmed match rating history, oldest first. All dates are Eastern time.</caption>
                  <thead><tr className="border-b"><th scope="col" className="py-2">Match date (Eastern)</th><th scope="col" className="px-2 py-2 text-right">RR</th><th scope="col" className="py-2 text-right">Change</th></tr></thead>
                  <tbody>
                    <tr className="border-b"><th scope="row" className="py-2 font-normal">Before first match</th><td className="px-2 py-2 text-right tabular-nums">{first.rrBefore}</td><td className="py-2 text-right">—</td></tr>
                    {history.map(entry => (
                      <tr key={entry.matchId} className="border-b">
                        <th scope="row" className="py-2 font-normal">{formatInTimeZone(entry.playedAt, timeZone, 'MMM d, yyyy h:mm a')}</th>
                        <td className="px-2 py-2 text-right tabular-nums">{entry.rrAfter}</td>
                        <td className="py-2 text-right tabular-nums">{entry.delta > 0 ? '+' : ''}{entry.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}
