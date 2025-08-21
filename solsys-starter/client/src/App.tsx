import React, { useEffect, useMemo, useState } from 'react'

type DetailsEvent = { id: string | null }

type PlanetCard = {
  id: string
  name: string
  kind: 'star' | 'planet'
  color: string
  description: string
  stats: Record<string, string>
  facts: string[]
  horizonsId: string
}

const DB: Record<string, PlanetCard> = {
  '10': {
    id: '10',
    name: 'Sun',
    kind: 'star',
    color: '#ffdd44',
    description:
      'The Sun is the star at the center of our Solar System. A nearly perfect sphere of hot plasma powered by nuclear fusion.',
    stats: {
      mass: '1.989 × 10³⁰ kg',
      surfaceTemp: '5,505°C',
      radius: '696,340 km',
    },
    facts: [
      '99.86% of Solar System mass',
      'Light → Earth: ~8 min',
      'Core temp ~15M °C',
    ],
    horizonsId: '10',
  },
  '199': {
    id: '199',
    name: 'Mercury',
    kind: 'planet',
    color: '#8c7853',
    description:
      'Smallest planet and closest to the Sun. Extreme temperature swing and a cratered surface.',
    stats: {
      mass: '3.285 × 10²³ kg',
      dayLength: '59 Earth days',
      orbitalPeriod: '88 days',
    },
    facts: ['No moons', 'Day longer than year', 'Heavily cratered'],
    horizonsId: '199',
  },
  '299': {
    id: '299',
    name: 'Venus',
    kind: 'planet',
    color: '#ffcc33',
    description:
      'Second planet from the Sun. Dense CO₂ atmosphere traps heat, making it the hottest planet.',
    stats: {
      mass: '4.867 × 10²⁴ kg',
      dayLength: '243 Earth days',
      orbitalPeriod: '225 days',
    },
    facts: ['Retrograde rotation', 'Thick clouds', 'Hottest surface'],
    horizonsId: '299',
  },
  '399': {
    id: '399',
    name: 'Earth',
    kind: 'planet',
    color: '#6ec6ff',
    description:
      'Our home world. Liquid water, protective atmosphere, and a thriving biosphere.',
    stats: {
      mass: '5.972 × 10²⁴ kg',
      gravity: '9.807 m/s²',
      dayLength: '24 hours',
    },
    facts: ['71% water', 'One natural satellite (Moon)'],
    horizonsId: '399',
  },
  '499': {
    id: '499',
    name: 'Mars',
    kind: 'planet',
    color: '#ff785a',
    description:
      'A cold desert world with the largest volcano in the Solar System (Olympus Mons).',
    stats: {
      mass: '6.39 × 10²³ kg',
      dayLength: '24h 37m',
      orbitalPeriod: '687 days',
    },
    facts: ['Two small moons', 'Ancient water signs'],
    horizonsId: '499',
  },
  '599': {
    id: '599',
    name: 'Jupiter',
    kind: 'planet',
    color: '#d8ca9d',
    description:
      'The largest planet. Powerful magnetic field and the Great Red Spot storm.',
    stats: { mass: '1.898 × 10²⁷ kg', dayLength: '9h 56m' },
    facts: ['>95 moons', 'Massive magnetosphere'],
    horizonsId: '599',
  },
  '699': {
    id: '699',
    name: 'Saturn',
    kind: 'planet',
    color: '#fad5a5',
    description: 'Gas giant famous for its rings.',
    stats: { mass: '5.683 × 10²⁶ kg', orbitalPeriod: '29 years' },
    facts: ['Rings are billions of particles', 'Moon Titan has thick atmosphere'],
    horizonsId: '699',
  },
  '799': {
    id: '799',
    name: 'Uranus',
    kind: 'planet',
    color: '#4fd0e4',
    description: 'Ice giant tipped on its side (axial tilt ~98°).',
    stats: { dayLength: '17h 14m', orbitalPeriod: '84 years' },
    facts: ['Faint rings', 'Methane-rich atmosphere'],
    horizonsId: '799',
  },
  '899': {
    id: '899',
    name: 'Neptune',
    kind: 'planet',
    color: '#4b70dd',
    description: 'Farthest planet with the strongest winds in the Solar System.',
    stats: { dayLength: '16h 6m', orbitalPeriod: '165 years' },
    facts: ['Dark Spot storms', 'Moon Triton likely captured'],
    horizonsId: '899',
  },
}

// Optional props kept for compatibility with existing imports.
// They’re ignored for opening/closing behavior; we drive that via events.
type Props = {
  selectedPlanet?: string | null
  onClose?: () => void
}

export default function InfoDrawer({ onClose }: Props) {
  // Open only via app:showDetails; not on selection/focus.
  const [open, setOpen] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const card = useMemo(() => (id ? DB[id] : null), [id])

  useEffect(() => {
    const onShow = (e: Event) => {
      const ce = e as CustomEvent<DetailsEvent>
      const next = ce.detail?.id || null
      if (next && DB[next]) {
        setId(next)
        setOpen(true)
      }
    }
    const onHide = () => setOpen(false)

    window.addEventListener('app:showDetails', onShow)
    window.addEventListener('app:hideDetails', onHide)
    return () => {
      window.removeEventListener('app:showDetails', onShow)
      window.removeEventListener('app:hideDetails', onHide)
    }
  }, [])

  const close = () => {
    setOpen(false)
    onClose?.()
  }

  if (!open || !card) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: '12px',
        top: '80px',
        width: '320px',
        maxWidth: '90vw',
        background: 'var(--panel, #0b1220)',
        border: '1px solid var(--border, #1e2a3a)',
        borderRadius: '14px',
        boxShadow: '0 16px 32px rgba(0,0,0,0.45)',
        color: 'var(--fg, #e6eefc)',
        zIndex: 70,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border, #1e2a3a)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))'
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: card.color,
            display: 'grid',
            placeItems: 'center',
            fontSize: 16
          }}
        >
          {card.kind === 'star' ? '☀️' : '🪐'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{card.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {card.kind.toUpperCase()} • Directory
          </div>
        </div>
        <button
          className="btn"
          onClick={close}
          title="Close"
          style={{ padding: '4px 8px', fontSize: 12 }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 14, display: 'grid', gap: 10 }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border, #1e2a3a)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
          }}
        >
          <div style={{ opacity: 0.75, marginBottom: 4 }}>Horizons ID:</div>
          <strong>{card.horizonsId}</strong>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Description</div>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>{card.description}</div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Key Statistics</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8
            }}
          >
            {Object.entries(card.stats).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border, #1e2a3a)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 12
                }}
              >
                <div style={{ opacity: 0.75, marginBottom: 4 }}>{k}</div>
                <div style={{ fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Fast facts</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {card.facts.map((f, i) => (
              <li key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => window.dispatchEvent(new CustomEvent('app:select', { detail: { id } }))}
          >
            🎯 Focus
          </button>
          <button className="btn secondary-btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
