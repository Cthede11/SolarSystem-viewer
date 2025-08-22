// Simple linear interpolation between sampled Horizons vectors
// Positions are in kilometers (ICRF/J2000). We'll scale in the renderer.

import type { EphemState } from './api'

// Improved orbital mechanics constants
const G = 6.67430e-11 // Gravitational constant (m³/kg/s²)
const SOLAR_MASS = 1.98847e30 // Solar mass (kg)
const AU = 149597870700 // Astronomical unit (m)
const DAYS_TO_SECONDS = 86400 // Convert days to seconds

// Enhanced orbital elements with more accurate parameters
const ENHANCED_ORBITAL_ELEMENTS = {
  '199': { // Mercury
    name: 'Mercury',
    a: 57909050.0,      // Semi-major axis (km)
    e: 0.2056,          // Eccentricity
    i: 7.00,            // Inclination (degrees)
    ω: 29.124,          // Argument of perihelion (degrees)
    Ω: 48.331,          // Longitude of ascending node (degrees)
    L: 252.251,         // Mean longitude (degrees)
    period: 87.97,      // Orbital period (days)
    mass: 3.301e23,     // Mass (kg)
    radius: 2439.7      // Radius (km)
  },
  '299': { // Venus
    name: 'Venus',
    a: 108208000.0,
    e: 0.0067,
    i: 3.39,
    ω: 54.852,
    Ω: 76.680,
    L: 181.979,
    period: 224.70,
    mass: 4.867e24,
    radius: 6051.8
  },
  '399': { // Earth
    name: 'Earth',
    a: 149597870.7,
    e: 0.0167,
    i: 0.0,
    ω: 114.207,
    Ω: 0.0,
    L: 100.464,
    period: 365.25,
    mass: 5.972e24,
    radius: 6371.0
  },
  '499': { // Mars
    name: 'Mars',
    a: 227939200.0,
    e: 0.0935,
    i: 1.85,
    ω: 286.496,
    Ω: 49.562,
    L: 355.433,
    period: 686.98,
    mass: 6.417e23,
    radius: 3389.5
  },
  '599': { // Jupiter
    name: 'Jupiter',
    a: 778299000.0,
    e: 0.0489,
    i: 1.31,
    ω: 273.867,
    Ω: 100.556,
    L: 34.404,
    period: 4332.59,
    mass: 1.898e27,
    radius: 69911.0
  },
  '699': { // Saturn
    name: 'Saturn',
    a: 1426666000.0,
    e: 0.0565,
    i: 2.49,
    ω: 339.391,
    Ω: 113.715,
    L: 49.944,
    period: 10759.22,
    mass: 5.683e26,
    radius: 58232.0
  },
  '799': { // Uranus
    name: 'Uranus',
    a: 2870658000.0,
    e: 0.0457,
    i: 0.77,
    ω: 96.734,
    Ω: 74.229,
    L: 313.232,
    period: 30688.5,
    mass: 8.681e25,
    radius: 25362.0
  },
  '899': { // Neptune
    name: 'Neptune',
    a: 4498396000.0,
    e: 0.0113,
    i: 1.77,
    ω: 273.249,
    Ω: 131.721,
    L: 304.880,
    period: 60182.0,
    mass: 1.024e26,
    radius: 24622.0
  }
}

// Improved Kepler's equation solver using Newton-Raphson method
function solveKeplersEquation(M: number, e: number, tolerance: number = 1e-8, maxIterations: number = 100): number {
  let E = M // Initial guess: E ≈ M for small eccentricity
  
  for (let i = 0; i < maxIterations; i++) {
    const deltaE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= deltaE
    
    if (Math.abs(deltaE) < tolerance) {
      break
    }
  }
  
  return E
}

