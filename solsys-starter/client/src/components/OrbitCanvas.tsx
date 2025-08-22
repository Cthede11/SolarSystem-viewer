import React, { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { positionAt } from '../lib/ephem'
import type { EphemSet } from '../lib/api'
import type { ViewSettings, ClickInfo } from '../types'

type SelectDetail = { id: string | null }
const SELECT_EVENT = 'app:select'

// Scale constants
const VIEWING_SCALE = 1 / 50_000_000
const REALISTIC_SCALE = 1 / 149_597_870.7 // 1 AU = 1 unit
const MAX_VIEWING_DISTANCE = 200
const MAX_REALISTIC_DISTANCE = 50

// Realistic mode settings - carefully calculated
const REALISTIC_CAMERA_DISTANCE = 50 // AU - far enough to see whole solar system
const REALISTIC_PLANET_SIZE_BOOST = 1000 // Make planets visible but not overwhelming
const REALISTIC_SUN_SIZE_BOOST = 100 // Smaller boost for sun to prevent engulfing everything

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
  
  // Add initialization state to prevent race conditions
  const initStateRef = useRef({
    objectsCreated: false,
    lastSetsHash: '',
    lastSettingsHash: ''
  })

  // Enhanced camera controls
  const controlsRef = useRef({
    isMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    mouseMoved: false,
    mouseButton: 0,
    cameraDistance: 15,
    cameraTheta: 0,
    cameraPhi: Math.PI / 4,
    focusTarget: null as string | null,
    focusDistance: 8,
    focusTheta: 0,
    focusPhi: Math.PI / 4,
    autoOrbitEnabled: true,
    autoOrbitTimer: 0,
    focusLastUpdate: 0
  })

  // Helper function to create hash for comparison
  const createHash = useCallback((obj: any) => JSON.stringify(obj), [])

  // Stable functions that won't change between renders
  const sphericalToCartesian = useCallback((r: number, theta: number, phi: number) =>
    new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta), 
      r * Math.cos(phi), 
      r * Math.sin(phi) * Math.sin(theta)
    ), [])

  const updateCameraPosition = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return

    const controls = controlsRef.current
    let newPosition: THREE.Vector3
    let newLookAt = new THREE.Vector3()

    if (controls.focusTarget && objsRef.current[controls.focusTarget]) {
      const targetObj = objsRef.current[controls.focusTarget]
      newLookAt.copy(targetObj.position)
      const relativePos = sphericalToCartesian(controls.focusDistance, controls.focusTheta, controls.focusPhi)
      newPosition = newLookAt.clone().add(relativePos)
    } else {
      newLookAt.set(0, 0, 0)
      newPosition = sphericalToCartesian(controls.cameraDistance, controls.cameraTheta, controls.cameraPhi)
    }

    camera.position.copy(newPosition)
    camera.lookAt(newLookAt)
  }, [sphericalToCartesian])

  const focusOnObject = useCallback((objectId: string) => {
    const obj = objsRef.current[objectId]
    if (!obj) {
      console.warn(`Cannot focus on ${objectId}: object not found`)
      return
    }
    
    console.log(`🎯 Focusing on ${objectId} at position:`, obj.position)
    
    const controls = controlsRef.current
    controls.focusTarget = objectId
    
    const objDistance = obj.position.length()
    let baseDistance: number
    
    if (objectId === '10') {
      baseDistance = settings.useRealisticSizes ? Math.max(8, objDistance * 0.1) : 12
    } else {
      if (settings.useRealisticScale) {
        baseDistance = Math.max(6, objDistance * 0.05)
      } else {
        baseDistance = 8
      }
    }
    
    controls.focusDistance = Math.min(Math.max(baseDistance, 3), 500)
    controls.focusTheta = Math.PI / 4
    controls.focusPhi = Math.PI / 3
    controls.focusLastUpdate = Date.now()
    controls.autoOrbitEnabled = false
    
    console.log(`🎯 Focus distance set to: ${controls.focusDistance.toFixed(1)}`)
    
    updateCameraPosition()
  }, [settings.useRealisticSizes, settings.useRealisticScale, updateCameraPosition])

  // Initialize Three.js scene ONCE with better state management
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) {
      console.error('❌ Mount element not found')
      return
    }

    console.log('🚀 INITIALIZING Three.js scene')

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75, 
      mount.clientWidth / mount.clientHeight, 
      0.01, 
      1e9
    )
    
    // Set initial camera position based on settings
    const initialDistance = settings.useRealisticScale ? REALISTIC_CAMERA_DISTANCE : 15
    camera.position.set(0, initialDistance * 0.5, initialDistance)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Update camera controls based on scale
    if (settings.useRealisticScale) {
      controlsRef.current.cameraDistance = REALISTIC_CAMERA_DISTANCE
      controlsRef.current.focusDistance = REALISTIC_CAMERA_DISTANCE * 0.3
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    rendererRef.current = renderer

    // Add renderer to DOM
    mount.appendChild(renderer.domElement)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambient)
    
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 0)
    sunLight.position.set(0, 0, 0)
    sunLight.castShadow = true
    scene.add(sunLight)

    // Star skybox
    const skyboxGeometry = new THREE.SphereGeometry(1000, 64, 32)
    const skyboxMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000011,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.8
    })
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial)
    scene.add(skybox)
    
    const starGeometry = new THREE.BufferGeometry()
    const starMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 1.5,
      sizeAttenuation: false
    })
    const starVertices: number[] = []
    const starCount = 3000
    
    for (let i = 0; i < starCount; i++) {
      const radius = 900
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      
      starVertices.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      )
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))
    const stars = new THREE.Points(starGeometry, starMaterial)
    scene.add(stars)

    // Event handlers
    const onMouseDown = (e: MouseEvent) => {
      const c = controlsRef.current
      c.isMouseDown = true
      c.mouseMoved = false
      c.lastMouseX = e.clientX
      c.lastMouseY = e.clientY
      c.mouseButton = e.button
      c.autoOrbitEnabled = false
      
      if (e.button === 2) {
        c.focusTarget = null
        updateCameraPosition()
      }
    }

    const onMouseUp = () => {
      const c = controlsRef.current
      c.isMouseDown = false
      if (c.focusTarget) {
        setTimeout(() => { c.autoOrbitEnabled = true }, 2000)
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      const c = controlsRef.current
      if (!c.isMouseDown) return
      
      const dx = e.clientX - c.lastMouseX
      const dy = e.clientY - c.lastMouseY
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) c.mouseMoved = true

      const sensitivity = 0.008
      
      if (c.mouseButton === 0) {
        if (c.focusTarget && objsRef.current[c.focusTarget]) {
          c.focusTheta -= dx * sensitivity
          c.focusPhi = Math.max(0.1, Math.min(Math.PI - 0.1, c.focusPhi + dy * sensitivity))
          c.focusLastUpdate = Date.now()
        } else {
          c.cameraTheta -= dx * sensitivity
          c.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, c.cameraPhi + dy * sensitivity))
        }
      }
      
      c.lastMouseX = e.clientX
      c.lastMouseY = e.clientY
      updateCameraPosition()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = controlsRef.current
      const zoom = Math.pow(0.95, -e.deltaY * 0.05)
      
      if (c.focusTarget && objsRef.current[c.focusTarget]) {
        c.focusDistance = Math.min(Math.max(c.focusDistance * zoom, 1.5), 200)
      } else {
        c.cameraDistance = Math.min(Math.max(c.cameraDistance * zoom, 2), 300)
      }
      updateCameraPosition()
    }

    const onClick = (e: MouseEvent) => {
      const c = controlsRef.current
      if (c.mouseMoved) return
      
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      raycaster.current.setFromCamera(mouse.current, camera)
      const meshes = Object.values(objsRef.current).filter(o => o instanceof THREE.Mesh)
      const hits = raycaster.current.intersectObjects(meshes)
      
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh
        const tag = hit.userData?.pick as ClickInfo | undefined
        if (tag?.id) {
          console.log('Clicked object:', tag)
          onPick(tag)
          window.dispatchEvent(new CustomEvent<SelectDetail>(SELECT_EVENT, { detail: { id: tag.id } }))
          focusOnObject(tag.id)
        }
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const c = controlsRef.current
      const speed = 0.2
      
      switch (e.code) {
        case 'KeyW': c.cameraPhi = Math.max(0.1, c.cameraPhi - speed); break
        case 'KeyS': c.cameraPhi = Math.min(Math.PI - 0.1, c.cameraPhi + speed); break
        case 'KeyA': c.cameraTheta -= speed; break
        case 'KeyD': c.cameraTheta += speed; break
        case 'KeyQ':
          if (c.focusTarget) c.focusDistance = Math.max(1.5, c.focusDistance * 0.9)
          else c.cameraDistance = Math.max(2, c.cameraDistance * 0.9)
          break
        case 'KeyE':
          if (c.focusTarget) c.focusDistance = Math.min(200, c.focusDistance * 1.1)
          else c.cameraDistance = Math.min(300, c.cameraDistance * 1.1)
          break
        case 'Space':
          e.preventDefault()
          c.focusTarget = null
          c.autoOrbitEnabled = false
          updateCameraPosition()
          break
      }
      updateCameraPosition()
    }

    const onResize = () => {
      if (!mount || !camera || !renderer) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }

    const onExternalSelect = (e: Event) => {
      const ce = e as CustomEvent<SelectDetail>
      const id = ce.detail?.id
      if (id && objsRef.current[id]) {
        focusOnObject(id)
      }
    }

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      
      const camera = cameraRef.current
      const renderer = rendererRef.current
      const scene = sceneRef.current
      
      if (!camera || !renderer || !scene) return

      const c = controlsRef.current
      if (c.focusTarget && c.autoOrbitEnabled && !c.isMouseDown) {
        if (Date.now() - c.focusLastUpdate > 3000) {
          c.focusTheta += 0.003
          updateCameraPosition()
        }
      }

      renderer.render(scene, camera)
    }

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault())
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    window.addEventListener(SELECT_EVENT, onExternalSelect)

    // Start animation
    animate()
    renderer.render(scene, camera)

    console.log('✅ Scene initialization completed')

    // Cleanup function
    return () => {
      console.log('🧹 Cleanup started')
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      
      // Remove event listeners
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      window.removeEventListener(SELECT_EVENT, onExternalSelect)
      
      // Clean up Three.js objects
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      
      // Dispose renderer
      renderer.dispose()
      
      // Clear object references
      objsRef.current = {}
      orbitLinesRef.current = {}
      
      // Reset state
      initStateRef.current.objectsCreated = false
      
      console.log('🧹 Cleanup completed')
    }
  }, []) // No dependencies - initialize once only

  // Separate effect for creating/updating objects with better state management
  useEffect(() => {
    const scene = sceneRef.current
    const initState = initStateRef.current
    
    // Don't create objects until scene exists
    if (!scene) {
      console.log('⚠️ Scene not ready for objects')
      return
    }

    // Check if we need to update objects
    const setsHash = createHash(sets)
    const settingsHash = createHash({
      useRealisticScale: settings.useRealisticScale,
      useRealisticSizes: settings.useRealisticSizes,
      showOrbits: settings.showOrbits
    })

    const needsUpdate = 
      setsHash !== initState.lastSetsHash ||
      settingsHash !== initState.lastSettingsHash ||
      !initState.objectsCreated

    if (!needsUpdate) {
      console.log('⚠️ No object changes needed')
      return
    }

    console.log('🔄 Creating/updating objects', { 
      setsLength: sets.length,
      objectsCreated: initState.objectsCreated,
      setsChanged: setsHash !== initState.lastSetsHash,
      settingsChanged: settingsHash !== initState.lastSettingsHash
    })

    const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
    console.log(`📏 Using scale: ${scale.toExponential(2)}`)

    // Clear previous objects - but keep references intact during update
    const oldObjects = { ...objsRef.current }
    const oldOrbitLines = { ...orbitLinesRef.current }
    
    Object.values(oldObjects).forEach(o => scene.remove(o))
    Object.values(oldOrbitLines).forEach(l => scene.remove(l))
    
    // Reset object references
    objsRef.current = {}
    orbitLinesRef.current = {}

    if (!sets.length) {
      console.log('⚠️ No sets available')
      return
    }

    // Create Sun with proper realistic scaling
    let sunSize: number
    if (settings.useRealisticSizes) {
      const realSunSize = 696_340 * scale // Real sun size in scaled units
      sunSize = settings.useRealisticScale ? 
        realSunSize * REALISTIC_SUN_SIZE_BOOST : 
        Math.max(2.0, realSunSize)
    } else {
      sunSize = 6.0 // Default viewing size
    }
    
    console.log(`☀️ Creating sun with size: ${sunSize.toFixed(4)} units`)
    console.log(`   Real sun diameter: ${696_340 * 2} km`)
    console.log(`   Scaled sun size: ${(696_340 * scale).toFixed(6)} units (before boost)`)
    
    const sunGeo = new THREE.SphereGeometry(sunSize, 32, 16)
    const sunMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd27d, 
      emissive: 0x996611, 
      emissiveIntensity: 0.3 
    })
    const sunMesh = new THREE.Mesh(sunGeo, sunMat)
    sunMesh.userData.pick = { id: '10', label: 'Sun', kind: 'star' }
    sunMesh.position.set(0, 0, 0)
    scene.add(sunMesh)
    objsRef.current['10'] = sunMesh

    // Create grid - adjust size for realistic mode
    const gridSize = settings.useRealisticScale ? 100 : 200 // Show grid out to ~100 AU for realistic mode
    const gridDivisions = settings.useRealisticScale ? 50 : 20
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x233048, 0x182238)
    ;(grid.material as THREE.Material).opacity = 0.3
    ;(grid.material as THREE.Material as any).transparent = true
    scene.add(grid)

    // Create planets
    let planetsCreated = 0
    sets.forEach(set => {
      if (set.id === '10') return // Skip sun
      
      if (!set.states || set.states.length === 0) {
        console.log(`⚠️ Skipping ${set.id}: no states`)
        return
      }

      console.log(`🪐 Creating planet ${set.id} with ${set.states.length} states`)

      // Create orbit line
      if (settings.showOrbits) {
        try {
          const points = set.states.map(s => 
            new THREE.Vector3(s.r[0] * scale, s.r[1] * scale, s.r[2] * scale)
          )
          const pathGeo = new THREE.BufferGeometry().setFromPoints(points)
          const pathMat = new THREE.LineBasicMaterial({ 
            color: PLANET_DATA[set.id]?.orbitColor || 0x233048,
            opacity: 0.6,
            transparent: true
          })
          const line = new THREE.Line(pathGeo, pathMat)
          scene.add(line)
          orbitLinesRef.current[set.id] = line
        } catch (error) {
          console.warn(`❌ Failed to create orbit line for ${set.id}:`, error)
        }
      }

      // Create planet mesh with correct realistic scaling
      let size: number
      if (settings.useRealisticSizes) {
        const realSize = (REAL_SIZES[set.id] || 6371) * scale // Real size in scaled units
        if (settings.useRealisticScale) {
          // In realistic mode, boost planet size for visibility but keep proportions
          size = Math.max(0.01, realSize * REALISTIC_PLANET_SIZE_BOOST)
        } else {
          // Non-realistic scale but realistic sizes
          size = Math.max(0.1, realSize)
        }
      } else {
        // Fantasy sizes for better visibility
        const base = PLANET_DATA[set.id]?.size ?? 0.8
        size = Math.max(0.5, base * 1.2)
      }

      const realRadiusKm = REAL_SIZES[set.id] || 6371
      console.log(`🪐 Planet ${set.id} (${HORIZON_NAMES[set.id]})`)
      console.log(`   Real radius: ${realRadiusKm} km`)
      console.log(`   Scaled radius: ${(realRadiusKm * scale).toFixed(8)} units`)
      console.log(`   Final size: ${size.toFixed(6)} units`)
      
      // Calculate distance info for this planet's initial position
      const initialR = positionAt(set.states, frameIndex)
      if (initialR) {
        const distanceKm = Math.sqrt(initialR[0]**2 + initialR[1]**2 + initialR[2]**2)
        const distanceAU = distanceKm / 149_597_870.7
        const scaledDistance = distanceKm * scale
        console.log(`   Distance: ${distanceAU.toFixed(2)} AU (${distanceKm.toFixed(0)} km) → ${scaledDistance.toFixed(3)} units`)
      }

      const geo = new THREE.SphereGeometry(size, 24, 16)
      const mat = new THREE.MeshStandardMaterial({ 
        color: PLANET_DATA[set.id]?.color || 0x9999ff,
        roughness: 0.7,
        metalness: 0.1 
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData.pick = { 
        id: set.id, 
        label: HORIZON_NAMES[set.id] || set.id, 
        kind: 'planet' 
      }

      // Set initial position
      try {
        const r = positionAt(set.states, frameIndex)
        if (r && r.every(Number.isFinite)) {
          const newPos = [r[0] * scale, r[1] * scale, r[2] * scale]
          mesh.position.set(newPos[0], newPos[1], newPos[2])
          console.log(`✅ Planet ${set.id} positioned at [${newPos.map(v => v.toFixed(1)).join(',')}], size: ${size.toFixed(3)}`)
        } else {
          console.warn(`⚠️ Invalid position for ${set.id}`, r)
          mesh.position.set(0, 0, 0)
        }
      } catch (error) {
        console.warn(`❌ Failed to position ${set.id}:`, error)
        mesh.position.set(0, 0, 0)
      }

      scene.add(mesh)
      objsRef.current[set.id] = mesh
      planetsCreated++
    })

    // Update state tracking
    initState.lastSetsHash = setsHash
    initState.lastSettingsHash = settingsHash
    initState.objectsCreated = true

    console.log(`✅ Objects created: ${planetsCreated} planets + 1 sun + grid`)
    console.log(`📊 Scene children: ${scene.children.length}`)
    console.log(`📊 Object references: ${Object.keys(objsRef.current).length}`)
    
    // Auto-adjust camera for realistic mode
    if (settings.useRealisticScale) {
      const camera = cameraRef.current
      if (camera) {
        console.log('📹 Adjusting camera for realistic scale')
        const controls = controlsRef.current
        controls.cameraDistance = REALISTIC_CAMERA_DISTANCE
        controls.focusDistance = REALISTIC_CAMERA_DISTANCE * 0.2
        
        // Position camera way outside the solar system to see everything
        camera.position.set(0, REALISTIC_CAMERA_DISTANCE * 0.3, REALISTIC_CAMERA_DISTANCE)
        camera.lookAt(0, 0, 0)
        
        console.log(`📹 Camera positioned at distance: ${REALISTIC_CAMERA_DISTANCE} AU`)
        console.log(`📹 This allows viewing from outside Neptune's orbit (~30 AU)`)
      }
    } else {
      // Reset to normal viewing distance
      const camera = cameraRef.current
      if (camera) {
        const controls = controlsRef.current
        controls.cameraDistance = 15
        controls.focusDistance = 8
        camera.position.set(0, 8, 15)
        camera.lookAt(0, 0, 0)
      }
    }
    
  }, [sets, settings.useRealisticScale, settings.useRealisticSizes, settings.showOrbits, frameIndex, createHash])

  // Position update effect - separated and safer
  useEffect(() => {
    const initState = initStateRef.current
    
    // Only update positions if objects are created and scene is ready
    if (!initState.objectsCreated || !sets.length || !sceneRef.current) {
      console.log('⚠️ Not ready for position updates', {
        objectsCreated: initState.objectsCreated,
        setsLength: sets.length,
        hasScene: !!sceneRef.current
      })
      return
    }

    // Check if we actually have objects to update
    const objectCount = Object.keys(objsRef.current).length
    if (objectCount === 0) {
      console.log('⚠️ No objects in objsRef for position update')
      return
    }

    const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
    
    console.log(`🔄 Updating positions for frame ${frameIndex.toFixed(2)}`)
    
    let updatedCount = 0
    sets.forEach(set => {
      const mesh = objsRef.current[set.id] as THREE.Mesh
      if (!mesh) {
        // Only warn if we expect this object to exist
        if (set.id !== '10' || (set.states && set.states.length > 0)) {
          console.warn(`⚠️ No mesh found for ${set.id}`)
        }
        return
      }
      
      if (!set.states?.length) {
        console.warn(`⚠️ No states for ${set.id}`)
        return
      }

      if (set.id === '10') {
        // Sun stays at origin
        return
      }

      try {
        const r = positionAt(set.states, frameIndex)
        if (r && r.every(Number.isFinite)) {
          const oldPos = mesh.position.clone()
          const newPos = [r[0] * scale, r[1] * scale, r[2] * scale]
          
          // Apply safety limits
          const distanceFromOrigin = Math.sqrt(newPos[0]**2 + newPos[1]**2 + newPos[2]**2)
          const maxDistance = settings.useRealisticScale ? MAX_REALISTIC_DISTANCE : MAX_VIEWING_DISTANCE
          
          if (distanceFromOrigin > maxDistance) {
            const scaleFactor = maxDistance / distanceFromOrigin
            newPos[0] *= scaleFactor
            newPos[1] *= scaleFactor
            newPos[2] *= scaleFactor
            console.warn(`⚠️ ${set.id} clamped from ${distanceFromOrigin.toFixed(4)} to ${maxDistance}`)
          }
          
          mesh.position.set(newPos[0], newPos[1], newPos[2])
          
          const distance = oldPos.distanceTo(mesh.position)
          const finalDistance = Math.sqrt(newPos[0]**2 + newPos[1]**2 + newPos[2]**2)
          
          // Debug logging for significant changes
          if (frameIndex % 10 === 0 || distance > 0.1) {
            console.log(`📍 ${set.id}: pos=[${newPos.map(v => v.toFixed(3)).join(',')}], dist=${finalDistance.toFixed(3)}`)
          }
          
          updatedCount++
        } else {
          console.warn(`❌ Invalid position for ${set.id}:`, r)
        }
      } catch (error) {
        console.error(`❌ Position error for ${set.id}:`, error)
      }
    })
    
    console.log(`✅ Updated ${updatedCount}/${sets.length} positions`)
  }, [frameIndex, sets, settings.useRealisticScale])

  return <div ref={mountRef} className="canvas-wrap" style={{ width: '100%', height: '100%' }} />
}

