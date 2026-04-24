export type PlacementType = 'lifetime' | 'seasonal' | 'none'

export type RrConfig = {
  baseStartingRr: number
  baseK: number
  scale: number
  movMultiplier: number

  placementGames: number

  lifetimePlacementMultiplier: number
  seasonalPlacementMultiplier: number

  lifetimePlacementWinMultiplier: number
  lifetimePlacementLossMultiplier: number

  seasonalPlacementWinMultiplier: number
  seasonalPlacementLossMultiplier: number

  nonPlacementWinMultiplier: number
  nonPlacementLossMultiplier: number
}

export const DEFAULT_RR_CONFIG: RrConfig = {
  baseStartingRr: 800,
  baseK: 40,
  scale: 400,
  movMultiplier: 0,

  placementGames: 5,

  lifetimePlacementMultiplier: 8.0,
  seasonalPlacementMultiplier: 2.0,

  lifetimePlacementWinMultiplier: 1,
  lifetimePlacementLossMultiplier: 1,

  seasonalPlacementWinMultiplier: 1.0,
  seasonalPlacementLossMultiplier: 1.0,

  nonPlacementWinMultiplier: 1.0,
  nonPlacementLossMultiplier: 1.0,
}