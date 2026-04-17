const TIER_STYLES: Record<string, string> = {
  Diamond: 'text-cyan-400',
  Platinum: 'text-emerald-400',
  Gold: 'text-yellow-400',
  Silver: 'text-slate-400',
  Bronze: 'text-amber-600',
  Unranked: 'text-muted-foreground',
}

export function getSkillTier(rr: number): { name: string; color: string } {
  if (rr >= 2000) return { name: 'Diamond', color: TIER_STYLES.Diamond }
  if (rr >= 1500) return { name: 'Platinum', color: TIER_STYLES.Platinum }
  if (rr >= 1000) return { name: 'Gold', color: TIER_STYLES.Gold }
  if (rr >= 500) return { name: 'Silver', color: TIER_STYLES.Silver }
  return { name: 'Bronze', color: TIER_STYLES.Bronze }
}

export function isUnranked(gamesPlayed: number): boolean {
  return gamesPlayed < 5
}

export function getWinRate(wins: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0
  return Math.round((wins / gamesPlayed) * 100)
}
