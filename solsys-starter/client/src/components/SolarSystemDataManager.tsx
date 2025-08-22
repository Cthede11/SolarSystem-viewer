import React, { useEffect, useState, useCallback } from 'react'
import { 
  listNEO, 
  listComets, 
  listAsteroids,
  getSpaceWeather,
  getAsteroidWatch,
  getSatellites,
  type AsteroidData,
  type CometData,
  type SpaceWeatherEvent
} from '../lib/api'

export interface SolarSystemData {
  planets: any[]
  moons: any[]
  neos: AsteroidData[]
  comets: CometData[]
  asteroids: any[]
  solarFlares: SpaceWeatherEvent[]
  coronalMassEjections: any[]
  solarEnergeticParticles: any[]
  geomagneticStorms: any[]
  satellites: Record<string, any>
  exoplanets: any[]
  marsRoverPhotos: any[]
  lastUpdated: Date
  dataSources: string[]
}

interface SolarSystemDataManagerProps {
  onDataUpdate: (data: SolarSystemData) => void
  onError: (error: string) => void
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function SolarSystemDataManager({ 
  onDataUpdate, 
  onError, 
  autoRefresh = true, 
  refreshInterval = 300000
}: SolarSystemDataManagerProps) {
  const [data, setData] = useState<SolarSystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 Fetching comprehensive solar system data...')
      
      const [
        neos,
        comets, 
        asteroids,
        spaceWeather,
        asteroidWatch,
        satellites
      ] = await Promise.allSettled([
        listNEO(100),
        listComets(50),
        listAsteroids(100),
        getSpaceWeather(),
        getAsteroidWatch(),
        getSatellites()
      ])

      const combinedData: SolarSystemData = {
        planets: [],
        moons: [],
        neos: neos.status === 'fulfilled' ? neos.value.data || [] : [],
        comets: comets.status === 'fulfilled' ? comets.value.data || [] : [],
        asteroids: asteroids.status === 'fulfilled' ? asteroids.value.data || [] : [],
        solarFlares: spaceWeather.status === 'fulfilled' ? spaceWeather.value.flr || [] : [],
        coronalMassEjections: spaceWeather.status === 'fulfilled' ? spaceWeather.value.cme || [] : [],
        solarEnergeticParticles: spaceWeather.status === 'fulfilled' ? spaceWeather.value.sep || [] : [],
        geomagneticStorms: spaceWeather.status === 'fulfilled' ? spaceWeather.value.gst || [] : [],
        satellites: satellites.status === 'fulfilled' ? satellites.value : {},
        exoplanets: [],
        marsRoverPhotos: [],
        lastUpdated: new Date(),
        dataSources: [
          'JPL Horizons',
          'JPL Small Body Database',
          'NASA Space Weather',
          'NASA Asteroid Watch',
          'NASA APOD',
          'NASA Exoplanet Archive',
          'NASA Mars Rover Photos'
        ]
      }

      if (asteroidWatch.status === 'fulfilled' && asteroidWatch.value) {
        const aw = asteroidWatch.value
        if (aw.near_earth_objects) {
          const allNeos = Object.values(aw.near_earth_objects).flat()
          combinedData.neos = [...combinedData.neos, ...allNeos]
        }
      }

      console.log('✅ Solar system data loaded:', {
        neos: combinedData.neos.length,
        comets: combinedData.comets.length,
        asteroids: combinedData.asteroids.length,
        solarFlares: combinedData.solarFlares.length,
        satellites: Object.keys(combinedData.satellites).length
      })

      setData(combinedData)
      onDataUpdate(combinedData)
      setLastRefresh(new Date())
      
    } catch (error) {
      console.error('❌ Failed to fetch solar system data:', error)
      onError(`Failed to load data: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [onDataUpdate, onError])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(fetchAllData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchAllData])

  const handleManualRefresh = () => {
    fetchAllData()
  }

  if (loading && !data) {
    return (
      <div className="floating-data-manager loading">
        <div className="spinner" />
        <div>Loading data...</div>
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="floating-data-manager collapsed">
        <button
          className="expand-btn"
          onClick={() => setIsCollapsed(false)}
          title="Expand Data Manager"
        >
          📊
        </button>
      </div>
    )
  }

  return (
    <div className="floating-data-manager">
      <div className="data-header">
        <span>📊 Data Manager</span>
        <div className="data-actions">
          <button
            className="icon-btn"
            onClick={() => setIsCollapsed(true)}
            title="Collapse"
          >
            ◀
          </button>
          <button
            className="icon-btn"
            onClick={handleManualRefresh}
            title="Refresh Data"
          >
            🔄
          </button>
        </div>
      </div>

      {data && (
        <div className="data-content">
          <div className="data-summary">
            <div className="summary-item">
              <span className="summary-label">NEOs:</span>
              <span className="summary-value">{data.neos.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Comets:</span>
              <span className="summary-value">{data.comets.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Asteroids:</span>
              <span className="summary-value">{data.asteroids.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Solar Flares:</span>
              <span className="summary-value">{data.solarFlares.length}</span>
            </div>
          </div>

          <div className="data-status">
            <div className="status-item">
              <span className="status-label">Last Updated:</span>
              <span className="status-value">{lastRefresh?.toLocaleTimeString()}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Auto-refresh:</span>
              <span className="status-value">{autoRefresh ? '✅ On' : '❌ Off'}</span>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="data-error">
          <span>❌ No data available</span>
        </div>
      )}
    </div>
  )
}
