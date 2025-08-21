import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function DebugOrbitCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    console.log('🚀 Starting debug canvas...')

    // Create basic Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)
    console.log('✅ Scene created')

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000)
    camera.position.set(0, 0, 15)
    console.log('✅ Camera created at:', camera.position)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    console.log('✅ Renderer created and added to DOM')

    // Add basic lighting
    const light = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(light)
    const pointLight = new THREE.PointLight(0xffffff, 1)
    pointLight.position.set(10, 10, 10)
    scene.add(pointLight)
    console.log('✅ Lights added')

    // Create a simple red cube to test visibility
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.set(0, 0, 0)
    scene.add(cube)
    console.log('✅ Red cube added at origin')

    // Create a yellow sphere (Sun test)
    const sphereGeo = new THREE.SphereGeometry(3, 32, 16)
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00 })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.set(5, 0, 0)
    scene.add(sphere)
    console.log('✅ Yellow sphere added at (5,0,0)')

    // Animation loop
    const animate = () => {
      cube.rotation.x += 0.01
      cube.rotation.y += 0.01
      
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()
    console.log('✅ Animation started')

    // Test render immediately
    renderer.render(scene, camera)
    console.log('✅ First render complete')
    console.log('📊 Scene stats:')
    console.log('  - Children:', scene.children.length)
    console.log('  - Camera position:', camera.position)
    console.log('  - Renderer size:', renderer.getSize(new THREE.Vector2()))

    return () => {
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '400px', 
        border: '2px solid red',
        background: '#222'
      }}
    />
  )
}