import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, getSkillTier, isUnranked, currentUser } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface LeaderboardRowProps {
  user: User
  rank: number
}

export function LeaderboardRow({ user, rank }: LeaderboardRowProps) {
  const tier = getSkillTier(user.rr)
  const unranked = isUnranked(user.gamesPlayed)
  const isCurrentUser = user.id === currentUser.id

  const getRankDisplay = () => {
    if (rank === 1) return { bg: 'bg-yellow-500/20', text: 'text-yellow-500', icon: '1st' }
    if (rank === 2) return { bg: 'bg-slate-400/20', text: 'text-slate-400', icon: '2nd' }
    if (rank === 3) return { bg: 'bg-amber-600/20', text: 'text-amber-600', icon: '3rd' }
    return { bg: 'bg-secondary', text: 'text-muted-foreground', icon: `#${rank}` }
  }

  const rankDisplay = getRankDisplay()

  return (
    <div className={cn(
      'flex items-center gap-4 rounded-lg p-4 transition-colors',
      isCurrentUser ? 'bg-primary/10 border border-primary/30' : 'bg-secondary/30 hover:bg-secondary/50'
    )}>
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg font-bold',
        rankDisplay.bg,
        rankDisplay.text
      )}>
        {rank <= 3 ? rank : `#${rank}`}
      </div>

      <Avatar className="h-10 w-10 border border-border">
        <AvatarFallback className="bg-secondary text-sm">
          {user.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold', isCurrentUser && 'text-primary')}>
            {user.username}
          </span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-[10px] py-0 border-primary text-primary">
              YOU
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unranked ? (
            <span className="text-xs text-muted-foreground">Unranked</span>
          ) : (
            <span className={cn('text-xs font-medium', tier.color)}>{tier.name}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {user.gamesPlayed} games
          </span>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xl font-bold text-primary">{user.rr}</p>
        <p className="text-xs text-muted-foreground">RR</p>
      </div>
    </div>
  )
}
