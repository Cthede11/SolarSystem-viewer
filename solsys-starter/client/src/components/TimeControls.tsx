import React, { useState } from 'react'

interface TimeControlsProps {
  playing: boolean
  onPlayPause: () => void
  frameIndex: number
  maxFrames: number
  onFrameChange: (frame: number) => void
  timeRange: string
  onTimeRangeChange: (range: string) => void
  currentDate: string
  onSpeedChange: (speed: number) => void
  animationSpeed: number
}

export default function TimeControls({
  playing,
  onPlayPause,
  frameIndex,
  maxFrames,
  onFrameChange,
  timeRange,
  onTimeRangeChange,
  currentDate,
  onSpeedChange,
  animationSpeed
}: TimeControlsProps) {
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const timeRanges = [
    { value: '7days', label: '7 Days', step: '4 h' },
    { value: '10days', label: '10 Days', step: '6 h' },
    { value: '30days', label: '30 Days', step: '12 h' },
    { value: '90days', label: '90 Days', step: '1 d' },
    { value: '365days', label: '1 Year', step: '3 d' },
    { value: 'custom', label: 'Custom', step: 'varies' }
  ]

  const speedOptions = [
    { value: 0.1, label: '0.1×' },
    { value: 0.25, label: '0.25×' },
    { value: 0.5, label: '0.5×' },
    { value: 1, label: '1×' },
    { value: 2, label: '2×' },
    { value: 4, label: '4×' },
    { value: 8, label: '8×' }
  ]

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const getProgress = () => {
    if (maxFrames === 0) return 0
    return (frameIndex / maxFrames) * 100
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '12px',
      zIndex: 60,
      minWidth: '400px',
      maxWidth: '90vw'
    }}>
      {/* Main Controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        marginBottom: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {/* Play/Pause */}
        <button
          className="btn"
          onClick={onPlayPause}
          style={{ 
            padding: '8px 12px',
            fontSize: '14px',
            minWidth: '80px'
          }}
        >
          {playing ? '⏸️ Pause' : '▶️ Play'}
        </button>

        {/* Time Range Selector */}
        <select
          className="btn"
          value={timeRange}
          onChange={(e) => {
            onTimeRangeChange(e.target.value)
            setShowCustomRange(e.target.value === 'custom')
          }}
          style={{ 
            background: '#1b263b',
            color: 'var(--fg)',
            minWidth: '100px'
          }}
        >
          {timeRanges.map(range => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>

        {/* Speed Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Speed:</span>
          <select
            className="btn"
            value={animationSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            style={{ 
              background: '#1b263b',
              color: 'var(--fg)',
              fontSize: '12px',
              padding: '4px 6px'
            }}
          >
            {speedOptions.map(speed => (
              <option key={speed.value} value={speed.value}>
                {speed.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Range */}
      {showCustomRange && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="btn"
            style={{ background: '#1b263b', color: 'var(--fg)' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="btn"
            style={{ background: '#1b263b', color: 'var(--fg)' }}
          />
          <button
            className="btn"
            onClick={() => {
              if (customStart && customEnd) {
                // Trigger custom range update
                console.log('Custom range:', customStart, customEnd)
              }
            }}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Timeline Slider */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Frame {Math.round(frameIndex)} / {maxFrames}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {formatDate(currentDate)}
          </span>
        </div>
        
        <div style={{ position: 'relative' }}>
          <input
            type="range"
            className="range"
            min={0}
            max={maxFrames || 0}
            step={0.1}
            value={frameIndex}
            onChange={(e) => onFrameChange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          
          {/* Progress indicator */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '0',
            height: '6px',
            background: 'linear-gradient(to right, #89b4ff, transparent)',
            width: `${getProgress()}%`,
            borderRadius: '3px',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            opacity: 0.3
          }} />
        </div>
      </div>

      {/* Info */}
      <div style={{
        fontSize: '11px',
        color: 'var(--muted)',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span>
          Range: {timeRanges.find(r => r.value === timeRange)?.label}
        </span>
        <span>
          Step: {timeRanges.find(r => r.value === timeRange)?.step}
        </span>
        <span>
          Speed: {animationSpeed}×
        </span>
      </div>
    </div>
  )
}