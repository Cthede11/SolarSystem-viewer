// Enhanced OrbitCanvas.tsx with improved camera focus and orbital controls
// Fixes: initial focus-to-origin by seeding mesh positions immediately and
//        falling back to computed position if a mesh is still at (0,0,0).

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { positionAt } from '../lib/ephem'
import type { EphemSet } from '../lib/api'
import type { ViewSettings, ClickInfo } from '../types'

type SelectDetail = { id: string | null }
const SELECT_EVENT = 'app:select'

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

  // Enhanced camera controls with better state management
  const controlsRef = useRef({
    // Mouse interaction
    isMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    mouseMoved: false,
    mouseButton: 0,
    prevFocusTarget: null as string | null,

    // Free camera mode
    cameraDistance: 15,
    cameraTheta: 0,
    cameraPhi: Math.PI / 4,

    // Focus mode
    focusTarget: null as string | null,
    focusDistance: 10,
    focusTheta: 0,
    focusPhi: Math.PI / 4,

    // Auto orbit around focused object (gently)
    autoOrbitEnabled: true,
    autoOrbitTimer: 0,
    focusLastUpdate: 0,

    // Smooth transition
    targetPosition: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
    currentLookAt: new THREE.Vector3(),
    isTransitioning: false,
    transitionProgress: 0,
    transitionSpeed: 0.08
  })

  // Convert spherical (r, theta, phi) to cartesian
  const sphericalToCartesian = (r: number, theta: number, phi: number) =>
    new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))

  // Calculate intelligent focus distance and angles
  const calculateOptimalFocus = (objectId: string): { distance: number, theta: number, phi: number } => {
    const obj = objsRef.current[objectId]
    if (!obj) return { distance: 10, theta: 0, phi: Math.PI / 4 }

    // Get object's visual radius
    let objectRadius = 1
    if ((obj as any).geometry instanceof THREE.SphereGeometry) {
      objectRadius = ((obj as any).geometry.parameters?.radius) || 1
    }

    // Calculate base distance with conservative scaling
    let baseDistance: number
    if (objectId === '10') { // Sun
      baseDistance = settings.useRealisticSizes ? Math.max(objectRadius * 6, 3) : Math.max(objectRadius * 4, 8)
    } else {
      if (settings.useRealisticScale && settings.useRealisticSizes) baseDistance = Math.max(objectRadius * 50, 2)
      else if (settings.useRealisticScale)                          baseDistance = Math.max(objectRadius * 12, 2)
      else                                                          baseDistance = Math.max(objectRadius * 6, 2)
    }
    baseDistance = Math.min(Math.max(baseDistance, 2), 150)

    const phi = Math.PI / 3
    let theta = 0

    // Try to avoid nearest neighbors
    const targetPos = obj.position.clone()
    const nearby = Object.entries(objsRef.current)
      .filter(([id]) => id !== objectId)
      .map(([, o]) => ({ o, d: o.position.distanceTo(targetPos) }))
      .sort((a, b) => a.d - b.d)

    if (nearby.length > 0) {
      const angles = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2, 3*Math.PI/4, -3*Math.PI/4, Math.PI, 0]
      for (const a of angles) {
        const testPos = sphericalToCartesian(baseDistance, a, phi).add(targetPos)
        let clear = true
        for (const n of nearby.slice(0, 2)) {
          if (testPos.distanceTo(n.o.position) < baseDistance * 0.8) { clear = false; break }
        }
        if (clear) { theta = a; break }
      }
    }
    return { distance: baseDistance, theta, phi }
  }

  // Helper: get (and if needed, compute) the position for an object by id
  const getOrSeedObjectPosition = (id: string): THREE.Vector3 | null => {
    const obj = objsRef.current[id]
    if (!obj) return null

    const pos = obj.position.clone()
    const isZeroish = Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z) < 1e-9
    if (!isZeroish) return pos

    // Seed from ephemerides immediately if available
    const set = sets.find(s => s.id === id)
    if (!set || !set.states?.length) return pos

    try {
      const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE
      const r = positionAt(set.states, frameIndex)
      const seeded = new THREE.Vector3(r[0] * scale, r[1] * scale, r[2] * scale)
      obj.position.copy(seeded)
      return seeded.clone()
    } catch {
      return pos
    }
  }

  // Update camera position based on current mode and controls
  const updateCameraPosition = (immediate = false) => {
    const camera = cameraRef.current
    if (!camera) return

    const controls = controlsRef.current
    let newPosition: THREE.Vector3
    let newLookAt = new THREE.Vector3()

    if (controls.focusTarget && objsRef.current[controls.focusTarget]) {
      const seededPos = getOrSeedObjectPosition(controls.focusTarget) || new THREE.Vector3(0, 0, 0)
      newLookAt.copy(seededPos)
      const relativePos = sphericalToCartesian(controls.focusDistance, controls.focusTheta, controls.focusPhi)
      newPosition = newLookAt.clone().add(relativePos)
      if (!isFinite(newPosition.x) || !isFinite(newPosition.y) || !isFinite(newPosition.z)) {
        newPosition = new THREE.Vector3(0, controls.focusDistance, 0)
      }
    } else {
      newLookAt.set(0, 0, 0)
      newPosition = sphericalToCartesian(controls.cameraDistance, controls.cameraTheta, controls.cameraPhi)
    }

    if (!controls.isTransitioning) {
      controls.targetPosition.copy(newPosition)
      controls.targetLookAt.copy(newLookAt)
      controls.transitionProgress = 0
      controls.isTransitioning = !immediate
    } else {
      controls.targetPosition.copy(newPosition)
      controls.targetLookAt.copy(newLookAt)
    }

    if (immediate || !controls.isTransitioning) {
      camera.position.copy(newPosition)
      camera.lookAt(newLookAt)
      controls.currentLookAt.copy(newLookAt)
      controls.isTransitioning = false
    }
  }

  // Enhanced focus function with intelligent positioning
  const focusOnObject = (objectId: string, smooth = true) => {
    if (!objsRef.current[objectId]) return
    const controls = controlsRef.current
    // Ensure target has a sane position before computing angles
    getOrSeedObjectPosition(objectId)

    const optimal = calculateOptimalFocus(objectId)
    controls.focusTarget = objectId
    controls.focusDistance = optimal.distance
    controls.focusTheta = optimal.theta
    controls.focusPhi = optimal.phi
    controls.focusLastUpdate = Date.now()
    controls.autoOrbitEnabled = false
    controls.transitionProgress = 0
    controls.isTransitioning = smooth

    // Use immediate placement on the very first frame to avoid visible jump,
    // then allow smoothing to continue on subsequent frames.
    updateCameraPosition(true)
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)

  // Camera
  const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.01, 1e9)
  camera.position.set(0, 20, 40); // Default position: above and back from origin
  camera.lookAt(0, 0, 0); // Look at origin (Sun)
  cameraRef.current = camera
  controlsRef.current.cameraDistance = settings.useRealisticScale ? 8 : 20
  controlsRef.current.cameraTheta = 0;
  controlsRef.current.cameraPhi = Math.PI / 4;
  controlsRef.current.focusTarget = null;
  updateCameraPosition(true)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const sunLight = new THREE.PointLight(0xffffff, 2, 0)
    sunLight.position.set(0, 0, 0)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    scene.add(sunLight)

    // Starfield
    const starGeometry = new THREE.BufferGeometry()
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 })
    const starVertices: number[] = []
    for (let i = 0; i < 8000; i++) {
      starVertices.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000)
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))
    const stars = new THREE.Points(starGeometry, starMaterial)
    scene.add(stars)

    sceneRef.current = scene
    rendererRef.current = renderer

    // Mouse controls
    const onMouseDown = (e: MouseEvent) => {
      const c = controlsRef.current;
      c.isMouseDown = true;
      c.mouseMoved = false;
      c.lastMouseX = e.clientX;
      c.lastMouseY = e.clientY;
      c.autoOrbitEnabled = false;
      c.mouseButton = e.button;
      // Always enter free camera mode on right mouse down
      if (e.button === 2) {
        c.focusTarget = null;
        updateCameraPosition(true);
      }
    };
    const onMouseUp = () => {
      const c = controlsRef.current;
      c.isMouseDown = false;
      // Do not restore focusTarget after right mouse drag; stay in free camera mode
      if (c.focusTarget) setTimeout(() => { c.autoOrbitEnabled = true }, 2000);
    };
  // Prevent context menu on right-click
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
    const onMouseMove = (e: MouseEvent) => {
      const c = controlsRef.current
      if (!c.isMouseDown) return
      const dx = e.clientX - c.lastMouseX;
      const dy = e.clientY - c.lastMouseY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) c.mouseMoved = true;

      const sens = 0.008;
      if (c.mouseButton === 0) {
        if (c.focusTarget && objsRef.current[c.focusTarget]) {
          c.focusTheta -= dx * sens;
          c.focusPhi = Math.max(0.1, Math.min(Math.PI - 0.1, c.focusPhi + dy * sens));
          c.focusLastUpdate = Date.now();
        } else {
          c.cameraTheta -= dx * sens;
          c.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, c.cameraPhi + dy * sens));
        }
      }
      c.lastMouseX = e.clientX;
      c.lastMouseY = e.clientY;
      updateCameraPosition(true);
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = controlsRef.current
      const zoom = Math.pow(0.95, -e.deltaY * 0.1)
      if (c.focusTarget && objsRef.current[c.focusTarget]) {
        c.focusDistance = Math.min(Math.max(c.focusDistance * zoom, 1.5), 200)
      } else {
        c.cameraDistance = Math.min(Math.max(c.cameraDistance * zoom, 2), 300)
      }
      updateCameraPosition(true)
    }

    // Click → pick → focus + broadcast
    const onClick = (e: MouseEvent) => {
      const c = controlsRef.current
      if (c.mouseMoved) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.current.setFromCamera(mouse.current, cameraRef.current!)
      const meshes = Object.values(objsRef.current).filter(o => o instanceof THREE.Mesh)
      const hits = raycaster.current.intersectObjects(meshes)
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh
        const tag = hit.userData?.pick as ClickInfo | undefined
        if (tag?.id) {
          onPick(tag)
          window.dispatchEvent(new CustomEvent<SelectDetail>(SELECT_EVENT, { detail: { id: tag.id } }))
          focusOnObject(tag.id, true)
        }
      }
    }

    // Keyboard
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
          c.focusTarget = null
          c.autoOrbitEnabled = false
          c.isTransitioning = true
          c.transitionProgress = 0
          updateCameraPosition(false)
          break
      }
      updateCameraPosition(true)
    }

    const onResize = () => {
      const m = mountRef.current
      const cam = cameraRef.current
      const ren = rendererRef.current
      if (!m || !cam || !ren) return
      cam.aspect = m.clientWidth / m.clientHeight
      cam.updateProjectionMatrix()
      ren.setSize(m.clientWidth, m.clientHeight)
    }

    // External select → focus
    const onExternalSelect = (e: Event) => {
      const ce = e as CustomEvent<SelectDetail>
      const id = ce.detail?.id
      if (id && objsRef.current[id]) focusOnObject(id, true)
    }

    // Listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    window.addEventListener(SELECT_EVENT, onExternalSelect)

    // Animate
    const animate = () => {
      const c = controlsRef.current
      const camera = cameraRef.current
      const renderer = rendererRef.current
      const scene = sceneRef.current
      if (!camera || !renderer || !scene) { animationIdRef.current = requestAnimationFrame(animate); return }

      if (c.isTransitioning) {
        c.transitionProgress += c.transitionSpeed
        if (c.transitionProgress >= 1) {
          c.isTransitioning = false
          c.transitionProgress = 0
          camera.position.copy(c.targetPosition)
          camera.lookAt(c.targetLookAt)
          c.currentLookAt.copy(c.targetLookAt)
        } else {
          const p = c.transitionProgress
          const eased = 1 - Math.pow(1 - p, 3)
          camera.position.lerpVectors(camera.position, c.targetPosition, eased * 0.3)
          c.currentLookAt.lerpVectors(c.currentLookAt, c.targetLookAt, eased * 0.3)
          camera.lookAt(c.currentLookAt)
        }
      }

      if (c.focusTarget && c.autoOrbitEnabled && !c.isMouseDown) {
        if (Date.now() - c.focusLastUpdate > 2000) {
          c.focusTheta += 0.002;
          updateCameraPosition(true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.followPlanet]);

  // Rebuild objects when sets or settings change
  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return

    const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE

    // Clear previous (keep lights/stars)
    Object.values(objsRef.current).forEach(o => scene.remove(o))
    Object.values(orbitLinesRef.current).forEach(l => scene.remove(l))
    objsRef.current = {}
    orbitLinesRef.current = {}

    // Sun
  const sunSize = settings.useRealisticSizes ? Math.max(2.0, 696_340 * scale) : 4.5 // Ensure Sun is always visible
    const sunGeo = new THREE.SphereGeometry(sunSize, 32, 16)
    const sunMat = new THREE.MeshStandardMaterial({ color: 0xffd27d, emissive: 0x996611, emissiveIntensity: 0.5 })
    const sunMesh = new THREE.Mesh(sunGeo, sunMat)
    sunMesh.userData.pick = { id: '10', label: 'Sun', kind: 'star' }
    scene.add(sunMesh)
    objsRef.current['10'] = sunMesh

    // Ecliptic grid
    const grid = new THREE.GridHelper(200, 20, 0x233048, 0x182238)
    ;(grid.material as THREE.Material).opacity = 0.4
    ;(grid.material as THREE.Material as any).transparent = true
    scene.add(grid)

    // Planets + orbits
    sets.forEach(set => {
      if (!set.states || set.states.length === 0) return

      const pts = set.states.map(s => new THREE.Vector3(s.r[0] * scale, s.r[1] * scale, s.r[2] * scale))
      const pathGeo = new THREE.BufferGeometry().setFromPoints(pts)
      const pathMat = new THREE.LineBasicMaterial({ color: PLANET_DATA[set.id]?.orbitColor || 0x233048 })
      const line = new THREE.Line(pathGeo, pathMat)
      scene.add(line)
      orbitLinesRef.current[set.id] = line

      // Mesh
      let size: number
      if (settings.useRealisticSizes) {
        size = Math.max(0.02, (REAL_SIZES[set.id] || 6371) * scale)
      } else {
        const base = PLANET_DATA[set.id]?.size ?? 0.8
        size = Math.max(0.15, Math.min(2.0, base * 0.4))
      }
      const geo = new THREE.SphereGeometry(size, 24, 16)
      const mat = new THREE.MeshStandardMaterial({ color: PLANET_DATA[set.id]?.color || 0x9999ff, roughness: 0.7, metalness: 0.1 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData.pick = { id: set.id, label: HORIZON_NAMES[set.id] || set.id, kind: 'planet' }

      // ✅ Seed position immediately to avoid origin targeting
      try {
        const r = positionAt(set.states, frameIndex)
        mesh.position.set(r[0] * scale, r[1] * scale, r[2] * scale)
      } catch {
        // leave at 0 if anything goes wrong; focusOnObject will seed later
      }

      scene.add(mesh)
      objsRef.current[set.id] = mesh
    })

    // Ensure camera updates after objects exist
    updateCameraPosition(true)
  }, [sets, settings, frameIndex])

  // Animate positions per frame (kept)
  useEffect(() => {
    if (!sets.length) return
    const objs = objsRef.current
    const scale = settings.useRealisticScale ? REALISTIC_SCALE : VIEWING_SCALE

    sets.forEach(set => {
      const mesh = objs[set.id] as THREE.Mesh
      if (!mesh || !set.states?.length) return
      try {
        const r = positionAt(set.states, frameIndex)
        if (r && r.every(Number.isFinite)) {
          mesh.position.set(r[0] * scale, r[1] * scale, r[2] * scale)
        }
      } catch {}
    })
  }, [frameIndex, sets, settings])

  return <div ref={mountRef} className="canvas-wrap" />
}

// Planet metadata
type PlanetData = { size: number; color: number; orbitColor: number }

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

// Real radii in km
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

const PLANET_DATA: Record<string, PlanetData> = {
  '199': { size: 1.0, color: 0x8c7853, orbitColor: 0x8c7853 },
  '299': { size: 1.5, color: 0xffcc33, orbitColor: 0xffcc33 },
  '399': { size: 1.5, color: 0x6ec6ff, orbitColor: 0x6ec6ff },
  '499': { size: 1.2, color: 0xff785a, orbitColor: 0xff785a },
  '599': { size: 3.5, color: 0xd8ca9d, orbitColor: 0xd8ca9d },
  '699': { size: 3.0, color: 0xfad5a5, orbitColor: 0xfad5a5 },
  '799': { size: 2.0, color: 0x4fd0e4, orbitColor: 0x4fd0e4 },
  '899': { size: 2.0, color: 0x4b70dd, orbitColor: 0x4b70dd }
}
