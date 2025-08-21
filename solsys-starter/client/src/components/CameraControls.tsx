import React, { useState } from 'react'

interface CameraControlsProps {
  onCameraMode: (mode: string, target?: string) => void
  onZoomToObject: (objectId: string) => void
  availableObjects: Array<{ id: string, label: string }>
  currentMode: string
  followingTarget: string | null
}

export default function CameraControls({ 
  onCameraMode, 
  onZoomToObject, 
  availableObjects, 
  currentMode,
  followingTarget 
}: CameraControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const cameraModes = [
    { id: 'free', label: 'Free Camera', icon: '🔄' },
    { id: 'solar', label: 'Solar System View', icon: '☀️' },
    { id: 'ecliptic', label: 'Ecliptic Plane', icon: '🌍' },
    { id: 'follow', label: 'Follow Object', icon: '📍' }
  ]

  const quickZoomTargets = [
    { id: '10', label: 'Sun', icon: '☀️' },
    { id: '399', label: 'Earth', icon: '🌍' },
    { id: '499', label: 'Mars', icon: '🔴' },
    { id: '599', label: 'Jupiter', icon: '🪐' }
  ]

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      right: '12px',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '8px',
      zIndex: 60,
      minWidth: '200px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <h4 style={{ margin: 0, fontSize: '14px' }}>Camera</h4>
        <button 
          className="btn"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ padding: '2px 6px', fontSize: '11px' }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {followingTarget && (
        <div style={{
          background: 'rgba(137, 180, 255, 0.1)',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          marginBottom: '8px',
          border: '1px solid rgba(137, 180, 255, 0.3)'
        }}>
          Following: {availableObjects.find(obj => obj.id === followingTarget)?.label || followingTarget}
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {cameraModes.map(mode => (
          <button
            key={mode.id}
            className="btn"
            onClick={() => onCameraMode(mode.id)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              background: currentMode === mode.id ? 'var(--accent)' : '#1b263b',
              flex: '1',
              minWidth: '70px'
            }}
            title={mode.label}
          >
            {mode.icon}
          </button>
        ))}
      </div>

      {isExpanded && (
        <>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            Quick Zoom
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
            {quickZoomTargets.map(target => (
              <button
                key={target.id}
                className="btn"
                onClick={() => onZoomToObject(target.id)}
                style={{ padding: '4px 6px', fontSize: '11px' }}
              >
                {target.icon} {target.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            All Objects
          </div>
          <select
            className="btn"
            onChange={(e) => e.target.value && onZoomToObject(e.target.value)}
            value=""
            style={{ 
              width: '100%', 
              background: '#1b263b', 
              color: 'var(--fg)',
              fontSize: '11px'
            }}
          >
            <option value="">Select object to zoom...</option>
            {availableObjects.map(obj => (
              <option key={obj.id} value={obj.id}>
                {obj.label}
              </option>
            ))}
          </select>

          <div style={{
            marginTop: '8px',
            padding: '6px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
            fontSize: '10px',
            color: 'var(--muted)'
          }}>
            <strong>Controls:</strong><br />
            • Drag: Orbit camera<br />
            • Scroll: Zoom in/out<br />
            • Space: Reset to free camera<br />
            • Click object: Follow mode
          </div>
        </>
      )}
    </div>
  )
}