// Simple linear interpolation between sampled Horizons vectors
// Positions are in kilometers (ICRF/J2000). We'll scale in the renderer.

import type { EphemState } from './api'

export function indexForTime(states: EphemState[], idx: number) {
  // For this starter we step by index (uniform sampling). Clamp.
  const i = Math.max(0, Math.min(states.length - 1, idx))
  return i
}

export function lerpVec(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t]
}

export function positionAt(states: EphemState[], fIndex: number): [number,number,number] {
  // Handle empty or invalid states
  if (!states || states.length === 0) {
    console.warn('positionAt: No states provided')
    return [0, 0, 0]
  }

  // Clamp frame index to valid range
  const clampedIndex = Math.max(0, Math.min(fIndex, states.length - 1))
  
  const i0 = Math.floor(clampedIndex)
  const i1 = Math.min(states.length - 1, i0 + 1)
  const t = Math.min(1, Math.max(0, clampedIndex - i0))
  
  // Check if states exist and have valid data
  const state0 = states[i0]
  const state1 = states[i1]
  
  if (!state0 || !state0.r || state0.r.length < 3) {
    console.warn('positionAt: Invalid state0 data', { i0, state0, statesLength: states.length })
    return [0, 0, 0]
  }
  
  if (!state1 || !state1.r || state1.r.length < 3) {
    console.warn('positionAt: Invalid state1 data', { i1, state1, statesLength: states.length })
    return state0.r.slice(0, 3) as [number, number, number]
  }
  
  const r0 = state0.r
  const r1 = state1.r
  
  // Ensure we have valid numbers
  if (r0.some(isNaN) || r1.some(isNaN)) {
    console.warn('positionAt: NaN values detected', { r0, r1, i0, i1, fIndex })
    return [0, 0, 0]
  }

  // Check for extremely large values that might cause display issues
  const maxComponent = Math.max(...r0.map(Math.abs), ...r1.map(Math.abs))
  if (maxComponent > 1e12) { // More than 1 billion km seems excessive
    console.warn('positionAt: Extremely large position values detected', { 
      r0, r1, maxComponent, i0, i1, fIndex 
    })
  }
  
  const result = lerpVec(r0, r1, t)
  
  // Final validation
  if (result.some(isNaN) || result.some(v => !isFinite(v))) {
    console.warn('positionAt: Invalid result', { result, r0, r1, t, i0, i1, fIndex })
    return [0, 0, 0]
  }
  
  // Debug logging for first few calls or periodically
  if (fIndex < 5 || fIndex % 100 === 0) {
    console.log('positionAt debug:', {
      fIndex: fIndex.toFixed(2),
      i0, i1, t: t.toFixed(3),
      r0: r0.map(v => v.toFixed(0)),
      r1: r1.map(v => v.toFixed(0)),
      result: result.map(v => v.toFixed(0)),
      distance: Math.sqrt(result[0]**2 + result[1]**2 + result[2]**2).toFixed(0)
    })
  }
  
  return result
}