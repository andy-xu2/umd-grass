import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Clock } from 'lucide-react'
import type { MatchResponse } from '@/lib/types'

interface MatchCardProps {
  match: MatchResponse
  currentUserId: string
  compact?: boolean
}

export function MatchCard({ match, currentUserId, compact = false }: MatchCardProps) {
  const onTeam1 =
    match.team1Player1.id === currentUserId || match.team1Player2.id === currentUserId
  const team1Won = match.team1Sets > match.team2Sets
  const isWin = onTeam1 ? team1Won : !team1Won

  const opponents = onTeam1
    ? `${match.team2Player1.name} & ${match.team2Player2.name}`
    : `${match.team1Player1.name} & ${match.team1Player2.name}`

  const rrChange = match.rrChange ?? 0

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
              isWin
                ? 'bg-primary/20 text-primary'
                : 'bg-destructive/20 text-destructive',
            )}
          >
            {isWin ? 'W' : 'L'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">vs {opponents}</span>
            <span className="text-xs text-muted-foreground">
              {match.team1Sets} – {match.team2Sets}
            </span>
          </div>
        </div>
        {match.status === 'CONFIRMED' ? (
          <div
            className={cn(
              'flex items-center gap-1 font-mono text-sm font-semibold',
              rrChange > 0 ? 'text-primary' : 'text-destructive',
            )}
          >
            {rrChange > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            {rrChange > 0 ? '+' : ''}
            {rrChange}
          </div>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        )}
      </div>
    )
  }

  const winnerTeam = team1Won ? 'team1' : 'team2'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {match.status === 'PENDING' && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </Badge>
            )}
            {match.status === 'CONFIRMED' && (
              <Badge className="bg-primary/20 text-primary border-0">Confirmed</Badge>
            )}
            {match.status === 'REJECTED' && (
              <Badge variant="destructive">Rejected</Badge>
            )}
            {match.status === 'EXPIRED' && (
              <Badge variant="secondary">Expired</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(match.submittedAt).toLocaleDateString()}
            </span>
          </div>
          {match.status === 'CONFIRMED' && (
            <div
              className={cn(
                'flex items-center gap-1 font-mono text-sm font-semibold',
                rrChange > 0 ? 'text-primary' : 'text-destructive',
              )}
            >
              {rrChange > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {rrChange > 0 ? '+' : ''}
              {rrChange} RR
            </div>
          )}
          {match.status === 'PENDING' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Pending verification
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Team 1 */}
          <div
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-lg p-3',
              winnerTeam === 'team1' ? 'bg-primary/10' : 'bg-secondary/30',
            )}
          >
            <div className="flex -space-x-2">
              {[match.team1Player1, match.team1Player2].map(p => (
                <Avatar key={p.id} className="h-10 w-10 border-2 border-background">
                  <AvatarFallback className="bg-secondary text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">{match.team1Player1.name}</p>
              <p className="text-xs font-medium">{match.team1Player2.name}</p>
            </div>
            {winnerTeam === 'team1' && (
              <Badge className="bg-primary text-primary-foreground">WIN</Badge>
            )}
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold">{match.team1Sets}</span>
            <span className="text-xs text-muted-foreground">vs</span>
            <span className="text-2xl font-bold">{match.team2Sets}</span>
          </div>

          {/* Team 2 */}
          <div
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-lg p-3',
              winnerTeam === 'team2' ? 'bg-primary/10' : 'bg-secondary/30',
            )}
          >
            <div className="flex -space-x-2">
              {[match.team2Player1, match.team2Player2].map(p => (
                <Avatar key={p.id} className="h-10 w-10 border-2 border-background">
                  <AvatarFallback className="bg-secondary text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">{match.team2Player1.name}</p>
              <p className="text-xs font-medium">{match.team2Player2.name}</p>
            </div>
            {winnerTeam === 'team2' && (
              <Badge className="bg-primary text-primary-foreground">WIN</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
