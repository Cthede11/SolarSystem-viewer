interface PlanetData {
  size: number
  color: number
  orbitColor: number
}import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { positionAt } from '../lib/ephem'
import type { EphemSet } from '../lib/api'
import type { ViewSettings, ClickInfo } from '../types'

// Scale constants
const VIEWING_SCALE = 1 / 50_000_000  // 1 unit = 50 million km (for visibility)
const REALISTIC_SCALE = 1 / 149_597_870.7  // 1 unit = 1 AU (realistic distances)

interface OrbitCanvasProps {
  sets: EphemSet[]
  frameIndex: number
  onPick: (info: ClickInfo) => void
  settings: ViewSettings
}

export default function OrbitCanvas({ sets, frameIndex, onPick, settings }: OrbitCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const objsRef = useRef<Record<string, THREE.Object3D>>({})
  const orbitLinesRef = useRef<Record<string, THREE.Line>>({})
  const animationIdRef = useRef<number>()
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())

  // Camera controls state
  const controlsRef = useRef({
    isMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    cameraDistance: 15,
    cameraTheta: 0,
    cameraPhi: Math.PI / 4,
    followOffset: new THREE.Vector3(0, 5, 10),
    targetPosition: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
    isTransitioning: false
  })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    console.log('🚀 Starting solar system...')

    // Create scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)

    // Setup camera with adaptive initial distance
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1e9)
    const updateCameraPosition = (smooth = false) => {
      const controls = controlsRef.current
      
      // Handle following a planet
      if (settings.followPlanet && objsRef.current[settings.followPlanet]) {
        const target = objsRef.current[settings.followPlanet]
        const targetPos = target.position.clone()
        
        // Calculate appropriate distance based on object and scale
        let followDistance = 10
        if (settings.followPlanet === '10') { // Sun
          followDistance = settings.useRealisticSizes ? 0.5 : 8
        } else {
          followDistance = settings.useRealisticScale ? 2 : 6
        }
        
        const offset = new THREE.Vector3(0, followDistance * 0.3, followDistance)
        const newPos = targetPos.clone().add(offset)
        
        if (smooth && !controls.isTransitioning) {
          // Smooth transition to new position
          controls.isTransitioning = true
          controls.targetPosition.copy(newPos)
          controls.targetLookAt.copy(targetPos)
        } else if (!smooth || controls.isTransitioning) {
          camera.position.copy(newPos)
          camera.lookAt(targetPos)
        }
      } else {
        // Free camera mode
        camera.position.x = controls.cameraDistance * Math.sin(controls.cameraPhi) * Math.cos(controls.cameraTheta)
        camera.position.y = controls.cameraDistance * Math.cos(controls.cameraPhi)
        camera.position.z = controls.cameraDistance * Math.sin(controls.cameraPhi) * Math.sin(controls.cameraTheta)
        camera.lookAt(0, 0, 0)
        controls.isTransitioning = false
      }
    }
    
    // Set initial camera distance based on scale mode
    controlsRef.current.cameraDistance = settings.useRealisticScale ? 5 : 15
    updateCameraPosition()

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3)
    scene.add(ambientLight)
    
    const sunLight = new THREE.PointLight(0xffffff, 2, 0)
    sunLight.position.set(0, 0, 0)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    scene.add(sunLight)

    // Create grid
    const grid = new THREE.GridHelper(30, 30, 0x333344, 0x222233)
    grid.material.transparent = true
    grid.material.opacity = 0.4
    scene.add(grid)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer

    // Mouse controls
    const onMouseDown = (e: MouseEvent) => {
      controlsRef.current.isMouseDown = true
      controlsRef.current.lastMouseX = e.clientX
      controlsRef.current.lastMouseY = e.clientY
    }

    const onMouseUp = () => {
      controlsRef.current.isMouseDown = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!controlsRef.current.isMouseDown) return
      
      // Only allow manual camera control when not following a planet
      if (settings.followPlanet) return
      
      const deltaX = e.clientX - controlsRef.current.lastMouseX
      const deltaY = e.clientY - controlsRef.current.lastMouseY
      
      controlsRef.current.cameraTheta -= deltaX * 0.01
      controlsRef.current.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, controlsRef.current.cameraPhi + deltaY * 0.01))
      
      updateCameraPosition()
      
      controlsRef.current.lastMouseX = e.clientX
      controlsRef.current.lastMouseY = e.clientY
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (settings.followPlanet) {
        // Adjust follow distance when following a planet
        const offset = controlsRef.current.followOffset
        const factor = e.deltaY > 0 ? 1.1 : 0.9
        offset.multiplyScalar(factor)
        // Clamp the follow distance
        const dist = offset.length()
        if (dist < 0.1) offset.normalize().multiplyScalar(0.1)
        if (dist > 100) offset.normalize().multiplyScalar(100)
        updateCameraPosition()
      } else {
        // Normal zoom for free camera
        controlsRef.current.cameraDistance *= e.deltaY > 0 ? 1.1 : 0.9
        const maxDist = settings.useRealisticScale ? 10 : 100
        controlsRef.current.cameraDistance = Math.max(0.1, Math.min(maxDist, controlsRef.current.cameraDistance))
        updateCameraPosition()
      }
    }

    // Click handling with raycasting
    const onClick = (e: MouseEvent) => {
      if (!renderer || !camera) return
      
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      raycaster.current.setFromCamera(mouse.current, camera)
      
      const meshes = Object.values(objsRef.current).filter(obj => obj instanceof THREE.Mesh)
      const intersects = raycaster.current.intersectObjects(meshes)
      
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object
        const pickData = clickedObject.userData.pick as ClickInfo
        if (pickData) {
          console.log('🖱️ Clicked:', pickData.label)
          onPick(pickData)
        }
      }
    }

    // Window resize handler
    const onResize = () => {
      if (!mount || !renderer || !camera) return
      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    // Event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('wheel', onWheel)
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)

    // Animation loop with smooth camera transitions
    const animate = () => {
      // Handle smooth camera transitions
      if (controlsRef.current.isTransitioning) {
        camera.position.lerp(controlsRef.current.targetPosition, 0.05)
        const currentLookAt = new THREE.Vector3()
        camera.getWorldDirection(currentLookAt)
        currentLookAt.multiplyScalar(-1).add(camera.position)
        currentLookAt.lerp(controlsRef.current.targetLookAt, 0.05)
        camera.lookAt(currentLookAt)
        
        // Check if transition is complete
        if (camera.position.distanceTo(controlsRef.current.targetPosition) < 0.1) {
          controlsRef.current.isTransitioning = false
        }
      }
      
      renderer.render(scene, camera)
      animationIdRef.current = requestAnimationFrame(animate)
    }
    animationIdRef.current = requestAnimationFrame(animate)

    console.log('✅ Basic setup complete')

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      
      // Remove event listeners
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Add celestial objects when data is available
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !sets.length) return

    console.log('🪐 Adding celestial objects...', sets.length, 'sets')
    console.log('🔧 Scale mode:', settings.useRealisticScale ? 'Realistic' : 'Viewing')
    console.log('📏 Size mode:', settings.useRealisticSizes ? 'Realistic' : 'Enhanced')

    // Clear previous objects (keep lights and grid)
    Object.values(objsRef.current).forEach(obj => scene.remove(obj))
    Object.values(orbitLinesRef.current).forEach(line => scene.remove(line))
    objsRef.current = {}
    orbitLinesRef.current = {}

    // Get the appropriate scaling
    const distanceScale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE

    // Add Sun - size based on settings
    const sunRadius = settings.useRealisticSizes ? REAL_SIZES.sun * distanceScale : 1.0
    const sunGeo = new THREE.SphereGeometry(Math.max(0.3, sunRadius), 32, 16)
    const sunMat = new THREE.MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
      roughness: 1,
      metalness: 0
    })
    const sunMesh = new THREE.Mesh(sunGeo, sunMat)
    sunMesh.position.set(0, 0, 0)
    sunMesh.userData.pick = { id: '10', label: 'Sun', kind: 'star' }
    scene.add(sunMesh)
    objsRef.current['10'] = sunMesh
    console.log('☀️ Sun added at origin, radius:', Math.max(0.3, sunRadius).toExponential(2))

    // Add planets and their orbital paths
    sets.forEach((set, index) => {
      if (!set.states || set.states.length === 0) return

      const planetInfo = PLANET_DATA[set.id]
      const name = HORIZON_NAMES[set.id] || set.id

      // Calculate planet size based on settings
      let size: number
      if (settings.useRealisticSizes) {
        size = Math.max(0.02, (REAL_SIZES[set.id] || 6371) * distanceScale)
      } else {
        // Enhanced visibility size - smaller to prevent overlap
        const baseSize = planetInfo?.size || 0.8
        size = Math.min(0.8, baseSize * 0.2) // Much smaller enhanced sizes
      }

      // Create planet
      const geo = new THREE.SphereGeometry(size, 20, 16)
      const mat = new THREE.MeshStandardMaterial({ 
        color: planetInfo?.color || 0x9999ff,
        roughness: 0.8,
        metalness: 0.1
      })
      
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.pick = { id: set.id, label: name, kind: 'planet' }

      scene.add(mesh)
      objsRef.current[set.id] = mesh
      
      // Create orbit path from actual data (if enabled)
      if (settings.showOrbits && set.states.length > 1) {
        const orbitPoints: THREE.Vector3[] = []
        set.states.forEach(state => {
          const pos = [
            state.r[0] * distanceScale,
            state.r[1] * distanceScale, 
            state.r[2] * distanceScale
          ]
          orbitPoints.push(new THREE.Vector3(pos[0], pos[1], pos[2]))
        })
        
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints)
        const orbitMaterial = new THREE.LineBasicMaterial({ 
          color: planetInfo?.orbitColor || 0x666666,
          transparent: true,
          opacity: 0.6
        })
        const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial)
        scene.add(orbitLine)
        orbitLinesRef.current[set.id] = orbitLine
      }

      console.log(`🪐 ${name} added, size: ${size.toExponential(2)}`)
    })

    // Update grid size based on scale
    const gridObj = scene.children.find(child => child instanceof THREE.GridHelper)
    if (gridObj) {
      scene.remove(gridObj)
    }
    
    const gridSize = settings.useRealisticScale ? 5 : 30
    const grid = new THREE.GridHelper(gridSize, 20, 0x333344, 0x222233)
    grid.material.transparent = true
    grid.material.opacity = 0.4
    scene.add(grid)

    console.log('✅ All objects added, scene has', scene.children.length, 'children')
  }, [sets, settings])

  // Animate positions based on frameIndex
  useEffect(() => {
    if (!sets.length) return

    const objs = objsRef.current
    const distanceScale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
    
    sets.forEach(set => {
      const mesh = objs[set.id] as THREE.Mesh
      if (!mesh || !set.states || set.states.length === 0) return

      try {
        // Get position from actual ephemeris data
        const r = positionAt(set.states, frameIndex)
        if (r && r.every(coord => isFinite(coord))) {
          // Scale positions to scene units
          const scaledPos = [
            r[0] * distanceScale,
            r[1] * distanceScale, 
            r[2] * distanceScale
          ]
          
          // Validate position is reasonable
          const distance = Math.sqrt(scaledPos[0]**2 + scaledPos[1]**2 + scaledPos[2]**2)
          const maxDist = settings.useRealisticScale ? 50 : 100
          if (distance > 0.001 && distance < maxDist) {
            mesh.position.set(scaledPos[0], scaledPos[1], scaledPos[2])
          }
        }
      } catch (error) {
        console.warn(`Position error for ${set.id}:`, error)
      }
    })
  }, [frameIndex, sets, settings])

  // Handle camera transitions when following planet changes
  useEffect(() => {
    if (settings.followPlanet && cameraRef.current) {
      const controls = controlsRef.current
      if (objsRef.current[settings.followPlanet]) {
        const target = objsRef.current[settings.followPlanet]
        const targetPos = target.position.clone()
        
        // Calculate appropriate distance based on object and scale
        let followDistance = 10
        if (settings.followPlanet === '10') { // Sun
          followDistance = settings.useRealisticSizes ? 0.5 : 8
        } else {
          followDistance = settings.useRealisticScale ? 2 : 6
        }
        
        const offset = new THREE.Vector3(0, followDistance * 0.3, followDistance)
        controls.targetPosition.copy(targetPos).add(offset)
        controls.targetLookAt.copy(targetPos)
        controls.isTransitioning = true
      }
    }
  }, [settings.followPlanet, settings.useRealisticScale, settings.useRealisticSizes])

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        background: '#0b0f16',
        cursor: 'grab'
      }}
    />
  )
}