// Calculate true anomaly from eccentric anomaly
function eccentricAnomalyToTrueAnomaly(E: number, e: number): number {
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  
  const cosν = (cosE - e) / (1 - e * cosE)
  const sinν = (Math.sqrt(1 - e * e) * sinE) / (1 - e * cosE)
  
  return Math.atan2(sinν, cosν)
}

// Convert orbital elements to 3D position and velocity
function orbitalElementsToState(
  a: number,      // Semi-major axis (km)
  e: number,      // Eccentricity
  i: number,      // Inclination (degrees)
  ω: number,      // Argument of perihelion (degrees)
  Ω: number,      // Longitude of ascending node (degrees)
  L: number,      // Mean longitude (degrees)
  t: Date,        // Time
  period: number  // Orbital period (days)
): { position: [number, number, number], velocity: [number, number, number] } {
  try {
    // Calculate mean anomaly
    const epoch = new Date(2000, 0, 1) // J2000 epoch
    const daysSinceEpoch = (t.getTime() - epoch.getTime()) / (1000 * DAYS_TO_SECONDS)
    const meanAnomaly = ((L + 360 * daysSinceEpoch / period) % 360) * Math.PI / 180
    
    // Solve Kepler's equation
    const eccentricAnomaly = solveKeplersEquation(meanAnomaly, e)
    
    // Calculate true anomaly
    const trueAnomaly = eccentricAnomalyToTrueAnomaly(eccentricAnomaly, e)
    
    // Calculate distance from focus
    const r = a * (1 - e * e) / (1 + e * Math.cos(trueAnomaly))
    
    // Convert to radians
    const iRad = i * Math.PI / 180
    const ωRad = ω * Math.PI / 180
    const ΩRad = Ω * Math.PI / 180
    
    // Calculate position in orbital plane
    const xOrbital = r * Math.cos(trueAnomaly)
    const yOrbital = r * Math.sin(trueAnomaly)
    
    // Apply orbital plane transformations
    const cosΩ = Math.cos(ΩRad)
    const sinΩ = Math.sin(ΩRad)
    const cosω = Math.cos(ωRad)
    const sinω = Math.sin(ωRad)
    const cosi = Math.cos(iRad)
    const sini = Math.sin(iRad)
    
    // Rotation matrices for orbital elements
    const x = (cosΩ * cosω - sinΩ * sinω * cosi) * xOrbital + 
              (-cosΩ * sinω - sinΩ * cosω * cosi) * yOrbital
    const y = (sinΩ * cosω + cosΩ * sinω * cosi) * xOrbital + 
              (-sinΩ * sinω + cosΩ * cosω * cosi) * yOrbital
    const z = (sinω * sini) * xOrbital + (cosω * sini) * yOrbital
    
    // Calculate velocity (simplified - could be enhanced with proper orbital velocity)
    const orbitalSpeed = Math.sqrt(G * SOLAR_MASS / (a * 1000)) / 1000 // km/s
    const vx = -orbitalSpeed * Math.sin(trueAnomaly)
    const vy = orbitalSpeed * (Math.cos(trueAnomaly) + e)
    const vz = 0
    
    return {
      position: [x, y, z],
      velocity: [vx, vy, vz]
    }
  } catch (error) {
    console.warn('Error calculating orbital state:', error)
    // Fallback to simple circular orbit
    return {
      position: [a, 0, 0],
      velocity: [0, 0, 0]
    }
  }
}

