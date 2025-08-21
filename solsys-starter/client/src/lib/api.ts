const API_BASE = (globalThis as any).__API_BASE__ as string

export type EphemState = { t: string; r: [number,number,number]; v: [number,number,number] }
export type EphemSet = { id: string; center: string; states: EphemState[]; error?: string }

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

export async function listNEO(limit = 25) {
  const url = new URL('/api/sbdb/neo', API_BASE)
  url.searchParams.set('limit', String(limit))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`neo ${r.status}`)
  return r.json()
}

export async function getSBDBObject(des: string) {
  const url = new URL('/api/sbdb/object', API_BASE)
  url.searchParams.set('des', des)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`sbdb ${r.status}`)
  return r.json()
}