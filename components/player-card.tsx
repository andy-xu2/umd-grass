import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, getSkillTier, isUnranked, getWinRate } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface PlayerCardProps {
  user: User
  showStats?: boolean
  className?: string
}

export function PlayerCard({ user, showStats = true, className }: PlayerCardProps) {
  const tier = getSkillTier(user.rr)
  const unranked = isUnranked(user.gamesPlayed)
  const winRate = getWinRate(user.wins, user.gamesPlayed)

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarFallback className="bg-secondary text-lg font-semibold">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{user.username}</h3>
              {unranked ? (
                <Badge variant="secondary" className="text-xs">
                  Unranked
                </Badge>
              ) : (
                <Badge className={cn('text-xs', tier.color, 'bg-secondary border-0')}>
                  {tier.name}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary">{user.rr}</span>
              <span className="text-sm text-muted-foreground">RR</span>
            </div>
          </div>
        </div>

        {showStats && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="text-2xl font-bold">{user.gamesPlayed}</p>
              <p className="text-xs text-muted-foreground">Games</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="text-2xl font-bold">{user.wins}</p>
              <p className="text-xs text-muted-foreground">Wins</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="text-2xl font-bold">{winRate}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
