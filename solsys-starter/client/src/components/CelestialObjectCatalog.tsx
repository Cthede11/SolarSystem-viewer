import React, { useState, useMemo } from 'react'
import type { SolarSystemData } from './SolarSystemDataManager'

interface CelestialObjectCatalogProps {
  data: SolarSystemData
  onSelectObject: (object: any, type: string) => void
  isOpen: boolean
  onClose: () => void
}

type ObjectType = 'neos' | 'comets' | 'asteroids' | 'solarFlares' | 'satellites'

export default function CelestialObjectCatalog({ 
  data, 
  onSelectObject, 
  isOpen, 
  onClose 
}: CelestialObjectCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<ObjectType>('neos')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const objectTypes = [
    { key: 'neos', label: 'Near-Earth Objects', count: data.neos.length, icon: '☄️' },
    { key: 'comets', label: 'Comets', count: data.comets.length, icon: '💫' },
    { key: 'asteroids', label: 'Asteroids', count: data.asteroids.length, icon: '🪨' },
    { key: 'solarFlares', label: 'Solar Flares', count: data.solarFlares.length, icon: '🔥' },
    { key: 'satellites', label: 'Satellites', count: Object.keys(data.satellites).length, icon: '🛰️' }
  ]

  const filteredAndSortedObjects = useMemo(() => {
    let objects: any[] = []
    
    switch (selectedType) {
      case 'neos':
        objects = data.neos
        break
      case 'comets':
        objects = data.comets
        break
      case 'asteroids':
        objects = data.asteroids
        break
      case 'solarFlares':
        objects = data.solarFlares
        break
      case 'satellites':
        objects = Object.entries(data.satellites).map(([key, value]) => ({ id: key, ...value }))
        break
    }

    // Filter by search term
    if (searchTerm) {
      objects = objects.filter(obj => {
        const searchLower = searchTerm.toLowerCase()
        if (obj.name && obj.name.toLowerCase().includes(searchLower)) return true
        if (obj.full_name && obj.full_name.toLowerCase().includes(searchLower)) return true
        if (obj.des && obj.des.toLowerCase().includes(searchLower)) return true
        if (obj.id && obj.id.toLowerCase().includes(searchLower)) return true
        return false
      })
    }

    // Sort objects
    objects.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return objects
  }, [data, selectedType, searchTerm, sortBy, sortOrder])

  const getObjectDisplayName = (obj: any, type: ObjectType) => {
    switch (type) {
      case 'neos':
      case 'asteroids':
        return obj.full_name || obj.name || obj.des || obj.id || 'Unknown'
      case 'comets':
        return obj.full_name || obj.des || 'Unknown'
      case 'solarFlares':
        return obj.flrID || obj.classType || 'Solar Flare'
      case 'satellites':
        return obj.name || obj.id || 'Unknown'
      default:
        return obj.name || obj.id || 'Unknown'
    }
  }

  const getObjectDetails = (obj: any, type: ObjectType) => {
    switch (type) {
      case 'neos':
      case 'asteroids':
        return [
          obj.orbit_class && `Class: ${obj.orbit_class}`,
          obj.diameter && `Diameter: ${obj.diameter} km`,
          obj.H && `Magnitude: ${obj.H}`,
          obj.period_yr && `Period: ${obj.period_yr} years`
        ].filter(Boolean)
      case 'comets':
        return [
          obj.orbit_class && `Class: ${obj.orbit_class}`,
          obj.period_yr && `Period: ${obj.period_yr} years`,
          obj.semimajor_au && `Semi-major: ${obj.semimajor_au} AU`
        ].filter(Boolean)
      case 'solarFlares':
        return [
          obj.classType && `Class: ${obj.classType}`,
          obj.beginTime && `Start: ${new Date(obj.beginTime).toLocaleString()}`,
          obj.sourceLocation && `Location: ${obj.sourceLocation}`
        ].filter(Boolean)
      case 'satellites':
        return [
          obj.type && `Type: ${obj.type}`,
          obj.orbit && `Orbit: ${obj.orbit}`,
          obj.location && `Location: ${obj.location}`
        ].filter(Boolean)
      default:
        return []
    }
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '90vw',
        maxWidth: '1200px',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0 }}>🌌 Celestial Object Catalog</h2>
          <button
            onClick={onClose}
            className="btn"
            style={{ background: '#ff6b6b' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Controls */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Object Type Selector */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {objectTypes.map(type => (
              <button
                key={type.key}
                onClick={() => setSelectedType(type.key as ObjectType)}
                className="btn"
                style={{
                  background: selectedType === type.key ? '#4ecdc4' : 'var(--button)',
                  fontSize: '12px',
                  padding: '6px 12px'
                }}
              >
                {type.icon} {type.label} ({type.count})
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search objects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--input)',
              color: 'var(--fg)',
              minWidth: '200px'
            }}
          />

          {/* Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                background: 'var(--input)',
                color: 'var(--fg)',
                fontSize: '12px'
              }}
            >
              <option value="name">Name</option>
              <option value="diameter">Diameter</option>
              <option value="period_yr">Period</option>
              <option value="H">Magnitude</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn"
              style={{ 
                padding: '4px 8px', 
                fontSize: '12px',
                background: 'var(--button)'
              }}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Object List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }}>
          {filteredAndSortedObjects.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--muted)',
              padding: '40px'
            }}>
              {searchTerm ? 'No objects found matching your search.' : 'No objects available for this category.'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '12px'
            }}>
              {filteredAndSortedObjects.map((obj, index) => (
                <div
                  key={`${selectedType}-${obj.id || obj.des || index}`}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-hover)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                  onClick={() => onSelectObject(obj, selectedType)}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '14px' }}>
                      {getObjectDisplayName(obj, selectedType)}
                    </h4>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      background: 'var(--accent)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {selectedType.toUpperCase()}
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--muted)'
                  }}>
                    {getObjectDetails(obj, selectedType).map((detail, i) => (
                      <div key={i}>{detail}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--muted)'
        }}>
          <span>Showing {filteredAndSortedObjects.length} of {objectTypes.find(t => t.key === selectedType)?.count || 0} objects</span>
          <span>Last updated: {data.lastUpdated.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
