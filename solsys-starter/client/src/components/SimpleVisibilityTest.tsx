import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Simple test to verify Three.js objects are visible
export default function SimpleVisibilityTest() {
  const mountRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<() => void>()

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    console.log('🚀 Creating simple test scene')

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)

    // Camera - exactly like your app
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.01, 1000)
    camera.position.set(0, 8, 15)
    camera.lookAt(0, 0, 0)
    console.log('📹 Camera positioned at:', camera.position)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(5, 5, 5)
    scene.add(directional)

    // Create objects EXACTLY like your log shows
    // Sun: size 6.0 at origin
    const sunGeo = new THREE.SphereGeometry(6.0, 32, 16)
    const sunMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd27d, 
      emissive: 0x996611, 
      emissiveIntensity: 0.3 
    })
    const sun = new THREE.Mesh(sunGeo, sunMat)
    sun.position.set(0, 0, 0)
    scene.add(sun)
    console.log('☀️ Sun created: size 6.0 at (0,0,0)')

    // Mercury: size 1.2 at [-1.4, 0.2, 0.0]
    const mercuryGeo = new THREE.SphereGeometry(1.2, 24, 16)
    const mercuryMat = new THREE.MeshStandardMaterial({ color: 0x8c7853 })
    const mercury = new THREE.Mesh(mercuryGeo, mercuryMat)
    mercury.position.set(-1.4, 0.2, 0.0)
    scene.add(mercury)
    console.log('🪐 Mercury created: size 1.2 at (-1.4, 0.2, 0.0)')

    // Venus: size 1.8 at [-1.0, -1.9, -0.1]
    const venusGeo = new THREE.SphereGeometry(1.8, 24, 16)
    const venusMat = new THREE.MeshStandardMaterial({ color: 0xffcc33 })
    const venus = new THREE.Mesh(venusGeo, venusMat)
    venus.position.set(-1.0, -1.9, -0.1)
    scene.add(venus)
    console.log('🪐 Venus created: size 1.8 at (-1.0, -1.9, -0.1)')

    // Earth: size 1.8 at [-2.0, -2.3, 0.0]
    const earthGeo = new THREE.SphereGeometry(1.8, 24, 16)
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x6ec6ff })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    earth.position.set(-2.0, -2.3, 0.0)
    scene.add(earth)
    console.log('🪐 Earth created: size 1.8 at (-2.0, -2.3, 0.0)')

    // Mars: size 1.44 at [-3.7, -3.1, -0.1]
    const marsGeo = new THREE.SphereGeometry(1.44, 24, 16)
    const marsMat = new THREE.MeshStandardMaterial({ color: 0xff785a })
    const mars = new THREE.Mesh(marsGeo, marsMat)
    mars.position.set(-3.7, -3.1, -0.1)
    scene.add(mars)
    console.log('🪐 Mars created: size 1.44 at (-3.7, -3.1, -0.1)')

    // Grid for reference
    const grid = new THREE.GridHelper(20, 20, 0x233048, 0x182238)
    scene.add(grid)
    console.log('✅ Grid added')

    // Calculate distances like your app
    const objects = [
      { name: 'Sun', pos: new THREE.Vector3(0, 0, 0) },
      { name: 'Mercury', pos: new THREE.Vector3(-1.4, 0.2, 0.0) },
      { name: 'Venus', pos: new THREE.Vector3(-1.0, -1.9, -0.1) },
      { name: 'Earth', pos: new THREE.Vector3(-2.0, -2.3, 0.0) },
      { name: 'Mars', pos: new THREE.Vector3(-3.7, -3.1, -0.1) }
    ]

    objects.forEach(obj => {
      const distance = camera.position.distanceTo(obj.pos)
      console.log(`👁️ Distance to ${obj.name}: ${distance.toFixed(1)}`)
    })

    console.log(`📊 Total scene children: ${scene.children.length}`)

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      
      // Rotate objects slightly for visual confirmation
      sun.rotation.y += 0.005
      mercury.rotation.y += 0.02
      venus.rotation.y += 0.01
      earth.rotation.y += 0.02
      mars.rotation.y += 0.015
      
      renderer.render(scene, camera)
    }

    animate()
    console.log('🎬 Animation started')

    // Manual mouse controls for debugging
    let mouseDown = false
    let mouseX = 0, mouseY = 0

    const onMouseDown = (e: MouseEvent) => {
      mouseDown = true
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return
      
      const deltaX = e.clientX - mouseX
      const deltaY = e.clientY - mouseY
      
      // Simple orbit controls
      const spherical = new THREE.Spherical()
      spherical.setFromVector3(camera.position)
      spherical.theta -= deltaX * 0.01
      spherical.phi += deltaY * 0.01
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi))
      
      camera.position.setFromSpherical(spherical)
      camera.lookAt(0, 0, 0)
      
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const onMouseUp = () => {
      mouseDown = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const scale = Math.pow(0.95, e.deltaY * 0.01)
      camera.position.multiplyScalar(scale)
      console.log('📹 Camera distance:', camera.position.length().toFixed(1))
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // Cleanup function
    cleanupRef.current = () => {
      console.log('🧹 Cleaning up test scene')
      cancelAnimationFrame(animationId)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }

    return cleanupRef.current
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div 
        ref={mountRef} 
        style={{ width: '100%', height: '100%' }}
      />
      
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 1000
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>Visibility Test</h3>
        <div><strong>Expected:</strong></div>
        <div>☀️ Large yellow sun in center</div>
        <div>🪐 Mercury (brown) upper left</div>
        <div>🪐 Venus (yellow) lower left</div>
        <div>🪐 Earth (blue) lower left</div>
        <div>🪐 Mars (red) far lower left</div>
        <div>⚫ Grid lines on ground</div>
        <br/>
        <div><strong>Camera:</strong> (0, 8, 15)</div>
        <div><strong>Sun size:</strong> 6.0 units</div>
        <div><strong>Planet sizes:</strong> 1.2-1.8 units</div>
        <br/>
        <div style={{ fontSize: '10px', color: '#ffff00' }}>
          Drag to orbit • Scroll to zoom<br/>
          Check browser console for logs
        </div>
      </div>
    </div>
  )
}