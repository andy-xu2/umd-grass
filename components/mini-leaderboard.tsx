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
  if (rank === 1) return { bg: 'bg-amber-100 dark:bg-amber-400/15', text: 'text-amber-800 dark:text-amber-300' }
  if (rank === 2) return { bg: 'bg-slate-100 dark:bg-slate-300/15', text: 'text-slate-800 dark:text-slate-200' }
  if (rank === 3) return { bg: 'bg-orange-100 dark:bg-orange-400/15', text: 'text-orange-800 dark:text-orange-300' }
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
      <div className="flex min-h-64 items-center justify-center py-12 text-center text-sm text-muted-foreground">
        No players are ranked yet this season.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[430px] overflow-x-hidden overflow-y-auto [scrollbar-width:none] xl:min-h-0 xl:max-h-none xl:flex-1 [&::-webkit-scrollbar]:hidden"
    >
      <div>
        <div className="grid grid-cols-[32px_minmax(0,1fr)_48px_36px] gap-1 border-b px-1 pb-3 text-[11px] font-medium text-muted-foreground sm:grid-cols-[48px_minmax(0,1fr)_72px_56px] sm:gap-2 sm:px-2 sm:text-xs">
          <span className="text-center">#</span>
          <span>Player</span>
          <span className="text-right">RR</span>
          <span className="text-right">±</span>
        </div>
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
                'grid grid-cols-[32px_minmax(0,1fr)_48px_36px] items-center gap-1 border-b border-border/75 px-1 py-3 transition-colors last:border-0 sm:grid-cols-[48px_minmax(0,1fr)_72px_56px] sm:gap-2 sm:px-2',
                isMe
                  ? 'bg-primary/5 hover:bg-primary/8'
                  : 'hover:bg-secondary/45'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold sm:h-10 sm:w-10 sm:text-base',
                rankStyle.bg, rankStyle.text
              )}>
                {entry.rank}
              </div>

              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Avatar className="h-8 w-8 shrink-0 border border-border sm:h-10 sm:w-10">
                  {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
                  <AvatarFallback className="bg-primary/8 text-xs font-semibold text-primary">
                    {getInitials(entry.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('truncate text-xs font-semibold sm:text-sm', isMe && 'text-primary')}>
                      {entry.name}
                    </span>
                    {isMe && (
                      <Badge variant="outline" className="hidden shrink-0 rounded-full border-primary/30 py-0 text-[9px] text-primary sm:inline-flex">
                        YOU
                      </Badge>
                    )}
                  </div>
                  <span className={cn('hidden text-xs sm:block', entry.gamesPlayed === 0 ? 'text-muted-foreground' : tier.color)}>
                    {entry.gamesPlayed === 0 ? 'Unranked' : tier.name}
                  </span>
                </div>
              </div>

              <span className="text-right text-sm font-semibold tabular-nums sm:text-base">{entry.rr}</span>
              <div className="flex justify-end text-right">
                {entry.rankTrend != null && entry.rankTrend !== 0 && (
                  <span className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    entry.rankTrend > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-destructive'
                  )}>
                    {entry.rankTrend > 0
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(entry.rankTrend)}
                  </span>
                )}
                {(entry.rankTrend == null || entry.rankTrend === 0) && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
