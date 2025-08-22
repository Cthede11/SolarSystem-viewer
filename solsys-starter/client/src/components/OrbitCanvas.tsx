import React, { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { positionAt } from '../lib/ephem'
import type { EphemSet } from '../lib/api'
import type { ViewSettings, ClickInfo } from '../types'

type SelectDetail = { id: string | null }
const SELECT_EVENT = 'app:select'

// Scale constants
const VIEWING_SCALE = 1 / 50_000_000
const REALISTIC_SCALE = 1 / 149_597_870.7
const MAX_VIEWING_DISTANCE = 200
const MAX_REALISTIC_DISTANCE = 50

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
  const isInitializedRef = useRef(false)
  const lastSetsRef = useRef<EphemSet[]>([])
  const lastSettingsRef = useRef<ViewSettings>()

  // Enhanced camera controls
  const controlsRef = useRef({
    isMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    mouseMoved: false,
    mouseButton: 0,
    cameraDistance: 8, // Reduced from 15
    cameraTheta: 0,
    cameraPhi: Math.PI / 4,
    focusTarget: null as string | null,
    focusDistance: 5, // Reduced from 10
    focusTheta: 0,
    focusPhi: Math.PI / 4,
    autoOrbitEnabled: true,
    autoOrbitTimer: 0,
    focusLastUpdate: 0
  })

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

  // Initialize Three.js scene ONCE
  useEffect(() => {
    if (isInitializedRef.current) return
    
    const mount = mountRef.current
    if (!mount) {
      console.error('❌ Mount element not found')
      return
    }

    console.log('🚀 INITIALIZING Three.js scene (should happen only once)')
    console.log(`📐 Mount dimensions: ${mount.clientWidth}x${mount.clientHeight}`)

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)
    console.log('✅ Scene created')

    // Camera - Position closer to the action
    const camera = new THREE.PerspectiveCamera(
      75, 
      mount.clientWidth / mount.clientHeight, 
      0.01, 
      1e9
    )
    camera.position.set(0, 8, 15) // Much closer: was (0, 15, 30)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera
    console.log('✅ Camera created and positioned closer')

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    rendererRef.current = renderer
    console.log('✅ Renderer created')

    // Only add renderer if not already added
    if (!mount.contains(renderer.domElement)) {
      mount.appendChild(renderer.domElement)
      console.log('✅ Renderer added to DOM')
    }

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambient)
    
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 0)
    sunLight.position.set(0, 0, 0)
    sunLight.castShadow = true
    scene.add(sunLight)
    console.log('✅ Lights added')

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
    console.log('✅ Star skybox added')

    sceneRef.current = scene

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

    console.log('🚀 Starting animation loop')
    animate()

    renderer.render(scene, camera)
    console.log('✅ Initial render completed')

    isInitializedRef.current = true

    // Cleanup function
    return () => {
      console.log('🧹 Cleanup started')
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      window.removeEventListener(SELECT_EVENT, onExternalSelect)
      
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
      
      // Reset initialization flag
      isInitializedRef.current = false
      console.log('🧹 Cleanup completed')
    }
  }, []) // No dependencies - initialize once only

  // Update objects only when sets or relevant settings change
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) {
      console.log('⚠️ No scene available for object updates')
      return
    }

    console.log('🔄 Checking if object update needed:', {
      setsLength: sets.length,
      hasLastSets: lastSetsRef.current.length > 0,
      hasLastSettings: !!lastSettingsRef.current
    })

    // Always update if we have sets but no objects created yet
    const hasObjects = Object.keys(objsRef.current).length > 0
    const forceUpdate = sets.length > 0 && !hasObjects

    // Check if we need to update objects
    const setsChanged = JSON.stringify(sets) !== JSON.stringify(lastSetsRef.current)
    const settingsChanged = !lastSettingsRef.current || 
      lastSettingsRef.current.useRealisticScale !== settings.useRealisticScale ||
      lastSettingsRef.current.useRealisticSizes !== settings.useRealisticSizes ||
      lastSettingsRef.current.showOrbits !== settings.showOrbits

    if (!setsChanged && !settingsChanged && !forceUpdate) {
      console.log('⚠️ No changes detected and objects exist, skipping object update')
      return // No need to rebuild
    }

    console.log('🔄 Updating objects:', { 
      setsChanged, 
      settingsChanged,
      forceUpdate,
      setsLength: sets.length,
      firstSetId: sets[0]?.id,
      firstSetStates: sets[0]?.states?.length
    })

    const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
    console.log(`📏 Using scale: ${scale.toExponential(2)}`)

    // Clear previous objects
    Object.values(objsRef.current).forEach(o => scene.remove(o))
    Object.values(orbitLinesRef.current).forEach(l => scene.remove(l))
    objsRef.current = {}
    orbitLinesRef.current = {}

    if (!sets.length) {
      console.log('⚠️ No sets available, skipping object creation')
      return
    }

    // Create Sun - MAKE IT BIGGER TOO!
    const sunSize = settings.useRealisticSizes ? Math.max(2.0, 696_340 * scale) : 6.0 // Increased from 3.0 to 6.0
    console.log(`☀️ Creating sun with size: ${sunSize.toFixed(2)}`)
    
    const sunGeo = new THREE.SphereGeometry(sunSize, 32, 16)
    const sunMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd27d, 
      emissive: 0x996611, 
      emissiveIntensity: 0.3 
    })
    const sunMesh = new THREE.Mesh(sunGeo, sunMat)
    sunMesh.userData.pick = { id: '10', label: 'Sun', kind: 'star' }
    sunMesh.position.set(0, 0, 0) // Keep sun at origin
    scene.add(sunMesh)
    objsRef.current['10'] = sunMesh
    console.log('✅ Sun created at origin')

    // Create grid
    const grid = new THREE.GridHelper(200, 20, 0x233048, 0x182238)
    ;(grid.material as THREE.Material).opacity = 0.3
    ;(grid.material as THREE.Material as any).transparent = true
    scene.add(grid)
    console.log('✅ Grid created')

    // Create planets
    let planetsCreated = 0
    sets.forEach(set => {
      if (set.id === '10') {
        console.log(`⚠️ Skipping ${set.id}: is sun`)
        return
      }
      
      if (!set.states || set.states.length === 0) {
        console.log(`⚠️ Skipping ${set.id}: no states (${set.states?.length || 0} states)`)
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
          console.log(`✅ Orbit line created for ${set.id}`)
        } catch (error) {
          console.warn(`❌ Failed to create orbit line for ${set.id}:`, error)
        }
      }

      // Create planet mesh - MAKE THEM MUCH BIGGER!
      let size: number
      if (settings.useRealisticSizes) {
        size = Math.max(0.1, (REAL_SIZES[set.id] || 6371) * scale)
      } else {
        // Make planets much more visible
        const base = PLANET_DATA[set.id]?.size ?? 0.8
        size = Math.max(0.5, base * 1.2) // Increased from 0.3 multiplier to 1.2
      }

      console.log(`🪐 Planet ${set.id} size: ${size.toFixed(3)}`)

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

      // Set initial position using frameIndex
      try {
        const r = positionAt(set.states, frameIndex)
        if (r && r.every(Number.isFinite)) {
          const newPos = [r[0] * scale, r[1] * scale, r[2] * scale]
          mesh.position.set(newPos[0], newPos[1], newPos[2])
          console.log(`✅ Planet ${set.id} positioned at [${newPos.map(v => v.toFixed(1)).join(',')}], size: ${size.toFixed(3)}`)
        } else {
          console.warn(`⚠️ Invalid position for ${set.id}, keeping at origin:`, r)
        }
      } catch (error) {
        console.warn(`❌ Failed to position ${set.id}:`, error)
      }

      scene.add(mesh)
      objsRef.current[set.id] = mesh
      planetsCreated++
      console.log(`✅ Planet ${set.id} added to scene`)
    })

    // Store current state
    lastSetsRef.current = [...sets] // Create new array to avoid reference issues
    lastSettingsRef.current = { ...settings }

    console.log(`✅ Objects updated: ${planetsCreated} planets + 1 sun + grid`)
    console.log(`📊 Scene children count: ${scene.children.length}`)
    console.log(`📊 Tracked objects: ${Object.keys(objsRef.current).length}`)
    
    // Check camera distance to objects
    const camera = cameraRef.current
    if (camera && planetsCreated > 0) {
      const cameraPos = camera.position
      console.log(`📹 Camera at: [${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)}]`)
      
      Object.entries(objsRef.current).forEach(([id, obj]) => {
        const distance = camera.position.distanceTo(obj.position)
        console.log(`👁️ Distance to ${id}: ${distance.toFixed(1)}`)
      })
    }
    
  }, [sets, settings.useRealisticScale, settings.useRealisticSizes, settings.showOrbits, frameIndex]) // Add frameIndex for initial positioning

  // Update positions when frame changes
  useEffect(() => {
    if (!sets.length || Object.keys(objsRef.current).length === 0) {
      console.log('⚠️ No sets or objects available for position update')
      return
    }

    const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
    
    console.log(`🔄 Updating positions for frame ${frameIndex.toFixed(2)}, scale: ${scale.toExponential(2)}`)
    
    let updatedCount = 0
    sets.forEach(set => {
      const mesh = objsRef.current[set.id] as THREE.Mesh
      if (!mesh) {
        console.warn(`⚠️ No mesh found for ${set.id}`)
        return
      }
      
      if (!set.states?.length) {
        console.warn(`⚠️ No states for ${set.id}`)
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
            console.warn(`⚠️ ${set.id} clamped from ${distanceFromOrigin.toFixed(1)} to ${maxDistance} units`)
          }
          
          mesh.position.set(newPos[0], newPos[1], newPos[2])
          
          const distance = oldPos.distanceTo(mesh.position)
          const finalDistance = Math.sqrt(newPos[0]**2 + newPos[1]**2 + newPos[2]**2)
          
          // Debug logging
          if (frameIndex % 10 === 0 || distance > 10) {
            console.log(`📍 ${set.id}: pos=[${newPos.map(v => v.toFixed(1)).join(',')}], dist=${finalDistance.toFixed(1)}, moved=${distance.toFixed(2)}`)
          }
          
          updatedCount++
        } else {
          console.warn(`❌ Invalid raw position for ${set.id}:`, r)
        }
      } catch (error) {
        console.error(`❌ Position error for ${set.id}:`, error)
      }
    })
    
    console.log(`✅ Updated ${updatedCount} object positions`)
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