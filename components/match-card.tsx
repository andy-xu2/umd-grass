import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Match, currentUser, isUserInMatch } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Clock } from 'lucide-react'

interface MatchCardProps {
  match: Match
  compact?: boolean
}

function getUserTeam(match: Match, userId: string): 'team1' | 'team2' | null {
  if (isUserInMatch(match, userId, 'team1')) return 'team1'
  if (isUserInMatch(match, userId, 'team2')) return 'team2'
  return null
}

export function MatchCard({ match, compact = false }: MatchCardProps) {
  const userTeam = getUserTeam(match, currentUser.id)
  const isWin = userTeam === match.winner
  const rrChange = userTeam ? match.rrChange[userTeam] : 0

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            isWin ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
          )}>
            {isWin ? 'W' : 'L'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              vs {match.team1.player1.id === currentUser.id || match.team1.player2.id === currentUser.id
                ? `${match.team2.player1.username} & ${match.team2.player2.username}`
                : `${match.team1.player1.username} & ${match.team1.player2.username}`
              }
            </span>
            <span className="text-xs text-muted-foreground">
              {match.score ? `${match.score.team1} - ${match.score.team2}` : 'No score'}
            </span>
          </div>
        </div>
        {match.status === 'confirmed' ? (
          <div className={cn(
            'flex items-center gap-1 font-mono text-sm font-semibold',
            rrChange > 0 ? 'text-primary' : 'text-destructive'
          )}>
            {rrChange > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            {rrChange > 0 ? '+' : ''}{rrChange}
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

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {match.status === 'pending' && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </Badge>
            )}
            {match.status === 'confirmed' && (
              <Badge className="bg-primary/20 text-primary border-0">Confirmed</Badge>
            )}
            <span className="text-xs text-muted-foreground">{match.date}</span>
          </div>
          {userTeam && match.status === 'confirmed' && (
            <div className={cn(
              'flex items-center gap-1 font-mono text-sm font-semibold',
              rrChange > 0 ? 'text-primary' : 'text-destructive'
            )}>
              {rrChange > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {rrChange > 0 ? '+' : ''}{rrChange} RR
            </div>
          )}
          {userTeam && match.status === 'pending' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Pending verification
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Team 1 */}
          <div className={cn(
            'flex flex-1 flex-col items-center gap-2 rounded-lg p-3',
            match.winner === 'team1' ? 'bg-primary/10' : 'bg-secondary/30'
          )}>
            <div className="flex -space-x-2">
              <Avatar className="h-10 w-10 border-2 border-background">
                <AvatarFallback className="bg-secondary text-xs">
                  {match.team1.player1.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-10 w-10 border-2 border-background">
                <AvatarFallback className="bg-secondary text-xs">
                  {match.team1.player2.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">{match.team1.player1.username}</p>
              <p className="text-xs font-medium">{match.team1.player2.username}</p>
            </div>
            {match.winner === 'team1' && (
              <Badge className="bg-primary text-primary-foreground">WIN</Badge>
            )}
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-1">
            {match.score ? (
              <>
                <span className="text-2xl font-bold">{match.score.team1}</span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="text-2xl font-bold">{match.score.team2}</span>
              </>
            ) : (
              <span className="text-lg font-bold text-muted-foreground">VS</span>
            )}
          </div>

          {/* Team 2 */}
          <div className={cn(
            'flex flex-1 flex-col items-center gap-2 rounded-lg p-3',
            match.winner === 'team2' ? 'bg-primary/10' : 'bg-secondary/30'
          )}>
            <div className="flex -space-x-2">
              <Avatar className="h-10 w-10 border-2 border-background">
                <AvatarFallback className="bg-secondary text-xs">
                  {match.team2.player1.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-10 w-10 border-2 border-background">
                <AvatarFallback className="bg-secondary text-xs">
                  {match.team2.player2.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">{match.team2.player1.username}</p>
              <p className="text-xs font-medium">{match.team2.player2.username}</p>
            </div>
            {match.winner === 'team2' && (
              <Badge className="bg-primary text-primary-foreground">WIN</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
