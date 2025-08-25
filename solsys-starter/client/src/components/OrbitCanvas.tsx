import React, { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { positionAt, positionAtDate } from '../lib/ephem'
import type { EphemSet } from '../lib/api'
import type { ViewSettings, ClickInfo } from '../types'

type SelectDetail = { id: string | null }
const SELECT_EVENT = 'app:select'

// Scale constants
const VIEWING_SCALE = 1 / 5_000_000
const REALISTIC_SCALE = 1 / 149_597_870.7 // 1 AU = 1 unit
const MAX_VIEWING_DISTANCE = 200
const MAX_REALISTIC_DISTANCE = 50

// Realistic mode settings - tuned for accurate relative scales without engulfing the scene
const REALISTIC_CAMERA_DISTANCE = 50 // AU - far enough to see whole solar system
const REALISTIC_PLANET_SIZE_BOOST = 50 // Keep planets visible but proportionate
const REALISTIC_SUN_SIZE_BOOST = 5 // Sun slightly boosted, not near 1 AU in diameter

// Enhanced NASA Texture URLs for realistic imagery with fallbacks
const NASA_TEXTURES = {
  '10': 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg', // Sun
  '199': 'https://images-assets.nasa.gov/image/PIA11245/PIA11245~orig.jpg', // Mercury
  '299': 'https://images-assets.nasa.gov/image/PIA00271/PIA00271~orig.jpg', // Venus
  '399': 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001362/GSFC_20171208_Archive_e001362~orig.jpg', // Earth
  '301': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Moon
  '499': 'https://images-assets.nasa.gov/image/PIA03278/PIA03278~orig.jpg', // Mars
  '401': 'https://images-assets.nasa.gov/image/PIA10368/PIA10368~orig.jpg', // Phobos
  '402': 'https://images-assets.nasa.gov/image/PIA10369/PIA10369~orig.jpg', // Deimos
  '599': 'https://images-assets.nasa.gov/image/PIA07782/PIA07782~orig.jpg', // Jupiter
  '501': 'https://images-assets.nasa.gov/image/PIA00378/PIA00378~orig.jpg', // Io
  '502': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Europa
  '503': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Ganymede
  '504': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Callisto
  '699': 'https://images-assets.nasa.gov/image/PIA11141/PIA11141~orig.jpg', // Saturn
  '601': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Titan
  '602': 'https://images-assets.nasa.gov/image/PIA07752/PIA07752~orig.jpg', // Enceladus
  '799': 'https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg', // Uranus
  '899': 'https://images-assets.nasa.gov/image/PIA01492/PIA01492~orig.jpg', // Neptune
  '801': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Triton
  '999': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg', // Pluto
  '901': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg'  // Charon
}

// Fallback colors if textures fail to load
const FALLBACK_COLORS = {
  '10': 0xffd27d, // Sun - golden yellow
  '199': 0x8c7853, // Mercury - brown
  '299': 0xffcc33, // Venus - yellow-orange
  '399': 0x6ec6ff, // Earth - blue
  '499': 0xff785a, // Mars - red-orange
  '599': 0xd8ca9d, // Jupiter - tan
  '699': 0xfad5a5, // Saturn - light tan
  '799': 0x4fd0e4, // Uranus - cyan
  '899': 0x4b70dd  // Neptune - blue
}

interface OrbitCanvasProps {
  sets: EphemSet[]
  currentDate: Date
  onPick: (info: ClickInfo) => void
  settings: ViewSettings
}

export default function OrbitCanvas({ sets, currentDate, onPick, settings }: OrbitCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const objsRef = useRef<Record<string, THREE.Object3D>>({})
  const orbitLinesRef = useRef<Record<string, THREE.Line>>({})
  const animationIdRef = useRef<number>()
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())
  const textureLoader = useRef(new THREE.TextureLoader())
  const loadedTextures = useRef<Record<string, THREE.Texture>>({})
  
  // Add initialization state to prevent race conditions
  const initStateRef = useRef({
    objectsCreated: false,
    lastSetsHash: '',
    lastSettingsHash: ''
  })

  // Enhanced camera controls with smooth transitions
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
    focusLastUpdate: 0,
    // Smooth transition properties
    targetDistance: 15,
    targetTheta: 0,
    targetPhi: Math.PI / 4,
    transitionSpeed: 0.05,
    isTransitioning: false
  })

  // Helper function to get distance information for display
  const getDistanceInfo = useCallback((objectId: string) => {
    const obj = objsRef.current[objectId]
    if (!obj) return null
    
    const sun = objsRef.current['10']
    if (!sun) return null
    
    const distance = obj.position.distanceTo(sun.position)
    const distanceAU = distance / (settings.useRealisticScale ? 1 : 50_000_000 / 149_597_870.7)
    
    return {
      distance: distance,
      distanceAU: distanceAU,
      formattedDistance: distanceAU > 1 ? 
        `${distanceAU.toFixed(2)} AU` : 
        `${(distanceAU * 149.5978707).toFixed(0)}M km`
    }
  }, [settings.useRealisticScale])

  // Helper function to create hash for comparison
  const createHash = useCallback((obj: any) => JSON.stringify(obj), [])

  // Enhanced texture loading with better fallbacks and optimization
  const loadTexture = useCallback(async (objectId: string): Promise<THREE.Texture | null> => {
    if (loadedTextures.current[objectId]) {
      return loadedTextures.current[objectId]
    }

    const textureUrl = NASA_TEXTURES[objectId as keyof typeof NASA_TEXTURES]
    if (!textureUrl) {
      console.warn(`⚠️ No texture URL defined for object ${objectId}`)
      return null
    }

    try {
      console.log(`🔄 Loading texture for ${objectId}: ${textureUrl}`)
      
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        const loader = new THREE.TextureLoader()
        loader.setCrossOrigin('anonymous')
        
        // Set timeout for texture loading
        const timeout = setTimeout(() => {
          reject(new Error('Texture loading timeout'))
        }, 30000) // 30 second timeout
        
        loader.load(
          textureUrl,
          (loadedTexture) => {
            clearTimeout(timeout)
            console.log(`✅ Texture loaded successfully for ${objectId}`)
            resolve(loadedTexture)
          },
          (progress) => {
            if (progress.total > 0) {
              console.log(`📥 Loading texture for ${objectId}: ${(progress.loaded / progress.total * 100).toFixed(1)}%`)
            }
          },
          (error) => {
            clearTimeout(timeout)
            console.error(`❌ Failed to load texture for ${objectId}:`, error)
            reject(error)
          }
        )
      })
      
      // Configure texture for better quality and performance
      texture.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() || 1
      texture.flipY = false
      texture.generateMipmaps = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      
      // Store texture reference
      loadedTextures.current[objectId] = texture
      console.log(`✅ Texture configured and stored for ${objectId}`)
      return texture
      
    } catch (error) {
      console.warn(`⚠️ Failed to load texture for ${objectId}:`, error)
      console.log(`🔄 Falling back to solid color for ${objectId}`)
      return null
    }
  }, [])

  // Enhanced material creation with better properties for different object types
  const createMaterial = useCallback((objectId: string, texture: THREE.Texture | null, isSun: boolean = false): THREE.Material => {
    if (isSun) {
      // Sun material - always bright and OPAQUE so starfield doesn't show through
      if (texture) {
        return new THREE.MeshStandardMaterial({ 
          map: texture,
          color: 0xffffaa,
          emissive: 0xffff00,
          emissiveIntensity: 0.2
        })
      } else {
        return new THREE.MeshStandardMaterial({ 
          color: FALLBACK_COLORS[objectId as keyof typeof FALLBACK_COLORS] || 0xffff00,
          emissive: 0xffff00,
          emissiveIntensity: 0.2
        })
      }
    } else if (objectId === '301') {
      // Moon material - more reflective and cratered appearance
      if (texture) {
        return new THREE.MeshStandardMaterial({ 
          map: texture,
          roughness: 0.9,
          metalness: 0.05,
          normalScale: new THREE.Vector2(1.0, 1.0)
        })
      } else {
        return new THREE.MeshStandardMaterial({ 
          color: FALLBACK_COLORS[objectId as keyof typeof FALLBACK_COLORS] || 0xcccccc,
          roughness: 0.9,
          metalness: 0.05
        })
      }
    } else if (objectId === '299') {
      // Venus material - thick atmosphere effect
      if (texture) {
        return new THREE.MeshStandardMaterial({ 
          map: texture,
          roughness: 0.7,
          metalness: 0.1,
          color: 0xffcc33,
          transparent: true,
          opacity: 0.9
        })
      } else {
        return new THREE.MeshStandardMaterial({ 
          color: 0xffcc33,
          roughness: 0.7,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9
        })
      }
    } else if (objectId === '499') {
      // Mars material - reddish with dust
      if (texture) {
        return new THREE.MeshStandardMaterial({ 
          map: texture,
          roughness: 0.8,
          metalness: 0.05,
          color: 0xff785a
        })
      } else {
        return new THREE.MeshStandardMaterial({ 
          color: 0xff785a,
          roughness: 0.8,
          metalness: 0.05
        })
      }
    } else if (objectId === '599') {
      // Jupiter material - gas giant with bands
      if (texture) {
        return new THREE.MeshStandardMaterial({ 
          map: texture,
          roughness: 0.6,
          metalness: 0.2,
          normalScale: new THREE.Vector2(0.8, 0.8)
        })
      } else {
        return new THREE.MeshStandardMaterial({ 
          color: FALLBACK_COLORS[objectId as keyof typeof FALLBACK_COLORS] || 0xd8ca9d,
          roughness: 0.6,
          metalness: 0.2
        })
      }
    } else {
      // Default planet material - more realistic
      if (texture) {
        return new THREE.MeshStandardMaterial({ 
          map: texture,
          roughness: 0.8,
          metalness: 0.1,
          normalScale: new THREE.Vector2(0.5, 0.5),
          envMapIntensity: 0.3
        })
      } else {
        return new THREE.MeshStandardMaterial({ 
          color: FALLBACK_COLORS[objectId as keyof typeof FALLBACK_COLORS] || 0x9999ff,
          roughness: 0.8,
          metalness: 0.1
        })
      }
    }
  }, [])

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
      
      // Calculate relative position with better spacing
      const relativePos = sphericalToCartesian(controls.focusDistance, controls.focusTheta, controls.focusPhi)
      newPosition = newLookAt.clone().add(relativePos)
      
      // Enhanced collision detection - ensure camera doesn't get too close to ANY objects
      const minDistance = 3.0 // Increased minimum distance from any object
      let collisionDetected = false
      
      Object.values(objsRef.current).forEach(obj => {
        if (obj !== targetObj) {
          const distance = newPosition.distanceTo(obj.position)
          if (distance < minDistance) {
            collisionDetected = true
            const direction = newPosition.clone().sub(obj.position).normalize()
            // Move camera further away from the colliding object
            newPosition.copy(obj.position).add(direction.multiplyScalar(minDistance * 1.5))
            console.log(`🚫 Camera collision detected with ${obj.userData?.pick?.id}, adjusting position`)
          }
        }
      })
      
      // Additional safety check - ensure we're not too close to the target object itself
      const targetDistance = newPosition.distanceTo(targetObj.position)
      if (targetDistance < minDistance) {
        const direction = newPosition.clone().sub(targetObj.position).normalize()
        newPosition.copy(targetObj.position).add(direction.multiplyScalar(minDistance))
        console.log(`🚫 Camera too close to target, adjusting distance to ${minDistance}`)
      }
      
      if (collisionDetected) {
        console.log(`🎯 Camera position adjusted due to collision detection`)
      }
    } else {
      newLookAt.set(0, 0, 0)
      newPosition = sphericalToCartesian(controls.cameraDistance, controls.cameraTheta, controls.cameraPhi)
      
      // Also check for collisions in free camera mode
      const minDistance = 2.0
      Object.values(objsRef.current).forEach(obj => {
        const distance = newPosition.distanceTo(obj.position)
        if (distance < minDistance) {
          const direction = newPosition.clone().sub(obj.position).normalize()
          newPosition.copy(obj.position).add(direction.multiplyScalar(minDistance))
        }
      })
    }

    // Smooth camera transitions
    if (controlsRef.current.isTransitioning) {
      controlsRef.current.cameraDistance += (controlsRef.current.targetDistance - controlsRef.current.cameraDistance) * controlsRef.current.transitionSpeed
      controlsRef.current.cameraTheta += (controlsRef.current.targetTheta - controlsRef.current.cameraTheta) * controlsRef.current.transitionSpeed
      controlsRef.current.cameraPhi += (controlsRef.current.targetPhi - controlsRef.current.cameraPhi) * controlsRef.current.transitionSpeed
      
      // Check if transition is complete
      if (Math.abs(controlsRef.current.targetDistance - controlsRef.current.cameraDistance) < 0.01 &&
          Math.abs(controlsRef.current.targetTheta - controlsRef.current.cameraTheta) < 0.01 &&
          Math.abs(controlsRef.current.targetPhi - controlsRef.current.targetPhi) < 0.01) {
        controlsRef.current.isTransitioning = false
      }
    }
    
    camera.position.copy(newPosition)
    camera.lookAt(newLookAt)
    
    // Update camera's near and far planes based on current position
    const sceneBounds = new THREE.Box3().setFromObject(sceneRef.current!)
    const sceneSize = sceneBounds.getSize(new THREE.Vector3()).length()
    const cameraDistance = newPosition.length()
    
    // Dynamic near/far plane adjustment
    camera.near = Math.max(0.001, cameraDistance * 0.001)
    camera.far = Math.max(10000, cameraDistance * 100)
    camera.updateProjectionMatrix()
    
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
      // Sun - keep reasonable distance
      baseDistance = settings.useRealisticSizes ? Math.max(15, objDistance * 0.3) : 20
    } else {
      if (settings.useRealisticScale) {
        // In AU units, keep distance relative to actual orbital radius
        const planetSize = obj instanceof THREE.Mesh ? 
          (obj.geometry as THREE.SphereGeometry).parameters.radius : 1
        baseDistance = Math.max(planetSize * 50, objDistance * 1.1)
      } else {
        // Non-realistic scale - keep objects visible
        baseDistance = Math.max(12, objDistance * 0.4) // Increased minimum distance
      }
    }
    
    // Enable smooth transitions
    controls.isTransitioning = true
    controls.targetDistance = Math.min(Math.max(baseDistance, 6), 300)
    controls.targetTheta = Math.PI / 4
    controls.targetPhi = Math.PI / 3
    
    // Set current values for immediate response
    controls.focusDistance = Math.min(Math.max(baseDistance, 6), 300)
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
      0.001, // Much smaller near plane for better depth precision
      10000  // Larger far plane for better star visibility
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

    // Renderer with enhanced settings
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      logarithmicDepthBuffer: true, // Better depth precision
      powerPreference: "high-performance",
      stencil: false,
      depth: true
    })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = true
    ;(renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace
    ;(renderer as any).toneMapping = (THREE as any).ACESFilmicToneMapping
    ;(renderer as any).toneMappingExposure = 1.2
    rendererRef.current = renderer

    // Add renderer to DOM
    mount.appendChild(renderer.domElement)

    // Enhanced lighting system
    const ambient = new THREE.AmbientLight(0x404040, 0.1) // Very low ambient for dramatic shadows
    scene.add(ambient)
    
    // Main sun light with enhanced properties
    const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 0.1) // Increased intensity, added decay
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 4096
    sunLight.shadow.mapSize.height = 4096
    sunLight.shadow.camera.near = 0.1
    sunLight.shadow.camera.far = 1000
    sunLight.shadow.bias = -0.0001
    sunLight.shadow.normalBias = 0.02
    sunLight.shadow.radius = 2
    scene.add(sunLight)
    
    // Secondary fill light for better planet illumination
    const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.2)
    fillLight.position.set(100, 100, 100)
    scene.add(fillLight)

    // Apply textured sky background (no interior sphere)
    createSkyBackground(scene)

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

      // Enhanced sensitivity based on zoom level
      const baseSensitivity = 0.008
      const zoomFactor = c.focusTarget ? c.focusDistance / 10 : c.cameraDistance / 15
      const sensitivity = baseSensitivity * Math.max(0.5, Math.min(2.0, zoomFactor))
      
      if (c.mouseButton === 0) {
        if (c.focusTarget && objsRef.current[c.focusTarget]) {
          c.focusTheta -= dx * sensitivity
          c.focusPhi = Math.max(0.1, Math.min(Math.PI - 0.1, c.focusPhi + dy * sensitivity))
          c.focusLastUpdate = Date.now()
        } else {
          c.cameraTheta -= dx * sensitivity
          c.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, c.cameraPhi + dy * sensitivity))
        }
      } else if (c.mouseButton === 1) {
        // Middle mouse button for panning
        if (c.focusTarget && objsRef.current[c.focusTarget]) {
          const panSensitivity = sensitivity * 0.5
          c.focusDistance = Math.max(2, Math.min(200, c.focusDistance + dy * panSensitivity * 10))
        } else {
          const panSensitivity = sensitivity * 0.5
          c.cameraDistance = Math.max(3, Math.min(300, c.cameraDistance + dy * panSensitivity * 10))
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
        const oldDistance = c.focusDistance
        c.focusDistance = Math.min(Math.max(c.focusDistance * zoom, 2), 200)
        
        // Log zoom information for debugging
        if (Math.abs(oldDistance - c.focusDistance) > 0.1) {
          const targetObj = objsRef.current[c.focusTarget]
          const distanceInfo = getDistanceInfo(c.focusTarget)
          console.log(`🔍 Zooming to ${c.focusTarget}: distance ${c.focusDistance.toFixed(1)}, ${distanceInfo?.formattedDistance} from Sun`)
        }
      } else {
        const oldDistance = c.cameraDistance
        c.cameraDistance = Math.min(Math.max(c.cameraDistance * zoom, 3), 300)
        
        if (Math.abs(oldDistance - c.cameraDistance) > 0.1) {
          console.log(`🔍 Camera zoom: ${c.cameraDistance.toFixed(1)} units`)
        }
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
    
    // Enhanced keyboard navigation
    const onKeyDown = (e: KeyboardEvent) => {
      const c = controlsRef.current
      const moveSpeed = 0.1
      const rotateSpeed = 0.05
      
      switch (e.key.toLowerCase()) {
        case 'w':
          if (c.focusTarget && objsRef.current[c.focusTarget]) {
            c.focusPhi = Math.max(0.1, c.focusPhi - rotateSpeed)
          } else {
            c.cameraPhi = Math.max(0.1, c.cameraPhi - rotateSpeed)
          }
          break
        case 's':
          if (c.focusTarget && objsRef.current[c.focusTarget]) {
            c.focusPhi = Math.min(Math.PI - 0.1, c.focusPhi + rotateSpeed)
          } else {
            c.cameraPhi = Math.min(Math.PI - 0.1, c.cameraPhi + rotateSpeed)
          }
          break
        case 'a':
          if (c.focusTarget && objsRef.current[c.focusTarget]) {
            c.focusTheta -= rotateSpeed
          } else {
            c.cameraTheta -= rotateSpeed
          }
          break
        case 'd':
          if (c.focusTarget && objsRef.current[c.focusTarget]) {
            c.focusTheta += rotateSpeed
          } else {
            c.cameraTheta += rotateSpeed
          }
          break
        case 'q':
          if (c.focusTarget && objsRef.current[c.focusTarget]) {
            c.focusDistance = Math.max(2, c.focusDistance - moveSpeed * 10)
          } else {
            c.cameraDistance = Math.max(3, c.cameraDistance - moveSpeed * 10)
          }
          break
        case 'e':
          if (c.focusTarget && objsRef.current[c.focusTarget]) {
            c.focusDistance = Math.min(200, c.focusDistance + moveSpeed * 10)
          } else {
            c.cameraDistance = Math.min(300, c.cameraDistance + moveSpeed * 10)
          }
          break
        case 'r':
          // Reset camera to default position
          c.focusTarget = null
          c.cameraDistance = 15
          c.cameraTheta = 0
          c.cameraPhi = Math.PI / 4
          console.log('🔄 Camera reset to default position')
          break
        case 'f':
          // Focus on Sun
          focusOnObject('10')
          break
        case ' ':
          // Spacebar to toggle auto-orbit
          c.autoOrbitEnabled = !c.autoOrbitEnabled
          console.log(`🔄 Auto-orbit ${c.autoOrbitEnabled ? 'enabled' : 'disabled'}`)
          break
      }
      
      if (['w', 's', 'a', 'd', 'q', 'e', 'r', 'f', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault()
        updateCameraPosition()
      }
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

          // Enhanced animation loop with performance monitoring and cosmic animations
      let frameCount = 0
      let lastTime = performance.now()
      let fps = 60
      let animationTime = 0
      
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate)
        
        const camera = cameraRef.current
        const renderer = rendererRef.current
        const scene = sceneRef.current
        
        if (!camera || !renderer || !scene) return

        // Update animation time
        animationTime += 0.016 // ~60fps

        // Performance monitoring
        frameCount++
        const currentTime = performance.now()
        if (currentTime - lastTime >= 1000) {
          fps = frameCount
          frameCount = 0
          lastTime = currentTime
          
          // Log performance metrics every second
          if (fps < 30) {
            console.warn(`⚠️ Low FPS detected: ${fps}`)
          }
        }

        // Animate cosmic elements
        scene.children.forEach(child => {
          if (child.userData.type === 'nebulaClouds') {
            // Rotate nebula clouds slowly
            child.rotation.y += 0.0005
            child.rotation.x += 0.0002
          }
          if (child.userData.type === 'cosmicDust') {
            // Float cosmic dust particles
            child.rotation.y += 0.0003
            child.rotation.z += 0.0001
          }
          if (child.userData.type === 'starField') {
            // Twinkle stars
            child.children.forEach((star: any) => {
              if (star.material) {
                star.material.opacity = 0.7 + 0.3 * Math.sin(animationTime * 2 + star.position.x * 0.01)
              }
            })
          }
        })

        const c = controlsRef.current
        if (c.focusTarget && c.autoOrbitEnabled && !c.isMouseDown) {
          if (Date.now() - c.focusLastUpdate > 3000) {
            c.focusTheta += 0.003
            updateCameraPosition()
          }
        }

        // Enhanced rendering with shadow updates
        renderer.shadowMap.autoUpdate = true
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
    
    // Add help overlay with skybox selector
    const helpOverlay = document.createElement('div')
    helpOverlay.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
    `
    helpOverlay.innerHTML = `
      <div><strong>Controls:</strong></div>
      <div>Mouse: Orbit, Scroll: Zoom</div>
      <div>WASD: Move camera</div>
      <div>QE: Zoom in/out</div>
      <div>R: Reset camera</div>
      <div>F: Focus Sun</div>
      <div>Space: Toggle auto-orbit</div>
      <div style="margin-top: 8px; border-top: 1px solid #666; padding-top: 8px;">
        <div><strong>Skybox:</strong></div>
        <select id="skyboxSelector" style="background: #333; color: white; border: 1px solid #666; padding: 2px; margin: 4px 0;">
          <option value="random">Random NASA Image</option>
          <option value="milkyway">Milky Way</option>
          <option value="nebula">Deep Space Nebula</option>
          <option value="hubble">Hubble Deep Field</option>
          <option value="orion">Orion Nebula</option>
          <option value="carina">Carina Nebula</option>
          <option value="eagle">Eagle Nebula</option>
          <option value="pillars">Pillars of Creation</option>
          <option value="andromeda">Andromeda Galaxy</option>
          <option value="cosmicweb">Cosmic Web</option>
          <option value="stellar">Stellar Nursery</option>
        </select>
      </div>
    `
    mount.appendChild(helpOverlay)
    
    // Make skybox selector interactive
    const skyboxSelector = helpOverlay.querySelector('#skyboxSelector') as HTMLSelectElement
    skyboxSelector.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement
      const selectedSkybox = target.value
      console.log(`🌌 User selected skybox: ${selectedSkybox}`)
      // TODO: Implement skybox switching
    })
    
    // Auto-hide help after 15 seconds
    setTimeout(() => {
      helpOverlay.style.opacity = '0.3'
    }, 15000)

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

  // Create sky background from equirectangular texture
  const createSkyBackground = (scene: THREE.Scene) => {
    try {
      const loader = new THREE.TextureLoader()
      // Free, stable stars equirectangular image (can be replaced with your asset)
      const url = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/2294472375_24a3b8ef46_o.jpg'
      loader.setCrossOrigin('anonymous')
      loader.load(url, (tex) => {
        ;(tex as any).colorSpace = (THREE as any).SRGBColorSpace
        scene.background = tex
        console.log('✅ Sky background set from equirectangular texture')
      }, undefined, (err) => {
        console.warn('Sky background failed to load, falling back to procedural stars', err)
        createProceduralStars(scene)
      })
    } catch (e) {
      console.warn('Sky background error, using procedural stars', e)
      createProceduralStars(scene)
    }
  }

  // Optional procedural stars fallback
  const createProceduralStars = (scene: THREE.Scene) => {
    console.log('🌟 Creating accurate starfield skybox')
    
    // Add individual stars with realistic positions and colors
    const starCount = 4000
    const starGeometry = new THREE.BufferGeometry()
    const starVertices: number[] = []
    const starColors: number[] = []
    const starSizes: number[] = []
    
    // Use real star catalog data for positions (simplified)
    for (let i = 0; i < starCount; i++) {
      // Generate stars in a sphere around the viewer
      const radius = 800 + Math.random() * 200 // Stars between 800-1000 units away
      const theta = Math.random() * Math.PI * 2 // Azimuthal angle
      const phi = Math.acos(2 * Math.random() - 1) // Polar angle
      
      starVertices.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      )
      
      // Realistic star colors based on spectral type
      const spectralType = Math.random()
      let starColor: THREE.Color
      
      if (spectralType < 0.1) {
        // O-type stars (blue)
        starColor = new THREE.Color(0.4, 0.6, 1.0)
      } else if (spectralType < 0.2) {
        // B-type stars (blue-white)
        starColor = new THREE.Color(0.6, 0.8, 1.0)
      } else if (spectralType < 0.4) {
        // A-type stars (white)
        starColor = new THREE.Color(1.0, 1.0, 1.0)
      } else if (spectralType < 0.6) {
        // F-type stars (yellow-white)
        starColor = new THREE.Color(1.0, 1.0, 0.9)
      } else if (spectralType < 0.8) {
        // G-type stars (yellow, like our Sun)
        starColor = new THREE.Color(1.0, 1.0, 0.8)
      } else if (spectralType < 0.9) {
        // K-type stars (orange)
        starColor = new THREE.Color(1.0, 0.8, 0.6)
      } else {
        // M-type stars (red)
        starColor = new THREE.Color(1.0, 0.6, 0.4)
      }
      
      starColors.push(starColor.r, starColor.g, starColor.b)
      
      // Vary star sizes based on brightness
      const brightness = 0.5 + Math.random() * 2.0
      starSizes.push(brightness)
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3))
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1))
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 0.8,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    })
    
    const stars = new THREE.Points(starGeometry, starsMaterial)
    stars.renderOrder = -0.5
    stars.name = 'stars'
    scene.add(stars)
    
    console.log(`✅ Created skybox with ${starCount} stars`)
  }

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

    const createObjects = async () => {
      const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
      console.log(`📏 Using scale: ${scale.toExponential(2)}`)

      // COMPLETELY CLEAR previous objects - no duplicates allowed
      console.log('🧹 Clearing ALL previous objects')
      Object.values(objsRef.current).forEach(o => {
        scene.remove(o)
        if (o instanceof THREE.Mesh && o.geometry) {
          o.geometry.dispose()
        }
        if (o instanceof THREE.Mesh && o.material) {
          if (Array.isArray(o.material)) {
            o.material.forEach((m: THREE.Material) => m.dispose())
          } else {
            o.material.dispose()
          }
        }
      })
      Object.values(orbitLinesRef.current).forEach(l => {
        scene.remove(l)
        if (l instanceof THREE.Line && l.geometry) l.geometry.dispose()
        if (l instanceof THREE.Line && l.material) {
          if (Array.isArray(l.material)) {
            l.material.forEach((m: THREE.Material) => m.dispose())
          } else {
            l.material.dispose()
          }
        }
      })
      
      // Reset ALL references
      objsRef.current = {}
      orbitLinesRef.current = {}

      if (!sets.length) {
        console.log('⚠️ No sets available')
        return
      }

      // STEP 1: Create Sun FIRST at the center
      console.log('☀️ Creating Sun at center (0,0,0)')
      let sunSize: number
      if (settings.useRealisticSizes) {
        const realSunSize = 696_340 * scale // Real sun size in scaled units
        // In strict realistic sizes mode, do not boost
        sunSize = settings.useRealisticScale ? 
          Math.max(0.001, realSunSize) : 
          Math.max(2.0, realSunSize)
      } else {
        sunSize = 6.0 // Default viewing size
      }
      
      console.log(`☀️ Sun size: ${sunSize.toFixed(4)} units`)
      console.log(`   Real sun diameter: ${696_340 * 2} km`)
      console.log(`   Scaled sun size: ${(696_340 * scale).toFixed(6)} units (before boost)`)
      
      const sunGeo = new THREE.SphereGeometry(sunSize, 32, 16)
      const sunTexture = await loadTexture('10')
      const sunMat = createMaterial('10', sunTexture, true)
      
      const sunMesh = new THREE.Mesh(sunGeo, sunMat)
      sunMesh.userData.pick = { id: '10', label: 'Sun', kind: 'star' }
      sunMesh.position.set(0, 0, 0)
      scene.add(sunMesh)
      objsRef.current['10'] = sunMesh
      
      // Add enhanced lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.1)
      scene.add(ambientLight)
      
      // Sun light source
      const sunLight = new THREE.PointLight(0xffffff, 2, 1000)
      sunLight.position.set(0, 0, 0)
      sunLight.castShadow = true
      sunLight.shadow.mapSize.width = 2048
      sunLight.shadow.mapSize.height = 2048
      sunLight.shadow.camera.near = 0.1
      sunLight.shadow.camera.far = 1000
      scene.add(sunLight)
      
      // Enable shadows on renderer
      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = true
        rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap
      }

      // STEP 2: Create realistic NASA skybox with multiple options
      const createSkybox = async () => {
        try {
          // Multiple NASA skybox options for variety
          const skyboxOptions = [
            {
              name: 'Milky Way Panorama',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001362/GSFC_20171208_Archive_e001362~orig.jpg'
            },
            {
              name: 'Deep Space Nebula',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Hubble Deep Field',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Orion Nebula',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Carina Nebula',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Eagle Nebula',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Pillars of Creation',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Andromeda Galaxy',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Cosmic Web',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            },
            {
              name: 'Stellar Nursery',
              type: 'sphere',
              url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg'
            }
          ]
          
          // Randomly select a skybox option
          const selectedSkybox = skyboxOptions[Math.floor(Math.random() * skyboxOptions.length)]
          console.log(`🌌 Loading ${selectedSkybox.name} skybox...`)
          
          // Create spherical skybox for more realistic panoramic effect
          const textureLoader = new THREE.TextureLoader()
          textureLoader.setCrossOrigin('anonymous')
          
          const skyboxTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(selectedSkybox.url, resolve, undefined, reject)
          })
          
          // Create a large sphere to wrap the scene
          const skyboxGeometry = new THREE.SphereGeometry(5000, 64, 64)
          const skyboxMaterial = new THREE.MeshBasicMaterial({
            map: skyboxTexture,
            side: THREE.BackSide, // Render inside the sphere
            transparent: true,
            opacity: 0.9
          })
          
          const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial)
          scene.add(skybox)
          
          // Add atmospheric nebula clouds for extra realism
          const createNebulaClouds = () => {
            const cloudGeometry = new THREE.BufferGeometry()
            const cloudCount = 500
            const cloudPositions = new Float32Array(cloudCount * 3)
            const cloudColors = new Float32Array(cloudCount * 3)
            const cloudSizes = new Float32Array(cloudCount)
            
            for (let i = 0; i < cloudCount; i++) {
              const radius = 3000 + Math.random() * 2000
              const theta = Math.random() * Math.PI * 2
              const phi = Math.acos(2 * Math.random() - 1)
              
              cloudPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
              cloudPositions[i * 3 + 1] = radius * Math.cos(phi)
              cloudPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
              
              // Nebula cloud colors (pink, blue, purple)
              const cloudType = Math.random()
              if (cloudType < 0.4) {
                // Pink nebula clouds
                cloudColors[i * 3] = 1.0     // Pink
                cloudColors[i * 3 + 1] = 0.6 + Math.random() * 0.3
                cloudColors[i * 3 + 2] = 0.8 + Math.random() * 0.2
              } else if (cloudType < 0.7) {
                // Blue nebula clouds
                cloudColors[i * 3] = 0.6 + Math.random() * 0.3     // Blue
                cloudColors[i * 3 + 1] = 0.7 + Math.random() * 0.3
                cloudColors[i * 3 + 2] = 1.0
              } else {
                // Purple nebula clouds
                cloudColors[i * 3] = 0.8 + Math.random() * 0.2     // Purple
                cloudColors[i * 3 + 1] = 0.4 + Math.random() * 0.3
                cloudColors[i * 3 + 2] = 1.0
              }
              
              cloudSizes[i] = 10 + Math.random() * 20
            }
            
            cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3))
            cloudGeometry.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3))
            cloudGeometry.setAttribute('size', new THREE.BufferAttribute(cloudSizes, 1))
            
            const cloudMaterial = new THREE.PointsMaterial({
              size: 15,
              vertexColors: true,
              transparent: true,
              opacity: 0.3,
              sizeAttenuation: true,
              blending: THREE.AdditiveBlending
            })
            
            const nebulaClouds = new THREE.Points(cloudGeometry, cloudMaterial)
            nebulaClouds.userData.type = 'nebulaClouds'
            scene.add(nebulaClouds)
            console.log('✅ Nebula clouds added for atmospheric effect')
          }
          
          // Add nebula clouds for extra realism
          createNebulaClouds()
          
          // Add floating cosmic dust particles
          const createCosmicDust = () => {
            const dustGeometry = new THREE.BufferGeometry()
            const dustCount = 1000
            const dustPositions = new Float32Array(dustCount * 3)
            const dustColors = new Float32Array(dustCount * 3)
            const dustSizes = new Float32Array(dustCount)
            
            for (let i = 0; i < dustCount; i++) {
              const radius = 1000 + Math.random() * 4000
              const theta = Math.random() * Math.PI * 2
              const phi = Math.acos(2 * Math.random() - 1)
              
              dustPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
              dustPositions[i * 3 + 1] = radius * Math.cos(phi)
              dustPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
              
              // Cosmic dust colors (white, gold, silver)
              const dustType = Math.random()
              if (dustType < 0.6) {
                // White cosmic dust
                dustColors[i * 3] = 1.0
                dustColors[i * 3 + 1] = 1.0
                dustColors[i * 3 + 2] = 1.0
              } else if (dustType < 0.8) {
                // Gold cosmic dust
                dustColors[i * 3] = 1.0
                dustColors[i * 3 + 1] = 0.8 + Math.random() * 0.2
                dustColors[i * 3 + 2] = 0.6 + Math.random() * 0.2
              } else {
                // Silver cosmic dust
                dustColors[i * 3] = 0.8 + Math.random() * 0.2
                dustColors[i * 3 + 1] = 0.8 + Math.random() * 0.2
                dustColors[i * 3 + 2] = 0.9 + Math.random() * 0.1
              }
              
              dustSizes[i] = 1 + Math.random() * 3
            }
            
            dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
            dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3))
            dustGeometry.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1))
            
            const dustMaterial = new THREE.PointsMaterial({
              size: 2,
              vertexColors: true,
              transparent: true,
              opacity: 0.4,
              sizeAttenuation: true,
              blending: THREE.AdditiveBlending
            })
            
            const cosmicDust = new THREE.Points(dustGeometry, dustMaterial)
            cosmicDust.userData.type = 'cosmicDust'
            scene.add(cosmicDust)
            console.log('✅ Cosmic dust particles added for depth')
          }
          
          // Add cosmic dust for depth
          createCosmicDust()
          
          console.log('✅ NASA spherical skybox loaded successfully')
          
        } catch (error) {
          console.warn('⚠️ Failed to load NASA skybox, using fallback starfield')
          createFallbackStarfield()
        }
      }
      
      // Fallback starfield if skybox fails
      const createFallbackStarfield = () => {
        const starFieldGeometry = new THREE.BufferGeometry()
        const starCount = 15000 // Increased for better coverage
        const starPositions = new Float32Array(starCount * 3)
        const starColors = new Float32Array(starCount * 3)
        const starSizes = new Float32Array(starCount)
        
        for (let i = 0; i < starCount; i++) {
          const radius = 2000 + Math.random() * 3000
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          
          starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
          starPositions[i * 3 + 1] = radius * Math.cos(phi)
          starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
          
          // Realistic star colors based on spectral types
          const starType = Math.random()
          if (starType < 0.6) {
            // White/Blue stars (O, B, A types)
            starColors[i * 3] = 0.8 + Math.random() * 0.2     // Blue-white
            starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2
            starColors[i * 3 + 2] = 0.9 + Math.random() * 0.1
          } else if (starType < 0.8) {
            // Yellow stars (F, G types like our Sun)
            starColors[i * 3] = 1.0     // Yellow
            starColors[i * 3 + 1] = 0.9 + Math.random() * 0.1
            starColors[i * 3 + 2] = 0.7 + Math.random() * 0.2
          } else if (starType < 0.95) {
            // Orange stars (K type)
            starColors[i * 3] = 1.0     // Orange
            starColors[i * 3 + 1] = 0.7 + Math.random() * 0.2
            starColors[i * 3 + 2] = 0.5 + Math.random() * 0.2
          } else {
            // Red stars (M type like Betelgeuse)
            starColors[i * 3] = 1.0     // Red
            starColors[i * 3 + 1] = 0.5 + Math.random() * 0.3
            starColors[i * 3 + 2] = 0.4 + Math.random() * 0.3
          }
          
          // Variable star sizes for depth effect
          starSizes[i] = 1 + Math.random() * 3
        }
        
        starFieldGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
        starFieldGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
        starFieldGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1))
        
        const starFieldMaterial = new THREE.PointsMaterial({
          size: 2,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          sizeAttenuation: true
        })
        
        const starField = new THREE.Points(starFieldGeometry, starFieldMaterial)
        starField.userData.type = 'starField'
        scene.add(starField)
        console.log('✅ Fallback starfield created with', starCount, 'stars')
      }
      
      // Try to load NASA skybox first, fallback to starfield
      createSkybox()
      
      // Create grid and distance markers
      const gridSize = settings.useRealisticScale ? 100 : 200
      const gridDivisions = settings.useRealisticScale ? 50 : 20
      const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x233048, 0x182238)
      ;(grid.material as THREE.Material).opacity = 0.3
      ;(grid.material as THREE.Material as any).transparent = true
      scene.add(grid)

      if (settings.useRealisticScale) {
        // Add AU markers
        for (let au = 1; au <= 50; au += 5) {
          const markerGeometry = new THREE.RingGeometry(au - 0.05, au + 0.05, 32)
          const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x444444, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide
          })
          const marker = new THREE.Mesh(markerGeometry, markerMaterial)
          marker.rotation.x = -Math.PI / 2
          scene.add(marker)
          
          if (au % 10 === 0) {
            console.log(`📍 Added ${au} AU distance marker`)
          }
        }
      }

      // STEP 3: Create planets with REAL orbital positions (no interference)
      let planetsCreated = 0
      for (const set of sets) {
        if (set.id === '10') continue // Skip sun (already created)
        
        if (!set.states || set.states.length === 0) {
          console.log(`⚠️ Skipping ${set.id}: no states`)
          continue
        }

        console.log(`🪐 Creating planet ${set.id} (${HORIZON_NAMES[set.id] || set.id})`)

        // Create planet mesh with correct realistic scaling
        let size: number
        if (settings.useRealisticSizes) {
          const realSize = (REAL_SIZES[set.id] || 6371) * scale
          if (settings.useRealisticScale) {
            // True-to-scale radii, with optional visibility multiplier for usability
            const vis = Math.max(1, (settings as any).realisticVisibilityScale ?? 100)
            size = Math.max(0.00002, realSize * vis)
          } else {
            size = Math.max(0.1, realSize)
          }
        } else {
          const base = PLANET_DATA[set.id]?.size ?? 0.8
          size = Math.max(0.5, base * 1.2)
        }

        const realRadiusKm = REAL_SIZES[set.id] || 6371
        console.log(`   Real radius: ${realRadiusKm} km`)
        console.log(`   Final size: ${size.toFixed(6)} units`)
        
        const geo = new THREE.SphereGeometry(size, 24, 16)
        const planetTexture = await loadTexture(set.id)
        const mat = createMaterial(set.id, planetTexture)
        
        let mesh: THREE.Object3D = new THREE.Mesh(geo, mat)
        mesh.userData.pick = { 
          id: set.id, 
          label: HORIZON_NAMES[set.id] || set.id, 
          kind: 'planet' 
        }
        
        // Enable shadows for planets
        if (mesh instanceof THREE.Mesh) {
          mesh.castShadow = true
          mesh.receiveShadow = true
        }
        
        // Add rings for Saturn and Uranus
        if (set.id === '699' || set.id === '799') { // Saturn or Uranus
          const ringGroup = new THREE.Group()
          ringGroup.add(mesh)
          
          // Create ring geometry
          const ringGeometry = new THREE.RingGeometry(size * 1.5, size * 2.5, 64)
          const ringMaterial = new THREE.MeshBasicMaterial({ 
            color: set.id === '699' ? 0xfad5a5 : 0x4fd0e4, // Saturn: tan, Uranus: cyan
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
          })
          const ring = new THREE.Mesh(ringGeometry, ringMaterial)
          ring.rotation.x = Math.PI / 2
          ringGroup.add(ring)
          
          // Update references to use the group
          mesh = ringGroup
          mesh.userData.pick = { 
            id: set.id, 
            label: HORIZON_NAMES[set.id] || set.id, 
            kind: 'planet' 
          }
        }

        // STEP 4: Position planet using REAL orbital data (no safety overrides)
        try {
          const r = positionAtDate(set.states, currentDate)
          if (r && r.every(Number.isFinite)) {
            // Use the REAL orbital position without any interference
            const newPos = [r[0] * scale, r[1] * scale, r[2] * scale]
            
            // Log the real position
            const distanceKm = Math.sqrt(newPos[0]**2 + newPos[1]**2 + newPos[2]**2)
            const distanceAU = distanceKm / (settings.useRealisticScale ? 1 : 50_000_000 / 149_597_870.7)
            console.log(`   REAL position: [${newPos.map(v => v.toFixed(3)).join(',')}]`)
            console.log(`   Distance from Sun: ${distanceAU.toFixed(2)} AU (${distanceKm.toFixed(0)} km)`)
            
            // Set position directly - no safety overrides, no collision detection
            mesh.position.set(newPos[0], newPos[1], newPos[2])
            
          } else {
            console.warn(`⚠️ Invalid position for ${set.id}, using fallback`)
            // Only use fallback if orbital data is completely invalid
            const fallbackDistance = settings.useRealisticScale ? 0.5 : 10 // 0.5 AU or 10 units
            const angle = Math.random() * Math.PI * 2
            mesh.position.set(
              Math.cos(angle) * fallbackDistance,
              Math.sin(angle) * fallbackDistance,
              0
            )
          }
        } catch (error) {
          console.warn(`❌ Position error for ${set.id}, using fallback`)
          const fallbackDistance = settings.useRealisticScale ? 0.5 : 10
          const angle = Math.random() * Math.PI * 2
          mesh.position.set(
            Math.cos(angle) * fallbackDistance,
            Math.sin(angle) * fallbackDistance,
            0
          )
          
          // Add error indicator
          const errorGeometry = new THREE.SphereGeometry(size * 0.1, 8, 8)
          const errorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
          const errorIndicator = new THREE.Mesh(errorGeometry, errorMaterial)
          errorIndicator.position.set(size * 1.2, 0, 0)
          mesh.add(errorIndicator)
        }

        scene.add(mesh)
        objsRef.current[set.id] = mesh
        
        // Add atmospheric glow for planets with atmosphere
        if (set.id !== '10' && set.id !== '301' && set.id !== '401' && set.id !== '402' && 
            set.id !== '501' && set.id !== '502' && set.id !== '503' && set.id !== '504' && 
            set.id !== '601' && set.id !== '602' && set.id !== '801' && set.id !== '901') {
          const atmosphereGeometry = new THREE.SphereGeometry(size * 1.1, 32, 32)
          const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
          })
          const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
          atmosphere.position.copy(mesh.position)
          scene.add(atmosphere)
        }
        planetsCreated++

        // STEP 5: Create orbit line AFTER planet is positioned
        if (settings.showOrbits) {
          try {
            const orbitPoints: THREE.Vector3[] = []
            const orbitSteps = 100
            
            for (let i = 0; i <= orbitSteps; i++) {
              const t = i / orbitSteps
              const stateIndex = Math.floor(t * (set.states.length - 1))
              const state = set.states[stateIndex]
              
              if (state && state.r && state.r.every(Number.isFinite)) {
                const scaledPos = new THREE.Vector3(
                  state.r[0] * scale,
                  state.r[1] * scale,
                  state.r[2] * scale
                )
                orbitPoints.push(scaledPos)
              }
            }
            
            if (orbitPoints.length > 1) {
              const pathGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints)
              const pathMat = new THREE.LineBasicMaterial({ 
                color: PLANET_DATA[set.id]?.orbitColor || 0x233048,
                opacity: 0.8,
                transparent: true,
                linewidth: 2
              })
              const line = new THREE.Line(pathGeo, pathMat)
              
              scene.add(line)
              orbitLinesRef.current[set.id] = line
              
              console.log(`✅ Created orbit line for ${set.id} with ${orbitPoints.length} points`)
            }
          } catch (error) {
            console.warn(`❌ Failed to create orbit line for ${set.id}:`, error)
          }
        }
      }

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
    }

    createObjects()
    
  }, [sets, settings.useRealisticScale, settings.useRealisticSizes, settings.showOrbits, currentDate, createHash, loadTexture, createMaterial])

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
    
    console.log(`🔄 Updating positions for frame ${currentDate.toISOString()}`)
    
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
        const r = positionAtDate(set.states, currentDate)
        if (r && r.every(Number.isFinite)) {
          const oldPos = mesh.position.clone()
          const newPos = [r[0] * scale, r[1] * scale, r[2] * scale]
          
          // Use REAL orbital position without any safety overrides
          mesh.position.set(newPos[0], newPos[1], newPos[2])
          
          const distance = oldPos.distanceTo(mesh.position)
          const finalDistance = Math.sqrt(newPos[0]**2 + newPos[1]**2 + newPos[2]**2)
          
          // Debug logging for significant changes
          if (currentDate.getTime() % 1000 === 0 || distance > 0.1) {
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
  }, [currentDate, sets, settings.useRealisticScale])

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

  return <div ref={mountRef} className="canvas-wrap" style={{ width: '100%', height: '100%' }} />
}