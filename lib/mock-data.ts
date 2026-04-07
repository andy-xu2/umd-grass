export interface User {
  id: string
  username: string
  email: string
  rr: number
  gamesPlayed: number
  wins: number
  avatar?: string
}

export interface Match {
  id: string
  team1: { player1: User; player2: User }
  team2: { player1: User; player2: User }
  score?: { team1: number; team2: number }
  winner: 'team1' | 'team2'
  rrChange: { team1: number; team2: number }
  status: 'pending' | 'confirmed' | 'rejected'
  submittedBy: string
  date: string
}

export const users: User[] = [
  { id: '1', username: 'SpikeKing', email: 'spike@umd.edu', rr: 2150, gamesPlayed: 45, wins: 32, avatar: '' },
  { id: '2', username: 'DigMaster', email: 'dig@umd.edu', rr: 2080, gamesPlayed: 38, wins: 26, avatar: '' },
  { id: '3', username: 'SetterPro', email: 'setter@umd.edu', rr: 1950, gamesPlayed: 52, wins: 30, avatar: '' },
  { id: '4', username: 'BlockWall', email: 'block@umd.edu', rr: 1880, gamesPlayed: 41, wins: 22, avatar: '' },
  { id: '5', username: 'AceHunter', email: 'ace@umd.edu', rr: 1820, gamesPlayed: 33, wins: 18, avatar: '' },
  { id: '6', username: 'ServeBot', email: 'serve@umd.edu', rr: 1750, gamesPlayed: 29, wins: 15, avatar: '' },
  { id: '7', username: 'CourtKing', email: 'court@umd.edu', rr: 1680, gamesPlayed: 22, wins: 11, avatar: '' },
  { id: '8', username: 'NetNinja', email: 'net@umd.edu', rr: 1620, gamesPlayed: 18, wins: 8, avatar: '' },
  { id: '9', username: 'VolleyViper', email: 'volley@umd.edu', rr: 1550, gamesPlayed: 15, wins: 6, avatar: '' },
  { id: '10', username: 'GrassGod', email: 'grass@umd.edu', rr: 1480, gamesPlayed: 12, wins: 4, avatar: '' },
  { id: '11', username: 'SandStorm', email: 'sand@umd.edu', rr: 1420, gamesPlayed: 8, wins: 2, avatar: '' },
  { id: '12', username: 'BeachBeast', email: 'beach@umd.edu', rr: 1350, gamesPlayed: 3, wins: 1, avatar: '' },
]

export const currentUser: User = users[0]

export const matches: Match[] = [
  {
    id: 'm1',
    team1: { player1: users[0], player2: users[1] },
    team2: { player1: users[2], player2: users[3] },
    score: { team1: 21, team2: 18 },
    winner: 'team1',
    rrChange: { team1: 25, team2: -25 },
    status: 'confirmed',
    submittedBy: users[0].id,
    date: '2024-01-15',
  },
  {
    id: 'm2',
    team1: { player1: users[0], player2: users[2] },
    team2: { player1: users[4], player2: users[5] },
    score: { team1: 21, team2: 15 },
    winner: 'team1',
    rrChange: { team1: 20, team2: -20 },
    status: 'confirmed',
    submittedBy: users[2].id,
    date: '2024-01-14',
  },
  {
    id: 'm3',
    team1: { player1: users[0], player2: users[3] },
    team2: { player1: users[1], player2: users[6] },
    score: { team1: 18, team2: 21 },
    winner: 'team2',
    rrChange: { team1: -22, team2: 22 },
    status: 'confirmed',
    submittedBy: users[1].id,
    date: '2024-01-13',
  },
  {
    id: 'm4',
    team1: { player1: users[0], player2: users[4] },
    team2: { player1: users[2], player2: users[7] },
    score: { team1: 21, team2: 19 },
    winner: 'team1',
    rrChange: { team1: 18, team2: -18 },
    status: 'confirmed',
    submittedBy: users[0].id,
    date: '2024-01-12',
  },
  {
    id: 'm5',
    team1: { player1: users[0], player2: users[5] },
    team2: { player1: users[3], player2: users[8] },
    score: { team1: 21, team2: 12 },
    winner: 'team1',
    rrChange: { team1: 15, team2: -15 },
    status: 'confirmed',
    submittedBy: users[5].id,
    date: '2024-01-11',
  },
  {
    id: 'm6',
    team1: { player1: users[0], player2: users[1] },
    team2: { player1: users[6], player2: users[7] },
    score: { team1: 21, team2: 17 },
    winner: 'team1',
    rrChange: { team1: 12, team2: -12 },
    status: 'pending',
    submittedBy: users[0].id,
    date: '2024-01-16',
  },
  {
    id: 'm7',
    team1: { player1: users[2], player2: users[3] },
    team2: { player1: users[0], player2: users[4] },
    score: { team1: 19, team2: 21 },
    winner: 'team2',
    rrChange: { team1: -20, team2: 20 },
    status: 'pending',
    submittedBy: users[2].id,
    date: '2024-01-16',
  },
]

export const TIER_STYLES: Record<string, string> = {
  Diamond: 'text-cyan-400',
  Platinum: 'text-emerald-400',
  Gold: 'text-yellow-400',
  Silver: 'text-slate-400',
  Bronze: 'text-amber-600',
  Unranked: 'text-muted-foreground',
}

export function getSkillTier(rr: number): { name: string; color: string } {
  if (rr >= 2000) return { name: 'Diamond', color: TIER_STYLES.Diamond }
  if (rr >= 1800) return { name: 'Platinum', color: TIER_STYLES.Platinum }
  if (rr >= 1600) return { name: 'Gold', color: TIER_STYLES.Gold }
  if (rr >= 1400) return { name: 'Silver', color: TIER_STYLES.Silver }
  if (rr >= 1200) return { name: 'Bronze', color: TIER_STYLES.Bronze }
  return { name: 'Unranked', color: TIER_STYLES.Unranked }
}

export function isUnranked(gamesPlayed: number): boolean {
  return gamesPlayed < 5
}

export function getWinRate(wins: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0
  return Math.round((wins / gamesPlayed) * 100)
}

export function getRankedUsers(): User[] {
  return [...users].sort((a, b) => b.rr - a.rr)
}

export function getUserRank(userId: string): number {
  return getRankedUsers().findIndex(u => u.id === userId) + 1
}

export function getUserMatches(userId: string): Match[] {
  return matches.filter(m =>
    m.team1.player1.id === userId ||
    m.team1.player2.id === userId ||
    m.team2.player1.id === userId ||
    m.team2.player2.id === userId
  )
}

export function isUserInMatch(match: Match, userId: string, team: 'team1' | 'team2'): boolean {
  return match[team].player1.id === userId || match[team].player2.id === userId
}
