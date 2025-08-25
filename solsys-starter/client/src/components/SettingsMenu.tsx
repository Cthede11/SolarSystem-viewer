import React from 'react'
import type { ViewSettings } from '../types'

interface SettingsMenuProps {
  settings: ViewSettings
  onSettingsChange: (settings: ViewSettings) => void
  isOpen: boolean
  onClose: () => void
}

export default function SettingsMenu({ settings, onSettingsChange, isOpen, onClose }: SettingsMenuProps) {
  if (!isOpen) return null

  const handleToggle = (key: keyof ViewSettings) => {
    onSettingsChange({
      ...settings,
      [key]: !settings[key]
    })
  }

  const handlePlanetFollow = (planetId: string | null) => {
    onSettingsChange({
      ...settings,
      followPlanet: planetId
    })
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-menu" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>View Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          <div className="setting-group">
            <h4>Scale & Size</h4>
            
            <label className="setting-item">
              <input
                type="checkbox"
                checked={settings.useRealisticScale}
                onChange={() => handleToggle('useRealisticScale')}
              />
              <div>
                <span>Realistic Distances</span>
                <small>Use actual astronomical distances (planets will be very far apart)</small>
              </div>
            </label>

            <label className="setting-item">
              <input
                type="checkbox"
                checked={settings.useRealisticSizes}
                onChange={() => handleToggle('useRealisticSizes')}
              />
              <div>
                <span>Realistic Sizes</span>
                <small>Use actual relative sizes (planets will be much smaller)</small>
              </div>
            </label>

            {(settings.useRealisticScale && settings.useRealisticSizes) && (
              <label className="setting-item" style={{ alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <span>Visibility Multiplier</span>
                  <small>Temporarily enlarge radii for visibility (does not affect positions)</small>
                  <input
                    type="range"
                    min={1}
                    max={1000}
                    step={1}
                    value={settings.realisticVisibilityScale ?? 100}
                    onChange={(e) => onSettingsChange({ ...settings, realisticVisibilityScale: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>×{settings.realisticVisibilityScale ?? 100}</div>
                </div>
              </label>
            )}

            {(settings.useRealisticScale || settings.useRealisticSizes) && (
              <div className="scale-warning">
                ⚠️ Realistic scale makes planets very hard to see. Use camera follow mode below.
              </div>
            )}
          </div>

          <div className="setting-group">
            <h4>Display Options</h4>
            
            <label className="setting-item">
              <input
                type="checkbox"
                checked={settings.showOrbits}
                onChange={() => handleToggle('showOrbits')}
              />
              <div>
                <span>Show Orbit Paths</span>
                <small>Display the orbital trajectories</small>
              </div>
            </label>
          </div>

          <div className="setting-group">
            <h4>Camera Focus</h4>
            
            <div className="planet-follow">
              <label className="setting-item">
                <input
                  type="radio"
                  name="followPlanet"
                  checked={settings.followPlanet === null}
                  onChange={() => handlePlanetFollow(null)}
                />
                <div>
                  <span>Free Camera</span>
                  <small>Manual camera control with mouse</small>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="radio"
                  name="followPlanet"
                  checked={settings.followPlanet === '10'}
                  onChange={() => handlePlanetFollow('10')}
                />
                <div>
                  <span>Follow Sun</span>
                  <small>Camera automatically follows the Sun</small>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="radio"
                  name="followPlanet"
                  checked={settings.followPlanet === '399'}
                  onChange={() => handlePlanetFollow('399')}
                />
                <div>
                  <span>Follow Earth</span>
                  <small>Camera automatically follows Earth's movement</small>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="radio"
                  name="followPlanet"
                  checked={settings.followPlanet === '499'}
                  onChange={() => handlePlanetFollow('499')}
                />
                <div>
                  <span>Follow Mars</span>
                  <small>Camera automatically follows Mars' movement</small>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="radio"
                  name="followPlanet"
                  checked={settings.followPlanet === '599'}
                  onChange={() => handlePlanetFollow('599')}
                />
                <div>
                  <span>Follow Jupiter</span>
                  <small>Camera automatically follows Jupiter's movement</small>
                </div>
              </label>
            </div>
          </div>

          <div className="scale-info">
            <h4>Scale Information</h4>
            <div className="info-grid">
              <div>
                <strong>View Mode (Default):</strong>
                <ul>
                  <li>Distances: ~1:50,000,000 scale</li>
                  <li>Sizes: Enhanced for visibility</li>
                  <li>Great for understanding orbits</li>
                  <li>Easy to navigate and explore</li>
                </ul>
              </div>
              <div>
                <strong>Realistic Mode:</strong>
                <ul>
                  <li>Distances: True 1:1 scale</li>
                  <li>Sizes: Actual relative sizes</li>
                  <li>Shows the vastness of space</li>
                  <li>Requires camera follow mode</li>
                </ul>
              </div>
            </div>
            
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
              <strong>Fun Fact:</strong> If Earth were the size of a marble (1cm), the nearest star would be about 4,000 km away!
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}