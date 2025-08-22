import React, { useEffect, useState } from 'react'
import { getEphem } from './lib/api'
import type { EphemSet } from './lib/api'
import type { ViewSettings, ClickInfo } from './types'
import OrbitCanvas from './components/OrbitCanvas'
import InfoDrawer from './components/InfoDrawer'
import TimeControls from './components/TimeControls'
import SettingsMenu from './components/SettingsMenu'
import PlanetDirectory from './components/PlanetDirectory'
import ErrorBoundary from './components/ErrorBoundary'
import DebugViewer from './components/DebugViewer' // Import the debug component
import './styles.css'

export default function App() {
  // Debug mode toggle
  const [debugMode, setDebugMode] = useState(false)
  const [frameDebugMode, setFrameDebugMode] = useState(false)
  const [visibilityTestMode, setVisibilityTestMode] = useState(false)
  
  const [sets, setSets] = useState<EphemSet[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [maxFrames, setMaxFrames] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [selectedInfo, setSelectedInfo] = useState<{id: string, label: string, kind: 'star' | 'planet', extra?: any} | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [timeRange, setTimeRange] = useState('30days')
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null)

  const [settings, setSettings] = useState<ViewSettings>({
    useRealisticScale: false,
    useRealisticSizes: false,
    showOrbits: true,
    followPlanet: null
  })

  // Load ephemeris data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(undefined)
        
        const now = new Date()
        const start = now.toISOString().split('T')[0]
        const futureDate = new Date(now)
        
        // Set date range based on timeRange
        switch (timeRange) {
          case '7days':
            futureDate.setDate(now.getDate() + 7)
            break
          case '10days':
            futureDate.setDate(now.getDate() + 10)
            break
          case '30days':
            futureDate.setDate(now.getDate() + 30)
            break
          case '90days':
            futureDate.setDate(now.getDate() + 90)
            break
          case '365days':
            futureDate.setFullYear(now.getFullYear() + 1)
            break
          default:
            futureDate.setDate(now.getDate() + 30)
        }
        
        const stop = futureDate.toISOString().split('T')[0]
        
        // Get step size based on range
        const stepSize = timeRange === '7days' ? '4 h' : 
                        timeRange === '10days' ? '6 h' :
                        timeRange === '30days' ? '12 h' :
                        timeRange === '90days' ? '1 d' : '3 d'
        
        console.log(`Loading ephemeris data: ${start} to ${stop}, step: ${stepSize}`)
        
        const result = await getEphem(['10', '199', '299', '399', '499'], start, stop, stepSize)
        
        console.log('Loaded ephemeris sets:', result)
        setSets(result)
        
        const maxLen = Math.max(...result.map(s => s.states?.length || 0))
        setMaxFrames(maxLen - 1)
        setFrameIndex(0)
        
      } catch (err) {
        console.error('Failed to load ephemeris data:', err)
        setError(`Failed to load data: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [timeRange])

  // Animation loop
  useEffect(() => {
    if (!playing || maxFrames === 0) return
    
    const interval = setInterval(() => {
      setFrameIndex(prev => {
        const next = prev + (0.5 * animationSpeed)
        return next >= maxFrames ? 0 : next
      })
    }, 50)
    
    return () => clearInterval(interval)
  }, [playing, maxFrames, animationSpeed])

  const getCurrentDate = () => {
    if (!sets.length || !sets[0].states?.length) return new Date().toISOString()
    const currentFrame = Math.floor(frameIndex)
    const state = sets[0].states[currentFrame]
    return state?.t || new Date().toISOString()
  }

  const handlePick = (info: ClickInfo) => {
    // Convert ClickInfo to Info type for InfoDrawer
    const convertedInfo = {
      id: info.id,
      label: info.label,
      kind: info.kind === 'star' ? 'star' as const : 'planet' as const, // Only allow star or planet
      extra: {}
    }
    setSelectedInfo(convertedInfo)
    setSelectedPlanet(info.id)
  }

  const handlePlanetSelect = (planetId: string) => {
    setSelectedPlanet(planetId)
    // Update settings to follow the selected planet
    setSettings(prev => ({ ...prev, followPlanet: planetId }))
  }


  // If in debug mode, show only the debug viewer
  if (debugMode) {
    return (
      <ErrorBoundary>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDebugMode(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 2000,
              padding: '10px 15px',
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Exit Debug Mode
          </button>
          <DebugViewer />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div id="app">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <h1>🌌 Solar System Viewer</h1>
          </div>
          
          {/* Time Controls in Header */}
          {!loading && !error && (
            <div className="header-center">
              <div className="controls">
                {/* Play/Pause */}
                <button
                  className="btn"
                  onClick={() => setPlaying(!playing)}
                  style={{ 
                    padding: '6px 12px',
                    fontSize: '13px',
                    minWidth: '70px',
                    background: playing ? '#ff6b6b' : '#4ecdc4'
                  }}
                >
                  {playing ? '⏸️ Pause' : '▶️ Play'}
                </button>

                {/* Time Range Selector */}
                <select
                  className="btn"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  style={{ 
                    background: '#1b263b',
                    color: 'var(--fg)',
                    minWidth: '90px',
                    fontSize: '12px'
                  }}
                >
                  <option value="7days">7 Days</option>
                  <option value="10days">10 Days</option>
                  <option value="30days">30 Days</option>
                  <option value="90days">90 Days</option>
                  <option value="365days">1 Year</option>
                </select>

                {/* Speed Control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Speed:</span>
                  <select
                    className="btn"
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                    style={{ 
                      background: '#1b263b',
                      color: 'var(--fg)',
                      fontSize: '11px',
                      padding: '4px 6px',
                      minWidth: '55px'
                    }}
                  >
                    <option value={0.1}>0.1×</option>
                    <option value={0.25}>0.25×</option>
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                    <option value={4}>4×</option>
                    <option value={8}>8×</option>
                  </select>
                </div>

                {/* Frame Info */}
                <div style={{ 
                  fontSize: '11px', 
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: '8px'
                }}>
                  <span>Frame: {Math.round(frameIndex)}/{maxFrames}</span>
                  <span>•</span>
                  <span>{new Date(getCurrentDate()).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}</span>
                </div>
              </div>
            </div>
          )}

          <div className="header-buttons">
            <button 
              className="btn" 
              onClick={() => setVisibilityTestMode(true)}
              style={{ background: '#00cc44', color: 'white' }}
            >
              🔍 Visibility Test
            </button>
            <button 
              className="btn" 
              onClick={() => setFrameDebugMode(true)}
              style={{ background: '#ff9900', color: 'white' }}
            >
              🔧 Frame Debug
            </button>
            <button 
              className="btn" 
              onClick={() => setDebugMode(true)}
              style={{ background: '#ff6b00', color: 'white' }}
            >
              🐛 Debug Mode
            </button>
            <button 
              className="btn" 
              onClick={() => setShowSettings(true)}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="canvas-wrap">
          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--panel)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              zIndex: 100,
              textAlign: 'center'
            }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              <div>Loading solar system data...</div>
            </div>
          )}

          {error && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#ff4444',
              color: 'white',
              padding: '20px',
              borderRadius: '12px',
              zIndex: 100,
              textAlign: 'center',
              maxWidth: '400px'
            }}>
              <h3>Error</h3>
              <p>{error}</p>
              <button 
                className="btn" 
                onClick={() => window.location.reload()}
                style={{ background: 'white', color: '#ff4444' }}
              >
                Reload
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <OrbitCanvas
                sets={sets}
                frameIndex={frameIndex}
                onPick={handlePick}
                settings={settings}
              />
              
              <InfoDrawer
                info={selectedInfo}
                onClose={() => setSelectedInfo(null)}
              />
              
              <PlanetDirectory
                onSelectPlanet={handlePlanetSelect}
                selectedPlanet={selectedPlanet}
                settings={settings}
              />
              
              {/* Timeline Slider at Bottom */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '8px 16px',
                zIndex: 60,
                minWidth: '400px',
                maxWidth: '90vw'
              }}>
                <div style={{ marginBottom: '4px', fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
                  Timeline Scrubber
                </div>
                <input
                  type="range"
                  className="range"
                  min={0}
                  max={maxFrames || 0}
                  step={0.1}
                  value={frameIndex}
                  onChange={(e) => setFrameIndex(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <SettingsMenu
            settings={settings}
            onSettingsChange={setSettings}
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}