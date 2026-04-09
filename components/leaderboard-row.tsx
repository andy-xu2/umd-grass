import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getSkillTier } from '@/lib/mock-data'
import { cn, getInitials } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  /** Highlight this row when entry.userId matches */
  currentUserId?: string
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { bg: 'bg-yellow-500/20', text: 'text-yellow-500' }
  if (rank === 2) return { bg: 'bg-slate-400/20', text: 'text-slate-400' }
  if (rank === 3) return { bg: 'bg-amber-600/20', text: 'text-amber-600' }
  return { bg: 'bg-secondary', text: 'text-muted-foreground' }
}

export function LeaderboardRow({ entry, currentUserId }: LeaderboardRowProps) {
  const tier = getSkillTier(entry.rr)
  const isCurrentUser = entry.userId === currentUserId
  const rankDisplay = getRankDisplay(entry.rank)
  const href = isCurrentUser ? '/profile' : `/players/${entry.userId}`

  return (
    <Link href={href} className={cn(
      'flex items-center gap-4 rounded-lg p-4 transition-colors',
      isCurrentUser ? 'bg-primary/10 border border-primary/30 hover:bg-primary/15' : 'bg-secondary/30 hover:bg-secondary/50'
    )}>
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg font-bold',
        rankDisplay.bg,
        rankDisplay.text
      )}>
        {entry.rank <= 3 ? entry.rank : `#${entry.rank}`}
      </div>

      <Avatar className="h-10 w-10 border border-border">
        {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
        <AvatarFallback className="bg-secondary text-sm">
          {getInitials(entry.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold', isCurrentUser && 'text-primary')}>
            {entry.name}
          </span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-[10px] py-0 border-primary text-primary">
              YOU
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', tier.color)}>{tier.name}</span>
          <span className="text-xs text-muted-foreground">
            {entry.gamesPlayed} games
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {entry.rankTrend != null && entry.rankTrend !== 0 && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-semibold',
            entry.rankTrend > 0 ? 'text-green-500' : 'text-red-500'
          )}>
            {entry.rankTrend > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>{Math.abs(entry.rankTrend)}</span>
          </div>
        )}
        {entry.rankTrend === 0 && (
          <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}

        <div className="text-right">
          <p className="text-xl font-bold text-primary">{entry.rr}</p>
          <p className="text-xs text-muted-foreground">RR</p>
        </div>
      </div>
    </Link>
  )
}
