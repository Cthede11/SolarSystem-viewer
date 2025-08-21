import React, { useState } from 'react'
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
      'No atmosphere or moons',
      'Day temp: 427°C, Night: -173°C',
      'Orbital period: 88 Earth days'
    ],
    stats: { 
      mass: '3.301 × 10²³ kg', 
      gravity: '3.7 m/s²', 
      dayLength: '58.6 Earth days',
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
    description: 'Earth is our home planet and the only known planet with life. It has liquid water, a protective atmosphere, and a suitable temperature range.',
    facts: [
      'Only known planet with life',
      '71% of surface is water',
      'One natural satellite (Moon)',
      'Atmosphere: 78% nitrogen, 21% oxygen'
    ],
    stats: { 
      mass: '5.972 × 10²⁴ kg', 
      gravity: '9.8 m/s²', 
      dayLength: '24 hours',
      orbitalPeriod: '365.25 days'
    },
    color: '#6ec6ff'
  },
  '499': {
    id: '499',
    name: 'Mars',
    type: 'planet',
    diameter: '6,792 km',
    distance: '228M km from Sun',
    description: 'Mars is the fourth planet from the Sun, known as the "Red Planet" due to iron oxide on its surface. It has polar ice caps and the largest volcano in the solar system.',
    facts: [
      'Iron oxide gives red appearance',
      'Largest volcano: Olympus Mons (21km high)',
      'Two small moons: Phobos and Deimos',
      'Day length similar to Earth: 24h 37m'
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
    diameter: '142,984 km',
    distance: '778M km from Sun',
    description: 'Jupiter is the largest planet in our solar system. It\'s a gas giant with a Great Red Spot storm and over 90 known moons.',
    facts: [
      'Largest planet in the solar system',
      'Great Red Spot: storm bigger than Earth',
      'Over 90 moons, including 4 large ones',
      'Mostly hydrogen and helium'
    ],
    stats: { 
      mass: '1.898 × 10²⁷ kg', 
      gravity: '24.79 m/s²', 
      dayLength: '9h 56m',
      orbitalPeriod: '12 years'
    },
    color: '#d8ca9d'
  },
  '699': {
    id: '699',
    name: 'Saturn',
    type: 'planet',
    diameter: '120,536 km',
    distance: '1.4B km from Sun',
    description: 'Saturn is famous for its prominent ring system. It\'s a gas giant with the lowest density of any planet in our solar system.',
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
    description: 'Uranus is an ice giant that rotates on its side. It has a faint ring system and is composed mostly of water, methane, and ammonia ices.',
    facts: [
      'Rotates on its side (98° tilt)',
      'Coldest planetary atmosphere: -224°C',
      'Faint ring system discovered in 1977',
      'Methane gives blue-green color'
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
    description: 'Neptune is the outermost planet in our solar system. It\'s an ice giant with the strongest winds in the solar system, reaching speeds of up to 2,100 km/h.',
    facts: [
      'Strongest winds: up to 2,100 km/h',
      'Deep blue color from methane',
      'Largest moon: Triton (orbits backwards)',
      'Takes 165 Earth years to orbit Sun'
    ],
    stats: { 
      mass: '1.024 × 10²⁶ kg', 
      gravity: '11.15 m/s²', 
      dayLength: '16h 7m',
      orbitalPeriod: '165 years'
    },
    color: '#4b70dd'
  }
}

export default function PlanetDirectory({ onSelectPlanet, selectedPlanet, settings }: PlanetDirectoryProps) {
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null)

  const handlePlanetClick = (planetId: string) => {
    if (expandedPlanet === planetId) {
      // If already expanded, collapse
      setExpandedPlanet(null)
    } else {
      // Expand to show details
      setExpandedPlanet(planetId)
    }
  }

  const handleFocusClick = (planetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectPlanet(planetId)
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
            <div key={planetId} className={`planet-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
              <div className="planet-header" onClick={() => handlePlanetClick(planetId)}>
                <div 
                  className="planet-icon"
                  style={{ backgroundColor: planet.color }}
                >
                  {planet.type === 'star' ? '☀️' : '🪐'}
                </div>
                <div className="planet-basic-info">
                  <div className="planet-name">{planet.name}</div>
                  <div className="planet-type">{planet.type}</div>
                </div>
                <div className="planet-actions">
                  {isSelected && <span className="following-indicator">👁️</span>}
                  <button 
                    className="focus-btn"
                    onClick={(e) => handleFocusClick(planetId, e)}
                    title="Focus camera on this object"
                  >
                    🎯
                  </button>
                </div>
              </div>
              
              {isExpanded && (
                <div className="planet-details">
                  <div className="planet-stats-grid">
                    <div className="stat">
                      <span className="stat-label">Diameter:</span>
                      <span className="stat-value">{planet.diameter}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Distance:</span>
                      <span className="stat-value">{planet.distance}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Horizons ID:</span>
                      <span className="stat-value">{planet.id}</span>
                    </div>
                  </div>
                  
                  <p className="planet-description">{planet.description}</p>
                  
                  <div className="detailed-stats">
                    <h4>Physical Properties:</h4>
                    <div className="stats-grid">
                      {Object.entries(planet.stats).map(([key, value]) => (
                        <div key={key} className="detailed-stat">
                          <span className="stat-key">{key}:</span>
                          <span className="stat-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="planet-facts">
                    <h4>Key Facts:</h4>
                    <ul>
                      {planet.facts.map((fact, index) => (
                        <li key={index}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="action-buttons">
                    <button 
                      className="btn focus-camera-btn"
                      onClick={(e) => handleFocusClick(planetId, e)}
                    >
                      🎯 Focus Camera
                    </button>
                    <button className="btn secondary-btn">
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