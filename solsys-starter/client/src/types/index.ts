// src/types/index.ts

export interface ViewSettings {
  useRealisticScale: boolean
  useRealisticSizes: boolean
  showOrbits: boolean
  followPlanet: string | null
  realisticVisibilityScale?: number // multiplier for radii when realistic sizes are on
}

export type ClickInfo = { 
  id: string
  label: string
  kind: 'planet' | 'star' | 'dwarf' | 'small' | 'spacecraft' 
}