const HORIZON_NAMES: Record<string, string> = {
  '199': 'Mercury', '299': 'Venus', '399': 'Earth', '499': 'Mars',
  '599': 'Jupiter', '699': 'Saturn', '799': 'Uranus', '899': 'Neptune'
}

interface PlanetData {
  size: number
  color: number
  orbitColor: number
}

// Real planetary radii in kilometers
const REAL_SIZES: Record<string, number> = {
  sun: 696000,     // Sun radius
  '199': 2439.7,   // Mercury
  '299': 6051.8,   // Venus  
  '399': 6371.0,   // Earth
  '499': 3389.5,   // Mars
  '599': 69911,    // Jupiter
  '699': 58232,    // Saturn
  '799': 25362,    // Uranus
  '899': 24622     // Neptune
}

const PLANET_DATA: Record<string, PlanetData> = {
  '199': { size: 1.2, color: 0x8c7853, orbitColor: 0x8c7853 },
  '299': { size: 1.8, color: 0xffcc33, orbitColor: 0xffcc33 },
  '399': { size: 1.8, color: 0x6ec6ff, orbitColor: 0x6ec6ff },
  '499': { size: 1.5, color: 0xff785a, orbitColor: 0xff785a },
  '599': { size: 3.5, color: 0xd8ca9d, orbitColor: 0xd8ca9d },
  '699': { size: 3.0, color: 0xfad5a5, orbitColor: 0xfad5a5 },
  '799': { size: 2.2, color: 0x4fd0e4, orbitColor: 0x4fd0e4 },
  '899': { size: 2.2, color: 0x4b70dd, orbitColor: 0x4b70dd }
}