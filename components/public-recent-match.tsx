import { cn } from '@/lib/utils'
import type { PublicMatchResult } from '@/lib/public-dashboard'

function teamName(first: string, second: string) {
  return `${first} & ${second}`
}

export function PublicRecentMatch({ match }: { match: PublicMatchResult }) {
  const team1Won = match.team1Sets > match.team2Sets

  return (
    <article className="rounded-lg border border-border/80 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs">
        <span>{new Date(match.playedAt).toLocaleDateString()}</span>
        {match.setScores && match.setScores.length > 0 && (
          <span className="truncate font-mono">
            {match.setScores.map(score => `${score.team1}-${score.team2}`).join(', ')}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <p className={cn('min-w-0 text-xs font-medium leading-5 sm:text-sm', team1Won && 'text-primary')}>
          {teamName(match.team1Player1.name, match.team1Player2.name)}
        </p>
        <div className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-sm font-bold tabular-nums sm:text-base">
          <span className={cn(team1Won && 'text-primary')}>{match.team1Sets}</span>
          <span className="text-muted-foreground">–</span>
          <span className={cn(!team1Won && 'text-primary')}>{match.team2Sets}</span>
        </div>
        <p className={cn('min-w-0 text-right text-xs font-medium leading-5 sm:text-sm', !team1Won && 'text-primary')}>
          {teamName(match.team2Player1.name, match.team2Player2.name)}
        </p>
      </div>
    </article>
  )
}