// Planet metadata
const HORIZON_NAMES: Record<string, string> = {
  '10': 'Sun',
  '199': 'Mercury',
  '299': 'Venus',
  '399': 'Earth',
  '499': 'Mars',
  '599': 'Jupiter',
  '699': 'Saturn',
  '799': 'Uranus',
  '899': 'Neptune'
}

const REAL_SIZES: Record<string, number> = {
  '10': 696_340,
  '199': 2440,
  '299': 6052,
  '399': 6371,
  '499': 3389,
  '599': 69911,
  '699': 58232,
  '799': 25362,
  '899': 24622
}

const PLANET_DATA: Record<string, { size: number; color: number; orbitColor: number }> = {
  '199': { size: 1.0, color: 0x8c7853, orbitColor: 0x8c7853 },
  '299': { size: 1.5, color: 0xffcc33, orbitColor: 0xffcc33 },
  '399': { size: 1.5, color: 0x6ec6ff, orbitColor: 0x6ec6ff },
  '499': { size: 1.2, color: 0xff785a, orbitColor: 0xff785a },
  '599': { size: 3.5, color: 0xd8ca9d, orbitColor: 0xd8ca9d },
  '699': { size: 3.0, color: 0xfad5a5, orbitColor: 0xfad5a5 },
  '799': { size: 2.0, color: 0x4fd0e4, orbitColor: 0x4fd0e4 },
  '899': { size: 2.0, color: 0x4b70dd, orbitColor: 0x4b70dd }
}