import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getSkillTier, getWinRate } from '@/lib/mock-data'
import { cn, getInitials } from '@/lib/utils'

export interface PlayerCardUser {
  id: string
  name: string
  avatarUrl?: string | null
  /** RR from season_stats; 800 default if no stats yet */
  rr: number
  gamesPlayed: number
  wins: number
  losses: number
  /** When false, rank/RR is hidden (fewer than 5 confirmed games) */
  isRevealed: boolean
}

interface PlayerCardProps {
  user: PlayerCardUser
  showStats?: boolean
  className?: string
}

export function PlayerCard({ user, showStats = true, className }: PlayerCardProps) {
  const tier = getSkillTier(user.rr)
  const winRate = getWinRate(user.wins, user.gamesPlayed)

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-secondary text-lg font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{user.name}</h3>
              {!user.isRevealed ? (
                <Badge variant="secondary" className="text-xs">
                  Unranked
                </Badge>
              ) : (
                <Badge className={cn('text-xs border-0 bg-secondary', tier.color)}>
                  {tier.name}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              {user.isRevealed ? (
                <>
                  <span className="text-3xl font-bold text-primary">{user.rr}</span>
                  <span className="text-sm text-muted-foreground">RR</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  RR hidden until 5 games
                </span>
              )}
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
