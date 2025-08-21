import React, { useEffect, useMemo, useRef, useState } from 'react'
import OrbitCanvas from './components/OrbitCanvas'
import InfoDrawer, { Info } from './components/InfoDrawer'
import SettingsMenu from './components/SettingsMenu'
import PlanetDirectory from './components/PlanetDirectory'
import { getEphem, EphemSet } from './lib/api'
import type { ViewSettings } from './types'

// Enhanced planet information for InfoDrawer
const DETAILED_INFO: Record<string, any> = {
  '10': {
    details: 'The Sun is a G-type main-sequence star that formed approximately 4.6 billion years ago. It generates energy through nuclear fusion in its core, converting hydrogen into helium.',
    stats: { mass: '1.989 × 10³⁰ kg', volume: '1.412 × 10²⁷ m³', surfaceGravity: '274 m/s²' }
  },
  '199': {
    details: 'Mercury has no substantial atmosphere and experiences extreme temperature variations. Its heavily cratered surface resembles our Moon.',
    stats: { mass: '3.301 × 10²³ kg', gravity: '3.7 m/s²', dayLength: '58.6 Earth days' }
  },
  '299': {
    details: 'Venus is the hottest planet in our solar system due to its thick, toxic atmosphere made mostly of carbon dioxide.',
    stats: { mass: '4.867 × 10²⁴ kg', gravity: '8.87 m/s²', dayLength: '243 Earth days' }
  },
  '399': {
    details: 'Earth is the third planet from the Sun and the only astronomical object known to harbor life. Its surface is 71% water.',
    stats: { mass: '5.972 × 10²⁴ kg', gravity: '9.8 m/s²', dayLength: '24 hours' }
  },
  '499': {
    details: 'Mars has seasons, polar ice caps, weather, volcanoes and canyons. It may have had liquid water on its surface in the past.',
    stats: { mass: '6.39 × 10²³ kg', gravity: '3.71 m/s²', dayLength: '24h 37m' }
  },
  '599': {
    details: 'Jupiter is the largest planet in our solar system. It\'s a gas giant with a Great Red Spot storm and over 90 known moons.',
    stats: { mass: '1.898 × 10²⁷ kg', gravity: '24.79 m/s²', dayLength: '9h 56m' }
  },
  '699': {
    details: 'Saturn is famous for its prominent ring system. It\'s a gas giant with the lowest density of any planet in our solar system.',
    stats: { mass: '5.683 × 10²⁶ kg', gravity: '10.44 m/s²', dayLength: '10h 33m' }
  },
  '799': {
    details: 'Uranus is an ice giant that rotates on its side. It has a faint ring system and is composed mostly of water, methane, and ammonia ices.',
    stats: { mass: '8.681 × 10²⁵ kg', gravity: '8.69 m/s²', dayLength: '17h 14m' }
  },
  '899': {
    details: 'Neptune is the outermost planet in our solar system. It\'s an ice giant with the strongest winds in the solar system.',
    stats: { mass: '1.024 × 10²⁶ kg', gravity: '11.15 m/s²', dayLength: '16h 7m' }
  }
}