// Enhanced position calculation with better error handling
export function positionAtDate(states: EphemState[], targetDate: Date): [number, number, number] | null {
  if (!states || states.length === 0) {
    console.warn('No states provided for position calculation')
    return null
  }

  try {
    // Find the two states that bracket the target date
    let state0: EphemState | null = null
    let state1: EphemState | null = null
    
    const targetTime = targetDate.getTime()
    
    for (let i = 0; i < states.length - 1; i++) {
      const time0 = new Date(states[i].t).getTime()
      const time1 = new Date(states[i + 1].t).getTime()
      
      if (targetTime >= time0 && targetTime <= time1) {
        state0 = states[i]
        state1 = states[i + 1]
        break
      }
    }
    
    // If no bracketing states found, use the closest one
    if (!state0 || !state1) {
      let closestState = states[0]
      let minTimeDiff = Math.abs(new Date(states[0].t).getTime() - targetTime)
      
      for (const state of states) {
        const timeDiff = Math.abs(new Date(state.t).getTime() - targetTime)
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff
          closestState = state
        }
      }
      
      return closestState.r as [number, number, number]
    }
    
    // Interpolate between the two states
    const time0 = new Date(state0.t).getTime()
    const time1 = new Date(state1.t).getTime()
    
    if (isNaN(time0) || isNaN(time1)) {
      console.warn('Invalid time values in states')
      return state0.r as [number, number, number]
    }
    
    const alpha = (targetTime - time0) / (time1 - time0)
    
    if (alpha < 0 || alpha > 1) {
      console.warn('Interpolation alpha out of bounds:', alpha)
      return state0.r as [number, number, number]
    }
    
    // Linear interpolation with validation
    const r0 = state0.r
    const r1 = state1.r
    
    if (!r0 || !r1 || r0.length !== 3 || r1.length !== 3) {
      console.warn('Invalid position data in states')
      return [0, 0, 0]
    }
    
    const interpolated = [
      r0[0] + alpha * (r1[0] - r0[0]),
      r0[1] + alpha * (r1[1] - r0[1]),
      r0[2] + alpha * (r1[2] - r0[2])
    ]
    
    // Validate interpolated values
    if (interpolated.some(val => !Number.isFinite(val))) {
      console.warn('Interpolation produced invalid values:', interpolated)
      return r0 as [number, number, number]
    }
    
    return interpolated as [number, number, number]
    
  } catch (error) {
    console.error('Error in positionAtDate:', error)
    return null
  }
}

// Enhanced fallback orbital calculation using improved mechanics
export function calculateFallbackPosition(
  bodyId: string, 
  targetDate: Date
): [number, number, number] | null {
  const elements = ENHANCED_ORBITAL_ELEMENTS[bodyId as keyof typeof ENHANCED_ORBITAL_ELEMENTS]
  
  if (!elements) {
    console.warn(`No orbital elements available for body ${bodyId}`)
    return null
  }
  
  try {
    const state = orbitalElementsToState(
      elements.a,
      elements.e,
      elements.i,
      elements.ω,
      elements.Ω,
      elements.L,
      targetDate,
      elements.period
    )
    
    return state.position
  } catch (error) {
    console.error(`Error calculating fallback position for ${bodyId}:`, error)
    return null
  }
}

// Calculate orbital velocity at a given position
export function calculateOrbitalVelocity(
  position: [number, number, number],
  semiMajorAxis: number,
  eccentricity: number
): [number, number, number] {
  try {
    const r = Math.sqrt(position[0]**2 + position[1]**2 + position[2]**2)
    const orbitalSpeed = Math.sqrt(G * SOLAR_MASS / (semiMajorAxis * 1000)) / 1000 // km/s
    
    // Simplified velocity calculation - could be enhanced
    const vx = -orbitalSpeed * position[1] / r
    const vy = orbitalSpeed * position[0] / r
    const vz = 0
    
    return [vx, vy, vz]
  } catch (error) {
    console.warn('Error calculating orbital velocity:', error)
    return [0, 0, 0]
  }
}

// Legacy function for backward compatibility
export function positionAt(states: EphemState[], frameIndex: number): [number, number, number] | null {
  if (!states || states.length === 0 || frameIndex < 0 || frameIndex >= states.length) {
    return null
  }
  
  try {
    const state = states[frameIndex]
    if (state && state.r && state.r.length === 3) {
      return state.r as [number, number, number]
    }
  } catch (error) {
    console.error('Error in positionAt:', error)
  }
  
  return null
}