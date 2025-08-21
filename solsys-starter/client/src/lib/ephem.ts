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

  const i0 = Math.floor(fIndex)
  const i1 = Math.min(states.length - 1, i0 + 1)
  const t = Math.min(1, Math.max(0, fIndex - i0))
  
  // Check if states exist and have valid data
  const state0 = states[i0]
  const state1 = states[i1]
  
  if (!state0 || !state0.r || state0.r.length < 3) {
    console.warn('positionAt: Invalid state0 data', state0)
    return [0, 0, 0]
  }
  
  if (!state1 || !state1.r || state1.r.length < 3) {
    console.warn('positionAt: Invalid state1 data', state1)
    return state0.r.slice(0, 3) as [number, number, number]
  }
  
  const r0 = state0.r
  const r1 = state1.r
  
  // Ensure we have valid numbers
  if (r0.some(isNaN) || r1.some(isNaN)) {
    console.warn('positionAt: NaN values detected', { r0, r1 })
    return [0, 0, 0]
  }
  
  return lerpVec(r0, r1, t)
}