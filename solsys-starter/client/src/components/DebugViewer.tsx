import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Debug component to test frame positioning
export default function DebugFrameIssue() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cubeRef = useRef<THREE.Mesh>()
  const animationIdRef = useRef<number>()
  
  const [frameIndex, setFrameIndex] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  
  const addDebugInfo = (message: string) => {
    console.log(message)
    setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // Mock ephemeris data - simple orbital motion
  const mockStates = Array.from({ length: 100 }, (_, i) => {
    const angle = (i / 100) * Math.PI * 2
    const radius = 20
    return {
      t: new Date(Date.now() + i * 86400000).toISOString(), // Daily steps
      r: [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ] as [number, number, number],
      v: [0, 0, 0] as [number, number, number]
    }
  })

  const positionAt = (states: typeof mockStates, fIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(fIndex, states.length - 1))
    const i0 = Math.floor(clampedIndex)
    const i1 = Math.min(states.length - 1, i0 + 1)
    const t = clampedIndex - i0
    
    const r0 = states[i0].r
    const r1 = states[i1].r
    
    const result = [
      r0[0] + (r1[0] - r0[0]) * t,
      r0[1] + (r1[1] - r0[1]) * t,
      r0[2] + (r1[2] - r0[2]) * t
    ] as [number, number, number]
    
    addDebugInfo(`Position calc: frame=${fIndex.toFixed(2)}, i0=${i0}, i1=${i1}, t=${t.toFixed(3)}, result=[${result.map(v => v.toFixed(1)).join(',')}]`)
    
    return result
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // Setup Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111122)
    
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000)
    camera.position.set(0, 30, 50)
    camera.lookAt(0, 0, 0)
    
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)
    
    // Create test objects
    // Central sun
    const sunGeometry = new THREE.SphereGeometry(2, 16, 16)
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    const sun = new THREE.Mesh(sunGeometry, sunMaterial)
    scene.add(sun)
    
    // Orbiting planet (this will move with frames)
    const planetGeometry = new THREE.SphereGeometry(1, 16, 16)
    const planetMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff })
    const planet = new THREE.Mesh(planetGeometry, planetMaterial)
    scene.add(planet)
    cubeRef.current = planet
    
    // Orbit path visualization
    const orbitPoints = mockStates.map(state => new THREE.Vector3(state.r[0], state.r[1], state.r[2]))
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints)
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x888888 })
    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial)
    scene.add(orbitLine)
    
    // Grid for reference
    const gridHelper = new THREE.GridHelper(100, 10, 0x444444, 0x222222)
    scene.add(gridHelper)
    
    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    
    addDebugInfo('✅ Scene setup complete')
    addDebugInfo(`📊 Mock states created: ${mockStates.length} frames`)

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  // Update planet position when frame changes
  useEffect(() => {
    const planet = cubeRef.current
    if (!planet) {
      addDebugInfo('❌ Planet mesh not found')
      return
    }

    addDebugInfo(`🔄 Frame changed to: ${frameIndex}`)
    
    try {
      const position = positionAt(mockStates, frameIndex)
      const oldPos = planet.position.clone()
      
      planet.position.set(position[0], position[1], position[2])
      
      const distance = oldPos.distanceTo(planet.position)
      addDebugInfo(`📍 Planet moved: [${position.map(v => v.toFixed(1)).join(',')}], distance moved: ${distance.toFixed(2)}`)
      
      // Check if planet is visible
      const camera = cameraRef.current
      if (camera) {
        const distanceFromCamera = camera.position.distanceTo(planet.position)
        addDebugInfo(`👁️ Distance from camera: ${distanceFromCamera.toFixed(1)}`)
        
        if (distanceFromCamera > 1000) {
          addDebugInfo('⚠️ Planet very far from camera!')
        }
      }
      
    } catch (error) {
      addDebugInfo(`❌ Position update error: ${error}`)
    }
  }, [frameIndex])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          border: '2px solid #00ff00'
        }} 
      />
      
      {/* Controls */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxWidth: '400px',
        zIndex: 1000
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>Frame Debug Test</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Frame: {frameIndex.toFixed(1)} / {mockStates.length - 1}
          </label>
          <input
            type="range"
            min={0}
            max={mockStates.length - 1}
            step={0.1}
            value={frameIndex}
            onChange={(e) => setFrameIndex(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => setFrameIndex(0)}
            style={{ marginRight: '5px', padding: '5px 10px' }}
          >
            Reset
          </button>
          <button
            onClick={() => setFrameIndex(25)}
            style={{ marginRight: '5px', padding: '5px 10px' }}
          >
            25%
          </button>
          <button
            onClick={() => setFrameIndex(50)}
            style={{ marginRight: '5px', padding: '5px 10px' }}
          >
            50%
          </button>
          <button
            onClick={() => setFrameIndex(75)}
            style={{ padding: '5px 10px' }}
          >
            75%
          </button>
        </div>
        
        <div style={{ fontSize: '11px' }}>
          <strong>Expected:</strong><br/>
          • Blue planet orbits around yellow sun<br/>
          • Gray orbit line shows path<br/>
          • Planet should always be visible<br/>
          • Debug info shows position updates
        </div>
      </div>

      {/* Debug Log */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '10px',
        maxWidth: '350px',
        maxHeight: '300px',
        overflow: 'auto',
        zIndex: 1000
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#ffff00' }}>Debug Log:</h4>
        {debugInfo.map((info, i) => (
          <div key={i} style={{ marginBottom: '2px', wordBreak: 'break-all' }}>
            {info}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        maxWidth: '250px'
      }}>
        <strong>Test Instructions:</strong><br/>
        1. Move the frame slider<br/>
        2. Blue planet should orbit smoothly<br/>
        3. Check debug log for position data<br/>
        4. If planet disappears, check console<br/>
        <br/>
        <strong style={{ color: '#ff4444' }}>Report back:</strong><br/>
        Does the planet stay visible?
      </div>
    </div>
  )
}