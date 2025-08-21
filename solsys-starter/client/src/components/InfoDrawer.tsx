import React from 'react'

export type Info = {
  id: string
  label: string
  kind: 'planet' | 'star' | 'dwarf' | 'small' | 'spacecraft'
  extra?: {
    source?: string
    clickedAt?: string
    selectedAt?: string
    details?: string
    stats?: Record<string, string>
    [key: string]: any
  }
}

interface InfoDrawerProps {
  info: Info | null
  onClose: () => void
}

export default function InfoDrawer({ info, onClose }: InfoDrawerProps) {
  if (!info) return null

  const getIcon = (kind: Info['kind']) => {
    switch (kind) {
      case 'star': return '⭐'
      case 'planet': return '🪐'
      case 'dwarf': return '🌑'
      case 'small': return '☄️'
      case 'spacecraft': return '🚀'
      default: return '🌌'
    }
  }

  const getKindColor = (kind: Info['kind']) => {
    switch (kind) {
      case 'star': return '#ffaa00'
      case 'planet': return '#89b4ff'
      case 'dwarf': return '#666666'
      case 'small': return '#ff6b6b'
      case 'spacecraft': return '#00d4aa'
      default: return '#9db4ff'
    }
  }

  return (
    <div className="info-drawer">
      <div className="info-header">
        <div className="info-title-section">
          <div className="info-icon" style={{ color: getKindColor(info.kind) }}>
            {getIcon(info.kind)}
          </div>
          <div>
            <h3 className="info-title">{info.label}</h3>
            <div className="info-subtitle">
              <span className="info-kind" style={{ color: getKindColor(info.kind) }}>
                {info.kind}
              </span>
              {info.extra?.source && (
                <span className="info-source">• {info.extra.source}</span>
              )}
            </div>
          </div>
        </div>
        <button className="info-close-btn" onClick={onClose} title="Close">
          ×
        </button>
      </div>

      <div className="info-content">
        <div className="info-id">
          <span className="info-label">Horizons ID:</span>
          <span className="info-value">{info.id}</span>
        </div>

        {info.extra?.details && (
          <div className="info-section">
            <h4>Description</h4>
            <p className="info-description">{info.extra.details}</p>
          </div>
        )}

        {info.extra?.stats && (
          <div className="info-section">
            <h4>Key Statistics</h4>
            <div className="info-stats">
              {Object.entries(info.extra.stats).map(([key, value]) => (
                <div key={key} className="info-stat">
                  <span className="stat-key">{key}:</span>
                  <span className="stat-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="info-section">
          <h4>Current Status</h4>
          <div className="info-status">
            <div className="status-item">
              <span className="status-icon">📍</span>
              <span>Camera following this object</span>
            </div>
            <div className="status-item">
              <span className="status-icon">🕐</span>
              <span>
                {info.extra?.clickedAt ? `Clicked at ${info.extra.clickedAt}` : 
                 info.extra?.selectedAt ? `Selected at ${info.extra.selectedAt}` : 
                 'Recently selected'}
              </span>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h4>Quick Actions</h4>
          <div className="info-actions">
            <button className="action-btn" title="Toggle orbit visibility">
              🛸 Toggle Orbit
            </button>
            <button className="action-btn" title="Share object info">
              📤 Share
            </button>
            <button className="action-btn" title="Learn more">
              📚 Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}