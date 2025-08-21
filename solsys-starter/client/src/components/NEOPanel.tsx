import React, { useState, useEffect } from 'react'
import { listNEO, getSBDBObject } from '../lib/api'

interface NEOData {
  count: number
  data: Array<{
    full_name: string
    des: string
    orbit_class: string
    albedo?: number
    diameter?: number
    H?: number
    moid_au?: number
    pha?: string
  }>
}

interface NEOPanelProps {
  onSelectNEO: (neo: any) => void
  visible: boolean
  onToggle: () => void
}

export default function NEOPanel({ onSelectNEO, visible, onToggle }: NEOPanelProps) {
  const [neoData, setNeoData] = useState<NEOData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedNEO, setSelectedNEO] = useState<string | null>(null)
  const [neoDetails, setNeoDetails] = useState<any>(null)

  useEffect(() => {
    if (visible && !neoData) {
      setLoading(true)
      listNEO(50)
        .then(data => setNeoData(data))
        .catch(err => console.error('Failed to fetch NEO data:', err))
        .finally(() => setLoading(false))
    }
  }, [visible, neoData])

  const handleNEOClick = async (neo: any) => {
    setSelectedNEO(neo.des)
    try {
      const details = await getSBDBObject(neo.des)
      setNeoDetails(details)
      onSelectNEO({ ...neo, details })
    } catch (err) {
      console.error('Failed to fetch NEO details:', err)
    }
  }

  const formatDistance = (au: number | undefined) => {
    if (!au) return 'Unknown'
    const km = au * 149597870.7 // AU to km
    if (km < 1000000) {
      return `${Math.round(km).toLocaleString()} km`
    } else {
      return `${(km / 149597870.7).toFixed(3)} AU`
    }
  }

  const isPHA = (pha: string | undefined) => pha === 'Y'

  if (!visible) {
    return (
      <button 
        className="btn neo-toggle"
        onClick={onToggle}
        style={{
          position: 'absolute',
          left: '12px',
          bottom: '12px',
          zIndex: 50
        }}
      >
        Show NEOs
      </button>
    )
  }

  return (
    <div className="neo-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4>Near-Earth Objects</h4>
        <button className="btn" onClick={onToggle} style={{ padding: '2px 6px', fontSize: '11px' }}>
          ×
        </button>
      </div>
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <span className="spinner" />
          <div style={{ marginTop: '8px', fontSize: '12px' }}>Loading NEOs...</div>
        </div>
      )}

      {neoData && !loading && (
        <>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
            Found {neoData.count} Near-Earth Objects
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {neoData.data.map((neo, index) => (
              <div 
                key={neo.des || index}
                className="neo-item"
                onClick={() => handleNEOClick(neo)}
                style={{
                  background: selectedNEO === neo.des ? 'rgba(137, 180, 255, 0.1)' : 'transparent'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                  {neo.full_name || neo.des}
                  {isPHA(neo.pha) && (
                    <span 
                      style={{ 
                        background: '#ff4444', 
                        color: 'white', 
                        fontSize: '10px', 
                        padding: '1px 4px', 
                        borderRadius: '3px', 
                        marginLeft: '6px' 
                      }}
                    >
                      PHA
                    </span>
                  )}
                </div>
                
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Class: {neo.orbit_class || 'Unknown'}
                </div>
                
                {neo.moid_au && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Min distance: {formatDistance(neo.moid_au)}
                  </div>
                )}
                
                {neo.diameter && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Diameter: ~{neo.diameter.toFixed(1)} km
                  </div>
                )}
                
                {neo.H && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Magnitude (H): {neo.H.toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div style={{ 
            marginTop: '8px', 
            padding: '6px', 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: '4px', 
            fontSize: '10px',
            color: 'var(--muted)'
          }}>
            <strong>Legend:</strong><br />
            PHA = Potentially Hazardous Asteroid<br />
            Click any NEO for detailed information
          </div>
        </>
      )}
    </div>
  )
}