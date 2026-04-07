export type MatchStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED'

export interface PlayerInfo {
  id: string
  name: string
  avatarUrl: string | null
}

export interface MatchResponse {
  id: string
  seasonId: string
  submittedBy: string
  team1Player1: PlayerInfo
  team1Player2: PlayerInfo
  team2Player1: PlayerInfo
  team2Player2: PlayerInfo
  team1Sets: number
  team2Sets: number
  status: MatchStatus
  submittedAt: string
  expiresAt: string
  verifiedBy: string | null
  verifiedAt: string | null
  /** Signed RR delta for the requesting user; null if match is not CONFIRMED or no change recorded */
  rrChange: number | null
}

export interface SeasonStatsShape {
  id: string
  rr: number
  hiddenMmr: number
  gamesPlayed: number
  wins: number
  losses: number
  isRevealed: boolean
}

export interface UserWithStats {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
  stats: SeasonStatsShape | null
}

export interface LeaderboardEntry {
  rank: number | null   // null when isRevealed = false (< 5 games)
  userId: string
  name: string
  avatarUrl: string | null
  rr: number
  gamesPlayed: number
  wins: number
  losses: number
  isRevealed: boolean
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  seasonId: string | null
}
