import React, { useEffect, useMemo, useRef, useState } from 'react'
import OrbitCanvas from './components/OrbitCanvas'
import InfoDrawer, { Info } from './components/InfoDrawer'
import { getEphem, listNEO, EphemSet } from './lib/api'

export default function App(){
  const [sets, setSets] = useState<EphemSet[]>([])
  const [loading, setLoading] = useState(false)
  const [idx, setIdx] = useState(0)
  const [maxIdx, setMaxIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [info, setInfo] = useState<Info|null>(null)
  const timer = useRef<number | null>(null)

  const range = useMemo(() => {
    // default: a 10-day window from today
    const start = new Date()
    const stop = new Date(Date.now() + 10*24*3600*1000)
    const fmt = (d: Date) => d.toISOString().slice(0,10) // YYYY-MM-DD
    return { start: fmt(start), stop: fmt(stop), step: '6 h' }
  }, [])

  useEffect(() => {
    setLoading(true)
    // Earth=399, Mars=499 (Sun-centered 500@0)
    getEphem(['399','499'], range.start, range.stop, range.step, '500@0')
      .then(data => {
        setSets(data)
        const samples = Math.max(...data.map(d => d.states.length))
        setMaxIdx(Math.max(0, samples-1))
      })
      .catch(err => {
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [range.start, range.stop, range.step])

  useEffect(() => {
    if (!playing) { if (timer.current) cancelAnimationFrame(timer.current); return }
    const tick = () => {
      setIdx(i => (i+0.25) % (maxIdx>0?maxIdx:1))
      timer.current = requestAnimationFrame(tick)
    }
    timer.current = requestAnimationFrame(tick)
    return () => { if (timer.current) cancelAnimationFrame(timer.current) }
  }, [playing, maxIdx])

  const onPick = (tag: { id: string, label: string, kind: Info['kind'] }) => {
    setInfo({ id: tag.id, label: tag.label, kind: tag.kind, extra: { source: 'Horizons' }})
  }

  return (
    <div id="app">
      <div className="header">
        <h1>Solar System Viewer</h1>
        <div className="controls">
          <button className="btn" onClick={()=>setPlaying(p=>!p)}>{playing? 'Pause' : 'Play'}</button>
          <input className="range" type="range" min={0} max={maxIdx||0} step={0.01} value={idx} onChange={e=>setIdx(parseFloat(e.target.value))}/>
          <span style={{opacity:.7}}>frame {idx.toFixed(0)} / {maxIdx}</span>
          {loading && <span className="spinner" />}
        </div>
      </div>
      <div className="canvas-wrap">
        <div className="legend">
          <div><strong>Tips</strong></div>
          <div>• Drag to orbit camera • Scroll to zoom</div>
          <div>• Click a body to inspect</div>
        </div>
        <OrbitCanvas sets={sets} frameIndex={idx} onPick={onPick} />
        <InfoDrawer info={info} onClose={()=>setInfo(null)} />
      </div>
    </div>
  )
}