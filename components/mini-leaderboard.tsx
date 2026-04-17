'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getSkillTier } from '@/lib/ranks'
import { cn, getInitials } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/types'

function getRankStyle(rank: number) {
  if (rank === 1) return { bg: 'bg-yellow-500/20', text: 'text-yellow-500' }
  if (rank === 2) return { bg: 'bg-slate-400/20', text: 'text-slate-400' }
  if (rank === 3) return { bg: 'bg-amber-600/20', text: 'text-amber-600' }
  return { bg: 'bg-secondary', text: 'text-muted-foreground' }
}

interface Props {
  entries: LeaderboardEntry[]
  currentUserId: string
}

export function MiniLeaderboard({ entries, currentUserId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const myRowRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (myRowRef.current && containerRef.current) {
      const container = containerRef.current
      const row = myRowRef.current
      const rowTop = row.offsetTop
      const rowHeight = row.offsetHeight
      const containerHeight = container.clientHeight
      // Center the user's row in the visible area
      container.scrollTop = rowTop - containerHeight / 2 + rowHeight / 2
    }
  }, [])

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
        No players ranked yet this season.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="overflow-y-auto pr-1" style={{ maxHeight: '420px' }}>
      <div className="space-y-1">
        {entries.map(entry => {
          const isMe = entry.userId === currentUserId
          const tier = getSkillTier(entry.rr)
          const rankStyle = getRankStyle(entry.rank)
          const href = isMe ? '/profile' : `/players/${entry.userId}`

          return (
            <Link
              key={entry.userId}
              href={href}
              ref={isMe ? myRowRef : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isMe
                  ? 'bg-primary/10 border border-primary/30 hover:bg-primary/15'
                  : 'hover:bg-secondary/50'
              )}
            >
              {/* Rank badge */}
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                rankStyle.bg, rankStyle.text
              )}>
                {entry.rank <= 3 ? entry.rank : `#${entry.rank}`}
              </div>

              {/* Avatar */}
              <Avatar className="h-8 w-8 shrink-0 border border-border">
                {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
                <AvatarFallback className="bg-secondary text-xs">
                  {getInitials(entry.name)}
                </AvatarFallback>
              </Avatar>

              {/* Name + tier */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('truncate text-sm font-semibold', isMe && 'text-primary')}>
                    {entry.name}
                  </span>
                  {isMe && (
                    <Badge variant="outline" className="shrink-0 border-primary py-0 text-[9px] text-primary">
                      YOU
                    </Badge>
                  )}
                </div>
                <span className={cn('text-xs', entry.gamesPlayed === 0 ? 'text-muted-foreground' : tier.color)}>
                  {entry.gamesPlayed === 0 ? 'Unranked' : tier.name}
                </span>
              </div>

              {/* RR + trend */}
              <div className="flex shrink-0 items-center gap-1.5 text-right">
                {entry.rankTrend != null && entry.rankTrend !== 0 && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-[10px] font-semibold',
                    entry.rankTrend > 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {entry.rankTrend > 0
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(entry.rankTrend)}
                  </span>
                )}
                <div>
                  <p className="text-sm font-bold text-primary">{entry.rr}</p>
                  <p className="text-[10px] text-muted-foreground">RR</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