export default function App() {
  const [sets, setSets] = useState<EphemSet[]>([])
  const [loading, setLoading] = useState(false)
  const [idx, setIdx] = useState(0)
  const [maxIdx, setMaxIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [info, setInfo] = useState<Info | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showDirectory, setShowDirectory] = useState(true)
  const [settings, setSettings] = useState<ViewSettings>({
    useRealisticScale: false,
    useRealisticSizes: false,
    showOrbits: true,
    followPlanet: null
  })
  const timer = useRef<number | null>(null)

  const range = useMemo(() => {
    // default: a 10-day window from today
    const start = new Date()
    const stop = new Date(Date.now() + 10 * 24 * 3600 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD
    return { start: fmt(start), stop: fmt(stop), step: '6 h' }
  }, [])

  useEffect(() => {
    setLoading(true)
    // Load all major planets by default: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
    const allPlanetIds = ['199', '299', '399', '499', '599', '699', '799', '899']
    getEphem(allPlanetIds, range.start, range.stop, range.step, '500@0')
      .then(data => {
        setSets(data)
        const samples = Math.max(...data.map(d => d.states.length))
        setMaxIdx(Math.max(0, samples - 1))
      })
      .catch(err => {
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [range.start, range.stop, range.step])

  useEffect(() => {
    if (!playing) { 
      if (timer.current) cancelAnimationFrame(timer.current)
      return 
    }
    const tick = () => {
      setIdx(i => (i + 0.25) % (maxIdx > 0 ? maxIdx : 1))
      timer.current = requestAnimationFrame(tick)
    }
    timer.current = requestAnimationFrame(tick)
    return () => { 
      if (timer.current) cancelAnimationFrame(timer.current) 
    }
  }, [playing, maxIdx])

  const onPick = (tag: { id: string; label: string; kind: Info['kind'] }) => {
    // Show info drawer with enhanced information
    const detailedInfo = DETAILED_INFO[tag.id] || {}
    setInfo({ 
      id: tag.id, 
      label: tag.label, 
      kind: tag.kind, 
      extra: { 
        source: 'Horizons',
        clickedAt: new Date().toLocaleTimeString(),
        details: detailedInfo.details,
        stats: detailedInfo.stats
      }
    })
    
    // Focus camera on the clicked object
    if (tag.kind === 'planet' || tag.kind === 'star') {
      setSettings(prev => ({
        ...prev,
        followPlanet: tag.id
      }))
    }
  }

  const handleDirectorySelect = (planetId: string) => {
    // Focus camera and show info for directory selection
    setSettings(prev => ({
      ...prev,
      followPlanet: planetId
    }))
    
    // Also show info drawer with detailed information
    const planetNames: Record<string, string> = {
      '10': 'Sun', '199': 'Mercury', '299': 'Venus', '399': 'Earth', 
      '499': 'Mars', '599': 'Jupiter', '699': 'Saturn', '799': 'Uranus', '899': 'Neptune'
    }
    
    const detailedInfo = DETAILED_INFO[planetId] || {}
    setInfo({
      id: planetId,
      label: planetNames[planetId] || planetId,
      kind: planetId === '10' ? 'star' : 'planet',
      extra: {
        source: 'Directory',
        selectedAt: new Date().toLocaleTimeString(),
        details: detailedInfo.details,
        stats: detailedInfo.stats
      }
    })
  }

  return (
    <div id="app">
      <div className="header">
        <h1>Solar System Viewer</h1>
        <div className="controls">
          <button className="btn" onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <input 
            className="range" 
            type="range" 
            min={0} 
            max={maxIdx || 0} 
            step={0.01} 
            value={idx} 
            onChange={e => setIdx(parseFloat(e.target.value))}
          />
          <span style={{ opacity: .7 }}>frame {idx.toFixed(0)} / {maxIdx}</span>
          {loading && <span className="spinner" />}
        </div>
        <div className="header-buttons">
          <button className="btn" onClick={() => setSettings(prev => ({ ...prev, followPlanet: null }))}>
            🎯 Free Camera
          </button>
          <button className="btn" onClick={() => setShowDirectory(!showDirectory)}>
            📂 {showDirectory ? 'Hide' : 'Show'} Directory
          </button>
          <button className="btn" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </div>
      </div>
      
      <div className="canvas-wrap">
        <div className="legend">
          <div><strong>Solar System Viewer</strong></div>
          <div>• Drag to orbit • Scroll to zoom</div>
          <div>• Click objects to focus & inspect</div>
          <div>• Use directory panel to explore</div>
          {settings.useRealisticScale && (
            <div style={{ color: '#ffaa00', marginTop: 4 }}>
              • Realistic scale active
            </div>
          )}
        </div>
        
        <OrbitCanvas 
          sets={sets} 
          frameIndex={idx} 
          onPick={onPick}
          settings={settings}
        />
        
        {showDirectory && (
          <PlanetDirectory 
            onSelectPlanet={handleDirectorySelect}
            selectedPlanet={settings.followPlanet}
            settings={settings}
          />
        )}
        
        <InfoDrawer info={info} onClose={() => setInfo(null)} />
        
        <SettingsMenu 
          settings={settings}
          onSettingsChange={setSettings}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </div>
    </div>
  )
}