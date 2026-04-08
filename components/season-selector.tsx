'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Season } from '@/lib/types'

interface SeasonSelectorProps {
  value: string | null
  onChange: (seasonId: string) => void
  className?: string
  /** Pre-fetched seasons from a server component. When provided the internal
   *  fetch is skipped and the selector renders immediately with no loading delay. */
  initialSeasons?: Season[]
}

export function SeasonSelector({ value, onChange, className, initialSeasons }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons ?? [])
  const [loading, setLoading] = useState(initialSeasons === undefined)

  useEffect(() => {
    // Skip the network fetch when the parent already supplied the seasons list.
    if (initialSeasons !== undefined) return

    fetch('/api/seasons')
      .then(r => r.ok ? r.json() : [])
      .then((data: Season[]) => {
        setSeasons(data)
        if (!value && data.length > 0) {
          const active = data.find(s => s.isActive) ?? data[0]
          onChange(active.id)
        }
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || seasons.length === 0) return null

  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'w-48'}>
        <SelectValue placeholder="Select season" />
      </SelectTrigger>
      <SelectContent>
        {seasons.map(season => (
          <SelectItem key={season.id} value={season.id}>
            {season.name}
            {season.isActive ? ' (Active)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
