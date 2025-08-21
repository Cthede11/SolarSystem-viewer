// src/types/index.ts

export interface ViewSettings {
  useRealisticScale: boolean
  useRealisticSizes: boolean
  showOrbits: boolean
  followPlanet: string | null
}

export type ClickInfo = { 
  id: string
  label: string
  kind: 'planet' | 'star' | 'dwarf' | 'small' | 'spacecraft' 
}