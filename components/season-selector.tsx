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
}

export function SeasonSelector({ value, onChange, className }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/seasons')
      .then(r => r.ok ? r.json() : [])
      .then((data: Season[]) => {
        setSeasons(data)
        // Default to the active season if no value provided
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
