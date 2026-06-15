import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getSkillTier, getWinRate, isUnranked } from '@/lib/ranks'
import { cn, getInitials } from '@/lib/utils'

export interface PlayerCardUser {
  id: string
  name: string
  avatarUrl?: string | null
  rr: number
  gamesPlayed: number
  wins: number
  losses: number
}

interface PlayerCardProps {
  user: PlayerCardUser
  showStats?: boolean
  profileHref?: string
  className?: string
}

export function PlayerCard({ user, showStats = true, profileHref, className }: PlayerCardProps) {
  const unranked = isUnranked(user.gamesPlayed)
  const tier = getSkillTier(user.rr)
  const winRate = getWinRate(user.wins, user.gamesPlayed)

  return (
    <Card className={cn('gap-0 overflow-hidden rounded-xl border-border/90 py-0 shadow-[0_2px_10px_rgba(15,23,42,0.035)]', className)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-16 w-16 border-0">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-primary text-lg font-semibold text-white">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-base font-semibold">
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {user.name}
                  </Link>
                ) : (
                  user.name
                )}
              </h3>
              {unranked ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  Unranked
                </Badge>
              ) : (
                <Badge className={cn('rounded-full border-0 bg-secondary px-3 py-1 text-[11px]', tier.color)}>
                  {tier.name}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              {unranked ? (
                <span className="text-sm text-muted-foreground">
                  {user.gamesPlayed === 0
                    ? 'No games played yet'
                    : `${user.gamesPlayed}/5 placement games`}
                </span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-foreground">{user.rr}</span>
                  <span className="text-sm text-muted-foreground">RR</span>
                </>
              )}
            </div>
          </div>
        </div>

        {showStats && (
          <div className="mt-5 grid grid-cols-3 divide-x border-t pt-5">
            <div className="px-2 text-center">
              <p className="text-xl font-semibold">{user.gamesPlayed}</p>
              <p className="text-xs text-muted-foreground">Games</p>
            </div>
            <div className="px-2 text-center">
              <p className="text-xl font-semibold">{user.wins}</p>
              <p className="text-xs text-muted-foreground">Wins</p>
            </div>
            <div className="px-2 text-center">
              <p className="text-xl font-semibold">{winRate}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
