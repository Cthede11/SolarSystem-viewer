import React, { useState, useEffect, useRef } from 'react'
import type { ViewSettings } from '../types'

interface PlanetInfo {
  id: string
  name: string
  type: 'star' | 'planet'
  diameter: string
  distance: string
  description: string
  facts: string[]
  stats: Record<string, string>
  color: string
}

interface PlanetDirectoryProps {
  onSelectPlanet: (planetId: string) => void
  selectedPlanet: string | null
  settings: ViewSettings
}

const PLANET_DATABASE: Record<string, PlanetInfo> = {
  '10': {
    id: '10',
    name: 'Sun',
    type: 'star',
    diameter: '1,392,700 km',
    distance: '0 km (center)',
    description: 'The Sun is the star at the center of our Solar System. It is a nearly perfect sphere of hot plasma, heated by nuclear fusion reactions in its core.',
    facts: [
      'Contains 99.86% of the Solar System\'s mass',
      'Surface temperature: 5,778 K (5,505°C)',
      'Core temperature: 15 million°C',
      'Light takes 8 minutes to reach Earth'
    ],
    stats: { 
      mass: '1.989 × 10³⁰ kg', 
      volume: '1.412 × 10²⁷ m³', 
      surfaceGravity: '274 m/s²',
      surfaceTemp: '5,505°C'
    },
    color: '#ffdd44'
  },
  '199': {
    id: '199',
    name: 'Mercury',
    type: 'planet',
    diameter: '4,879 km',
    distance: '58M km from Sun',
    description: 'Mercury is the smallest planet in our solar system and the closest to the Sun. It has extreme temperature variations and no substantial atmosphere.',
    facts: [
      'Closest planet to the Sun',
      'Day is longer than its year (176 Earth days)',
      'No moons',
      'Surface heavily cratered like the Moon'
    ],
    stats: { 
      mass: '3.285 × 10²³ kg', 
      gravity: '3.7 m/s²', 
      dayLength: '59 Earth days',
      orbitalPeriod: '88 days'
    },
    color: '#8c7853'
  },
  '299': {
    id: '299',
    name: 'Venus',
    type: 'planet',
    diameter: '12,104 km',
    distance: '108M km from Sun',
    description: 'Venus is the second planet from the Sun and the hottest planet in our solar system due to its thick, toxic atmosphere.',
    facts: [
      'Hottest planet: 462°C surface',
      'Rotates backwards (retrograde)',
      'Thick CO₂ atmosphere',
      'Day longer than year (243 vs 225 days)'
    ],
    stats: { 
      mass: '4.867 × 10²⁴ kg', 
      gravity: '8.87 m/s²', 
      dayLength: '243 Earth days',
      orbitalPeriod: '225 days'
    },
    color: '#ffcc33'
  },
  '399': {
    id: '399',
    name: 'Earth',
    type: 'planet',
    diameter: '12,756 km',
    distance: '150M km from Sun',
    description: 'Earth is our home planet and the only known place with life. It has liquid water, a protective atmosphere, and a suitable temperature range.',
    facts: [
      'Only known planet with life',
      '71% of surface is water',
      'One natural satellite (Moon)',
      'Atmosphere: 78% nitrogen, 21% oxygen'
    ],
    stats: { 
      mass: '5.972 × 10²⁴ kg', 
      gravity: '9.807 m/s²', 
      dayLength: '24 hours',
      orbitalPeriod: '365.25 days'
    },
    color: '#6ec6ff'
  },
  '499': {
    id: '499',
    name: 'Mars',
    type: 'planet',
    diameter: '6,779 km',
    distance: '228M km from Sun',
    description: 'Mars is a cold desert world and the fourth planet from the Sun. It has the largest volcano in the solar system (Olympus Mons).',
    facts: [
      'Has two small moons (Phobos and Deimos)',
      'Possible ancient water flow features',
      'Home to Olympus Mons, tallest volcano',
      'Often called the Red Planet'
    ],
    stats: { 
      mass: '6.39 × 10²³ kg', 
      gravity: '3.71 m/s²', 
      dayLength: '24h 37m',
      orbitalPeriod: '687 days'
    },
    color: '#ff785a'
  },
  '599': {
    id: '599',
    name: 'Jupiter',
    type: 'planet',
    diameter: '139,820 km',
    distance: '778M km from Sun',
    description: 'Jupiter is the largest planet in our solar system, known for its Great Red Spot and strong magnetic field.',
    facts: [
      'Largest planet',
      'At least 95 known moons',
      'Great Red Spot is a giant storm',
      'Strong magnetosphere'
    ],
    stats: { 
      mass: '1.898 × 10²⁷ kg', 
      gravity: '24.79 m/s²', 
      dayLength: '9h 56m',
      orbitalPeriod: '11.86 years'
    },
    color: '#d8ca9d'
  },
  '699': {
    id: '699',
    name: 'Saturn',
    type: 'planet',
    diameter: '120,536 km',
    distance: '1.4B km from Sun',
    description: 'Saturn is famous for its prominent ring system. It is a gas giant with the lowest density of any planet in our solar system.',
    facts: [
      'Spectacular ring system',
      'Lowest density: would float in water',
      'Over 140 known moons',
      'Largest moon Titan has thick atmosphere'
    ],
    stats: { 
      mass: '5.683 × 10²⁶ kg', 
      gravity: '10.44 m/s²', 
      dayLength: '10h 33m',
      orbitalPeriod: '29 years'
    },
    color: '#fad5a5'
  },
  '799': {
    id: '799',
    name: 'Uranus',
    type: 'planet',
    diameter: '51,118 km',
    distance: '2.9B km from Sun',
    description: 'Uranus is an ice giant that rotates on its side. It has a faint ring system and a very cold atmosphere.',
    facts: [
      'Axis tilted 98° (rolls on its side)',
      'Faint rings',
      'Cold methane-rich atmosphere',
      'Discovered by William Herschel (1781)'
    ],
    stats: { 
      mass: '8.681 × 10²⁵ kg', 
      gravity: '8.69 m/s²', 
      dayLength: '17h 14m',
      orbitalPeriod: '84 years'
    },
    color: '#4fd0e4'
  },
  '899': {
    id: '899',
    name: 'Neptune',
    type: 'planet',
    diameter: '49,528 km',
    distance: '4.5B km from Sun',
    description: 'Neptune is the windiest planet and the farthest from the Sun. It has a deep blue color due to methane in its atmosphere.',
    facts: [
      'Strongest winds in the solar system',
      'Discovered mathematically before observation',
      'Dark Spot storms like Jupiter\'s',
      'Moon Triton likely a captured KBO'
    ],
    stats: { 
      mass: '1.024 × 10²⁶ kg', 
      gravity: '11.15 m/s²', 
      dayLength: '16h 6m',
      orbitalPeriod: '165 years'
    },
    color: '#4b70dd'
  }
}

