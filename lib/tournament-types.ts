import type {
  TournamentLiveScore,
  TournamentSetScore,
} from '@/drizzle/schema'

export type {
  TournamentLiveScore,
  TournamentSetScore,
} from '@/drizzle/schema'

export const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export type TournamentDivision = 'AA' | 'BB'
export type TournamentGameStatus = 'pending' | 'live' | 'complete'

export type TournamentPool = {
  id: string
  tournamentId: string
  division: TournamentDivision
  name: string
}

export type TournamentTeam = {
  id: string
  poolId: string
  name: string
}

export type TournamentGame = {
  id: string
  poolId: string
  team1Id: string
  team2Id: string
  status: TournamentGameStatus
  setScores: TournamentSetScore[]
  liveScore: TournamentLiveScore | null
  orderIndex: number
  scoredBy: string | null
}

export type TournamentPlayoffGame = {
  id: string
  tournamentId: string
  division: TournamentDivision
  round: string
  label: string
  team1Id: string | null
  team2Id: string | null
  team1Source: string | null
  team2Source: string | null
  status: TournamentGameStatus
  setScores: TournamentSetScore[]
  liveScore: TournamentLiveScore | null
  orderIndex: number
}
