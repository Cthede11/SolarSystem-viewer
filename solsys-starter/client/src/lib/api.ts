const API_BASE = (globalThis as any).__API_BASE__ as string

export type EphemState = { t: string; r: [number,number,number]; v: [number,number,number] }
export type EphemSet = { id: string; center: string; states: EphemState[]; error?: string }

// NASA API Types
export type APODData = {
  copyright?: string
  date: string
  explanation: string
  hdurl?: string
  media_type: string
  service_version: string
  title: string
  url: string
}

export type ExoplanetData = {
  pl_name: string
  hostname: string
  pl_orbper?: number
  pl_rade?: number
  pl_masse?: number
  pl_dens?: number
  pl_eqt?: number
  pl_orbincl?: number
  pl_orbeccen?: number
  pl_orbsmax?: number
  st_teff?: number
  st_rad?: number
  st_mass?: number
  st_dist?: number
  st_met?: number
  st_age?: number
}

export type MarsRoverPhoto = {
  id: number
  sol: number
  camera: {
    id: number
    name: string
    rover_id: number
    full_name: string
  }
  img_src: string
  earth_date: string
  rover: {
    id: number
    name: string
    landing_date: string
    launch_date: string
    status: string
  }
}

export type SpaceWeatherEvent = {
  flrID?: string
  instruments?: Array<{displayName: string}>
  beginTime?: string
  peakTime?: string
  endTime?: string
  classType?: string
  sourceLocation?: string
  activeRegionNum?: number
  linkedEvents?: string[]
  link?: string
}

export type AsteroidData = {
  full_name: string
  des: string
  orbit_id: string
  orbit_determination_date: string
  first_observation_date: string
  last_observation_date: string
  data_arc_in_days: number
  observations_used: number
  orbit_uncertainty: string
  minimum_orbit_intersection: string
  jupiter_tisserand_invariant: string
  epoch_osculation: string
  eccentricity: string
  semi_major_axis: string
  inclination: string
  ascending_node_longitude: string
  orbital_period: string
  perihelion_distance: string
  aphelion_distance: string
  perihelion_argument: string
  aphelion_argument: string
  longitude_of_perihelion: string
  longitude_of_ascending_node: string
  mean_anomaly: string
}

export type CometData = {
  full_name: string
  des: string
  orbit_class: string
  albedo?: number
  diameter?: number
  H?: number
  period_yr?: number
  semimajor_au?: number
  eccentricity?: number
  inclination?: number
  arg_perihelion?: number
  long_asc_node?: number
  mean_anomaly?: number
  epoch_mjd?: number
}

export type SatelliteData = {
  name: string
  type: string
  orbit?: string
  location?: string
}

// Core Ephemeris Functions
export async function getEphem(ids: string[], start: string, stop: string, step = '6 h', center = '500@0'): Promise<EphemSet[]> {
  const url = new URL('/api/ephem', API_BASE)
  url.searchParams.set('horizons_ids', ids.join(','))
  url.searchParams.set('start', start)
  url.searchParams.set('stop', stop)
  url.searchParams.set('step', step)
  url.searchParams.set('center', center)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`ephem ${r.status}`)
  return r.json()
}

// Enhanced SBDB Functions
export async function listNEO(limit = 100): Promise<{count: number, data: any[]}> {
  const url = new URL('/api/sbdb/neo', API_BASE)
  url.searchParams.set('limit', String(limit))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`neo ${r.status}`)
  return r.json()
}

export async function listComets(limit = 50): Promise<{count: number, data: CometData[]}> {
  const url = new URL('/api/sbdb/comets', API_BASE)
  url.searchParams.set('limit', String(limit))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`comets ${r.status}`)
  return r.json()
}

export async function listAsteroids(limit = 100): Promise<{count: number, data: any[]}> {
  const url = new URL('/api/sbdb/asteroids', API_BASE)
  url.searchParams.set('limit', String(limit))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`asteroids ${r.status}`)
  return r.json()
}

export async function getSBDBObject(des: string): Promise<any> {
  const url = new URL('/api/sbdb/object', API_BASE)
  url.searchParams.set('des', des)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`sbdb ${r.status}`)
  return r.json()
}

// NASA API Functions
export async function getAPOD(date?: string, count = 1): Promise<APODData | APODData[]> {
  const url = new URL('/api/nasa/apod', API_BASE)
  if (date) url.searchParams.set('date', date)
  if (count > 1) url.searchParams.set('count', String(count))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`apod ${r.status}`)
  return r.json()
}

export async function getExoplanets(limit = 100): Promise<ExoplanetData[]> {
  const url = new URL('/api/nasa/exoplanets', API_BASE)
  url.searchParams.set('limit', String(limit))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`exoplanets ${r.status}`)
  return r.json()
}

export async function getMarsRoverPhotos(rover = 'curiosity', sol?: number, earth_date?: string, camera?: string): Promise<{photos: MarsRoverPhoto[]}> {
  const url = new URL('/api/nasa/mars-rover', API_BASE)
  url.searchParams.set('rover', rover)
  if (sol !== undefined) url.searchParams.set('sol', String(sol))
  if (earth_date) url.searchParams.set('earth_date', earth_date)
  if (camera) url.searchParams.set('camera', camera)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`mars-rover ${r.status}`)
  return r.json()
}

export async function getSpaceWeather(): Promise<{
  flr: SpaceWeatherEvent[]
  sep: any[]
  cme: any[]
  gst: any[]
}> {
  const url = new URL('/api/nasa/space-weather', API_BASE)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`space-weather ${r.status}`)
  return r.json()
}

export async function getAsteroidWatch(start_date?: string, end_date?: string): Promise<{element_count: number, near_earth_objects: Record<string, AsteroidData[]>}> {
  const url = new URL('/api/nasa/asteroid-watch', API_BASE)
  if (start_date) url.searchParams.set('start_date', start_date)
  if (end_date) url.searchParams.set('end_date', end_date)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`asteroid-watch ${r.status}`)
  return r.json()
}

export async function getSatellites(): Promise<Record<string, SatelliteData>> {
  const url = new URL('/api/satellites', API_BASE)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`satellites ${r.status}`)
  return r.json()
}

// Utility function to get all available data
export async function getAllSolarSystemData() {
  try {
    const [neos, comets, asteroids, spaceWeather, asteroidWatch, satellites] = await Promise.allSettled([
      listNEO(50),
      listComets(25),
      listAsteroids(50),
      getSpaceWeather(),
      getAsteroidWatch(),
      getSatellites()
    ])

    return {
      neos: neos.status === 'fulfilled' ? neos.value : null,
      comets: comets.status === 'fulfilled' ? comets.value : null,
      asteroids: asteroids.status === 'fulfilled' ? asteroids.value : null,
      spaceWeather: spaceWeather.status === 'fulfilled' ? spaceWeather.value : null,
      asteroidWatch: asteroidWatch.status === 'fulfilled' ? asteroidWatch.value : null,
      satellites: satellites.status === 'fulfilled' ? satellites.value : null
    }
  } catch (error) {
    console.error('Failed to fetch solar system data:', error)
    return null
  }
}