export default function PlanetDirectory({ onSelectPlanet, selectedPlanet, settings }: PlanetDirectoryProps) {
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null)

  // track DOM nodes to scroll into view
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // auto-expand + scroll when a planet is selected elsewhere (canvas/controls)
  useEffect(() => {
    if (!selectedPlanet) return
    setExpandedPlanet(selectedPlanet)
    const el = itemRefs.current[selectedPlanet]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('selected-pulse')
      setTimeout(() => el.classList.remove('selected-pulse'), 600)
    }
  }, [selectedPlanet])

  // also listen to global selection events so Directory stays in sync
  useEffect(() => {
    const onSel = (e: Event) => {
      const ce = e as CustomEvent<{ id: string | null }>
      const id = ce.detail?.id
      if (id) onSelectPlanet(id)
    }
    window.addEventListener('app:select', onSel)
    return () => window.removeEventListener('app:select', onSel)
  }, [onSelectPlanet])

  const handlePlanetClick = (planetId: string) => {
    if (expandedPlanet === planetId) {
      setExpandedPlanet(null)
    } else {
      setExpandedPlanet(planetId)
    }
  }

  const handleFocusClick = (planetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectPlanet(planetId)
    // broadcast for canvas focus/directories to sync
    window.dispatchEvent(new CustomEvent('app:select', { detail: { id: planetId }}))
  }

  const handleLearnMore = (planetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Open the info drawer ONLY via this event
    window.dispatchEvent(new CustomEvent('app:showDetails', { detail: { id: planetId }}))
  }

  // Order planets by distance from Sun
  const orderedPlanets = ['10', '199', '299', '399', '499', '599', '699', '799', '899']

  return (
    <div className="planet-directory">
      <div className="directory-header">
        <h3>Solar System</h3>
        <small>Click to explore • Focus to follow</small>
      </div>
      
      <div className="planet-list">
        {orderedPlanets.map(planetId => {
          const planet = PLANET_DATABASE[planetId]
          if (!planet) return null
          
          const isSelected = selectedPlanet === planetId
          const isExpanded = expandedPlanet === planetId
          
          return (
            <div
              key={planetId}
              ref={el => (itemRefs.current[planetId] = el)}
              className={`planet-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
              <div className="planet-header" onClick={() => handlePlanetClick(planetId)}>
                <div 
                  className="planet-icon"
                  style={{ backgroundColor: planet.color }}
                >
                  {planet.type === 'star' ? '☀️' : '🪐'}
                </div>
                <div className="planet-title">
                  <div className="name-row">
                    <strong>{planet.name}</strong>
                    {isSelected && <span className="eye">👁️</span>}
                  </div>
                  <small className="sub">{planet.type.toUpperCase()}</small>
                </div>
                <div className="metrics">
                  <div className="metric"><small>Diameter</small><div>{planet.diameter}</div></div>
                  <div className="metric"><small>Distance</small><div>{planet.distance}</div></div>
                </div>
              </div>

              {isExpanded && (
                <div className="planet-details">
                  <p className="description">{planet.description}</p>
                  <div className="facts">
                    <strong>Fast facts</strong>
                    <ul>
                      {planet.facts.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                  
                  <div className="stats-grid">
                    {Object.entries(planet.stats).map(([k, v]) => (
                      <div key={k} className="stat"><small>{k}</small><div>{v}</div></div>
                    ))}
                  </div>

                  <div className="action-buttons">
                    <button 
                      className="btn focus-camera-btn"
                      onClick={(e) => handleFocusClick(planetId, e)}
                    >
                      🎯 Focus Camera
                    </button>
                    <button 
                      className="btn secondary-btn"
                      onClick={(e) => handleLearnMore(planetId, e)}
                    >
                      📚 Learn More
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
