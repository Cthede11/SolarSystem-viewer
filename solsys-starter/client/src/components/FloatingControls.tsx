import React, { useState, useRef, useEffect } from 'react'

interface FloatingControlsProps {
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
  onToggle: () => void
}

export default function FloatingControls({
  playing,
  onPlayPause,
  timeRange,
  onTimeRangeChange,
  animationSpeed,
  onSpeedChange,
  currentDate,
  startDate,
  endDate,
  onDateChange,
  onToggle
}: FloatingControlsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 100 })
  const dragRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef({ x: 0, y: 0 })

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === dragRef.current) {
      setIsDragging(true)
      startPosRef.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startPosRef.current.x,
        y: e.clientY - startPosRef.current.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  // Helper functions
  const getProgressPercentage = () => {
    const total = endDate.getTime() - startDate.getTime()
    const current = currentDate.getTime() - startDate.getTime()
    return total > 0 ? (current / total) * 100 : 0
  }

  const setDateFromProgress = (percentage: number) => {
    const total = endDate.getTime() - startDate.getTime()
    const newTime = startDate.getTime() + (total * percentage / 100)
    onDateChange(new Date(newTime))
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  if (isCollapsed) {
    return (
      <div 
        className="floating-controls collapsed"
        style={{ left: position.x, top: position.y }}
      >
        <div className="drag-handle" ref={dragRef} onMouseDown={handleMouseDown}>
          ⚡
        </div>
        <button 
          className="expand-btn"
          onClick={() => setIsCollapsed(false)}
          title="Expand Controls"
        >
          ▶
        </button>
      </div>
    )
  }

  return (
    <div 
      className="floating-controls"
      style={{ left: position.x, top: position.y }}
    >
      <div className="drag-handle" ref={dragRef} onMouseDown={handleMouseDown}>
        ⚡ Controls
      </div>
      
      <div className="controls-content">
        <div className="control-row">
          <button 
            className={`play-btn ${playing ? 'playing' : ''}`}
            onClick={onPlayPause}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>

        <div className="control-row">
          <label>Range:</label>
          <select 
            className="control-select"
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

        <div className="control-row">
          <label>Speed:</label>
          <select 
            className="control-select"
            value={animationSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>

        <div className="control-row">
          <label>Date:</label>
          <span className="date-value">{formatDate(currentDate)}</span>
        </div>

        <div className="timeline-container">
          <div className="timeline-buttons">
            <button 
              className="timeline-btn"
              onClick={() => setDateFromProgress(0)}
              title="Go to Start"
            >
              ⏮
            </button>
            <button 
              className="timeline-btn"
              onClick={() => setDateFromProgress(25)}
              title="25%"
            >
              25%
            </button>
            <button 
              className="timeline-btn"
              onClick={() => setDateFromProgress(50)}
              title="50%"
            >
              50%
            </button>
            <button 
              className="timeline-btn"
              onClick={() => setDateFromProgress(75)}
              title="75%"
            >
              75%
            </button>
            <button 
              className="timeline-btn"
              onClick={() => setDateFromProgress(100)}
              title="Go to End"
            >
              ⏭
            </button>
          </div>
          
          <div className="timeline-slider">
            <input
              type="range"
              min="0"
              max="100"
              value={getProgressPercentage()}
              onChange={(e) => setDateFromProgress(Number(e.target.value))}
              className="timeline-progress"
            />
          </div>
        </div>
      </div>

      <div className="control-buttons">
        <button 
          className="expand-btn"
          onClick={() => setIsCollapsed(true)}
          title="Collapse"
        >
          ◀
        </button>
        <button 
          className="close-btn"
          onClick={onToggle}
          title="Hide Controls"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
