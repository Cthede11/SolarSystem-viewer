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
  if (states.length === 0) return [0,0,0]
  const i0 = Math.floor(fIndex)
  const i1 = Math.min(states.length - 1, i0 + 1)
  const t = Math.min(1, Math.max(0, fIndex - i0))
  const r0 = states[i0].r
  const r1 = states[i1].r
  return lerpVec(r0, r1, t)
}