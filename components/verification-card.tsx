'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Check, X, Clock } from 'lucide-react'
import type { MatchResponse } from '@/lib/types'

interface VerificationCardProps {
  match: MatchResponse
  onConfirm?: (matchId: string) => void
  onReject?: (matchId: string) => void
}

export function VerificationCard({ match, onConfirm, onReject }: VerificationCardProps) {
  const submitterName =
    match.team1Player1.id === match.submittedBy
      ? match.team1Player1.name
      : match.team1Player2.name

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending Verification
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(match.submittedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Submitted by:{' '}
          <span className="font-medium text-foreground">{submitterName}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Team 1 */}
          <div className="flex flex-1 flex-col items-center gap-2 rounded-lg bg-secondary/30 p-3">
            <div className="flex -space-x-2">
              {[match.team1Player1, match.team1Player2].map(p => (
                <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="bg-secondary text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="text-center">
              <p className="text-xs">{match.team1Player1.name}</p>
              <p className="text-xs">{match.team1Player2.name}</p>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-bold">{match.team1Sets}</span>
            <span className="text-xs text-muted-foreground">vs</span>
            <span className="text-lg font-bold">{match.team2Sets}</span>
          </div>

          {/* Team 2 */}
          <div className="flex flex-1 flex-col items-center gap-2 rounded-lg bg-secondary/30 p-3">
            <div className="flex -space-x-2">
              {[match.team2Player1, match.team2Player2].map(p => (
                <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="bg-secondary text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="text-center">
              <p className="text-xs">{match.team2Player1.name}</p>
              <p className="text-xs">{match.team2Player2.name}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1 gap-2" onClick={() => onConfirm?.(match.id)}>
            <Check className="h-4 w-4" />
            Confirm
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onReject?.(match.id)}
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
