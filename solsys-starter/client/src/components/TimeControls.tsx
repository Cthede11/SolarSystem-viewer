import React from 'react'
import type { ViewSettings } from '../types'

interface TimeControlsProps {
  playing: boolean
  onPlayPause: () => void
  timeRange: string
  onTimeRangeChange: (range: string) => void
  animationSpeed: number
  onSpeedChange: (speed: number) => void
  currentDate: Date
  startDate: Date
  endDate: Date
  onDateChange: (date: Date) => void
}

export default function TimeControls({
  playing,
  onPlayPause,
  timeRange,
  onTimeRangeChange,
  animationSpeed,
  onSpeedChange,
  currentDate,
  startDate,
  endDate,
  onDateChange
}: TimeControlsProps) {
  // Calculate progress percentage
  const getProgressPercentage = () => {
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsed = currentDate.getTime() - startDate.getTime()
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
  }

  // Set date from progress
  const setDateFromProgress = (percentage: number) => {
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsed = totalDuration * (percentage / 100)
    const newDate = new Date(startDate.getTime() + elapsed)
    onDateChange(newDate)
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="time-controls">
      <div className="controls-header">
        <h3>⏰ Timeline Controls</h3>
        <div className="control-group">
          <button
            className="btn"
            onClick={onPlayPause}
            style={{ 
              padding: '8px 16px',
              fontSize: '14px',
              minWidth: '80px',
              background: playing ? '#ff6b6b' : '#4ecdc4'
            }}
          >
            {playing ? '⏸️ Pause' : '▶️ Play'}
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>Time Range:</label>
        <select
          className="btn"
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value)}
        >
          <option value="7days">7 Days</option>
          <option value="10days">10 Days</option>
          <option value="30days">30 Days</option>
          <option value="90days">90 Days</option>
          <option value="365days">1 Year</option>
        </select>
      </div>

      <div className="control-group">
        <label>Animation Speed:</label>
        <select
          className="btn"
          value={animationSpeed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
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

      <div className="control-group">
        <label>Current Date: {formatDate(currentDate)}</label>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {formatTime(currentDate)}
        </div>
      </div>

      <div className="control-group">
        <label>Date Range: {formatDate(startDate)} - {formatDate(endDate)}</label>
      </div>

      <div className="timeline-scrubber">
        <label>Timeline Scrubber</label>
        <div className="scrubber-controls">
          <button
            className="btn"
            onClick={() => setDateFromProgress(0)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Start
          </button>
          <button
            className="btn"
            onClick={() => setDateFromProgress(25)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            25%
          </button>
          <button
            className="btn"
            onClick={() => setDateFromProgress(50)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            50%
          </button>
          <button
            className="btn"
            onClick={() => setDateFromProgress(75)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            75%
          </button>
          <button
            className="btn"
            onClick={() => setDateFromProgress(100)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            End
          </button>
        </div>
        <input
          type="range"
          className="range"
          min={0}
          max={100}
          step={0.1}
          value={getProgressPercentage()}
          onChange={(e) => setDateFromProgress(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ 
          fontSize: '11px', 
          color: 'var(--muted)',
          textAlign: 'center',
          marginTop: '4px'
        }}>
          {getProgressPercentage().toFixed(1)}% complete
        </div>
      </div>
    </div>
  )
}