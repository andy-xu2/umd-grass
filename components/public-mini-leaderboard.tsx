import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn, getInitials } from '@/lib/utils'
import { getSkillTier } from '@/lib/ranks'
import type { LeaderboardEntry } from '@/lib/types'

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'
  if (rank === 2) return 'bg-slate-100 text-slate-700 dark:bg-slate-300/15 dark:text-slate-200'
  if (rank === 3) return 'bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300'
  return 'bg-secondary text-muted-foreground'
}

export function PublicMiniLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center text-center text-sm text-muted-foreground">
        No players are ranked yet this season.
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[34px_minmax(0,1fr)_52px] gap-2 border-b pb-3 text-[11px] font-medium text-muted-foreground sm:grid-cols-[44px_minmax(0,1fr)_72px] sm:text-xs">
        <span className="text-center">#</span>
        <span>Player</span>
        <span className="text-right">RR</span>
      </div>
      {entries.map(entry => {
        const tier = getSkillTier(entry.rr)
        return (
          <div
            key={entry.userId}
            className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-2 border-b border-border/75 py-3 last:border-0 sm:grid-cols-[44px_minmax(0,1fr)_72px] sm:py-3.5"
          >
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm', rankStyle(entry.rank))}>
              {entry.rank}
            </span>
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0 border sm:h-9 sm:w-9">
                {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
                <AvatarFallback className="bg-primary/8 text-[10px] font-semibold text-primary">
                  {getInitials(entry.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold sm:text-sm">{entry.name}</p>
                <Badge variant="outline" className={cn('mt-0.5 h-4 max-w-full overflow-hidden border-0 px-0 text-[10px] text-ellipsis', tier.color)}>
                  {tier.name} · {entry.gamesPlayed} games
                </Badge>
              </div>
            </div>
            <span className="text-right text-sm font-semibold tabular-nums sm:text-base">{entry.rr}</span>
          </div>
        )
      })}
    </div>
  )
}
