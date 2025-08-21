import React from 'react'

export type Info = {
  id: string
  label: string
  kind: 'planet' | 'star' | 'dwarf' | 'small' | 'spacecraft'
  extra?: Record<string, any>
}

export default function InfoDrawer({ info, onClose }: { info: Info | null, onClose: () => void }){
  if (!info) return null
  return (
    <div className="info">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>{info.label}</h3>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:8}}>
        <span className="badge">{info.kind}</span>
        {info.extra?.source && <span className="badge">{info.extra.source}</span>}
      </div>
      <small>ID: {info.id}</small>
      {info.extra?.details && (
        <div style={{marginTop:10}}>
          <pre style={{whiteSpace:'pre-wrap'}}>{info.extra.details}</pre>
        </div>
      )}
    </div>
  )
}