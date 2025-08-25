import React, { useEffect, useState } from 'react'
import { getEphem } from './lib/api'
import type { EphemSet } from './lib/api'
import type { ViewSettings, ClickInfo } from './types'
import OrbitCanvas from './components/OrbitCanvas'
import InfoDrawer from './components/InfoDrawer'
import FloatingControls from './components/FloatingControls'
import SettingsMenu from './components/SettingsMenu'
import PlanetDirectory from './components/PlanetDirectory'
import ErrorBoundary from './components/ErrorBoundary'
import SolarSystemDataManager, { type SolarSystemData } from './components/SolarSystemDataManager'
import CelestialObjectCatalog from './components/CelestialObjectCatalog'
import './styles.css'

export default function App() {
  const [sets, setSets] = useState<EphemSet[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(new Date())
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [selectedInfo, setSelectedInfo] = useState<{id: string, label: string, kind: 'star' | 'planet', extra?: any} | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [timeRange, setTimeRange] = useState('30days')
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null)
  const [showFloatingControls, setShowFloatingControls] = useState(true)

  // New state for comprehensive solar system data
  const [solarSystemData, setSolarSystemData] = useState<SolarSystemData | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [selectedCatalogObject, setSelectedCatalogObject] = useState<any>(null)

  const [settings, setSettings] = useState<ViewSettings>({
    useRealisticScale: false,
    useRealisticSizes: false,
    showOrbits: true,
    followPlanet: null
  })

  // Enhanced error handling with retry logic
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<string>()

  // Load ephemeris data with retry logic
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(undefined)
        setLastError(undefined)
        
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
        
        // Update state dates
        setStartDate(now)
        setEndDate(futureDate)
        setCurrentDate(now)
        
        // Get step size based on range
        const stepSize = timeRange === '7days' ? '4 h' : 
                        timeRange === '10days' ? '6 h' :
                        timeRange === '30days' ? '12 h' :
                        timeRange === '90days' ? '1 d' : '3 d'
        
        console.log(`🔄 Loading ephemeris data: ${start} to ${stop}, step: ${stepSize}`)
        
        // Include all major planets and moons for comprehensive simulation
        const planetIds = ['10', '199', '299', '399', '499', '599', '699', '799', '899', '999']
        const result = await getEphem(planetIds, start, stop, stepSize, '500@0', true)
        
        if (!result || result.length === 0) {
          throw new Error('No ephemeris data received from API')
        }
        
        console.log('✅ Loaded ephemeris sets:', result)
        setSets(result)
        setRetryCount(0) // Reset retry count on success
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('❌ Failed to load ephemeris data:', err)
        
        setLastError(errorMessage)
        
        // Implement retry logic
        if (retryCount < 3) {
          console.log(`🔄 Retrying in 5 seconds... (attempt ${retryCount + 1}/3)`)
          setRetryCount(prev => prev + 1)
          setError(`Failed to load data: ${errorMessage}. Retrying...`)
          
          // Retry after 5 seconds
          setTimeout(() => {
            setError(undefined)
          }, 5000)
        } else {
          setError(`Failed to load data after 3 attempts: ${errorMessage}`)
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [timeRange, retryCount])

  // Calculate time step based on animation speed and time range
  const getTimeStep = () => {
    const baseStep = timeRange === '7days' ? 4 * 60 * 60 * 1000 : // 4 hours
                    timeRange === '10days' ? 6 * 60 * 60 * 1000 : // 6 hours
                    timeRange === '30days' ? 12 * 60 * 60 * 1000 : // 12 hours
                    timeRange === '90days' ? 24 * 60 * 60 * 1000 : // 1 day
                    3 * 24 * 60 * 60 * 1000 // 3 days
    
    return baseStep * animationSpeed
  }

  // Enhanced animation loop with better performance
  useEffect(() => {
    if (!playing || !sets.length) return
    
    let animationFrameId: number
    let lastTime = Date.now()
    
    const animate = () => {
      const currentTime = Date.now()
      const deltaTime = currentTime - lastTime
      
      // Only update if enough time has passed (cap at 60 FPS)
      if (deltaTime >= 16) { // ~60 FPS
        setCurrentDate(prevDate => {
          const newDate = new Date(prevDate)
          const timeStep = getTimeStep()
          newDate.setTime(prevDate.getTime() + timeStep)
          
          // Loop back to start date if we exceed end date
          if (newDate > endDate) {
            return new Date(startDate)
          }
          
          return newDate
        })
        
        lastTime = currentTime
      }
      
      animationFrameId = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [playing, sets.length, startDate, endDate, getTimeStep])

  const handlePick = (info: ClickInfo) => {
    const convertedInfo = {
      id: info.id,
      label: info.label,
      kind: info.kind === 'star' ? 'star' as const : 'planet' as const,
      extra: {}
    }
    setSelectedInfo(convertedInfo)
    setSelectedPlanet(info.id)
  }

  const handlePlanetSelect = (planetId: string) => {
    setSelectedPlanet(planetId)
    setSettings(prev => ({ ...prev, followPlanet: planetId }))
  }

  const handleSolarSystemDataUpdate = (data: SolarSystemData) => {
    setSolarSystemData(data)
    console.log('🌌 Solar system data updated:', data)
  }

  const handleCatalogObjectSelect = (object: any, type: string) => {
    setSelectedCatalogObject({ object, type })
    setShowCatalog(false)
    
    const info = {
      id: object.id || object.des || 'unknown',
      label: object.full_name || object.name || 'Unknown Object',
      kind: 'planet' as const,
      extra: { 
        type,
        object,
        source: 'NASA API'
      }
    }
    setSelectedInfo(info)
  }

  return (
    <ErrorBoundary>
      <div id="app">
        {/* Minimal Header */}
        <div className="minimal-header">
          <div className="header-left">
            <h1>🌌 Solar System</h1>
          </div>
          
          <div className="header-center">
            <div className="date-display">
              <span className="current-date">
                {currentDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              <span className="date-range">
                {startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })} - {endDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>

          <div className="header-right">
            <button 
              className="icon-btn catalog-btn" 
              onClick={() => setShowCatalog(true)}
              title="Celestial Object Catalog"
            >
              📚
            </button>
            <button 
              className="icon-btn settings-btn" 
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="canvas-wrap">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-content">
                <div className="spinner" />
                <div>Loading solar system data...</div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-overlay">
              <div className="error-content">
                <h3>Error</h3>
                <p>{error}</p>
                <button 
                  className="btn" 
                  onClick={() => window.location.reload()}
                >
                  Reload
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              <OrbitCanvas
                sets={sets}
                currentDate={currentDate}
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

              {/* Floating Controls */}
              {showFloatingControls && (
                <FloatingControls
                  playing={playing}
                  onPlayPause={() => setPlaying(!playing)}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                  animationSpeed={animationSpeed}
                  onSpeedChange={setAnimationSpeed}
                  currentDate={currentDate}
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={setCurrentDate}
                  onToggle={() => setShowFloatingControls(false)}
                />
              )}

              {/* Floating Data Manager */}
              <SolarSystemDataManager
                onDataUpdate={handleSolarSystemDataUpdate}
                onError={setError}
                autoRefresh={true}
                refreshInterval={300000}
              />

              {/* Floating Toggle Button */}
              {!showFloatingControls && (
                <button
                  className="floating-toggle-btn"
                  onClick={() => setShowFloatingControls(true)}
                  title="Show Controls"
                >
                  ⚡
                </button>
              )}
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

        {/* Celestial Object Catalog */}
        {showCatalog && solarSystemData && (
          <CelestialObjectCatalog
            data={solarSystemData}
            onSelectObject={handleCatalogObjectSelect}
            isOpen={showCatalog}
            onClose={() => setShowCatalog(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}