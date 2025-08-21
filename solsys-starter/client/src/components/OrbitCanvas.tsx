import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { positionAt } from '../lib/ephem'
import type { EphemSet } from '../lib/api'

const KM_TO_UNIT = 1 / 1_000_000 // 1e6 km per scene unit

export type ClickInfo = { id: string, label: string, kind: 'planet' | 'star' | 'dwarf' | 'small' | 'spacecraft' }

export default function OrbitCanvas({
  sets,
  frameIndex,
  onPick,
}: {
  sets: EphemSet[]
  frameIndex: number
  onPick: (info: ClickInfo) => void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const objsRef = useRef<Record<string, THREE.Object3D>>({})
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())

  useEffect(() => {
    const mount = mountRef.current!
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f16)

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1e9)
    camera.position.set(0, 50, 120)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 2)
    sunLight.position.set(0, 0, 0)
    scene.add(sunLight)

    // Grid (ecliptic plane approximate)
    const grid = new THREE.GridHelper(200, 20, 0x233048, 0x182238)
    ;(grid.material as THREE.Material).opacity = 0.6
    ;(grid.material as THREE.Material as any).transparent = true
    scene.add(grid)

    // camera controls (OrbitControls if available, otherwise a minimal fallback)
    let controls: OrbitControls | null = null
    try {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 5
      controls.maxDistance = 5000
    } catch {
      // Fallback mouse controls if OrbitControls cannot be constructed
      let isDown = false; let lastX = 0; let lastY = 0
      renderer.domElement.addEventListener('mousedown', e => {
        isDown = true; lastX = e.clientX; lastY = e.clientY
      })
      window.addEventListener('mouseup', () => { isDown = false })
      window.addEventListener('mousemove', e => {
        if (!isDown) return
        const dx = (e.clientX - lastX) / 200
        const dy = (e.clientY - lastY) / 200
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx)
        camera.position.y += dy * 20
        camera.lookAt(0, 0, 0)
        lastX = e.clientX; lastY = e.clientY
      })
      window.addEventListener('wheel', e => {
        camera.position.multiplyScalar(e.deltaY > 0 ? 1.1 : 0.9)
      })
    }

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer

    const onResize = () => {
      if (!mount || !rendererRef.current || !cameraRef.current) return
      const w = mount.clientWidth, h = mount.clientHeight
      rendererRef.current.setSize(w, h)
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize); ro.observe(mount)

    const animate = () => {
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    const onClick = (e: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current) return
      const rect = rendererRef.current.domElement.getBoundingClientRect()
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.current.setFromCamera(mouse.current, cameraRef.current)
      const meshes: THREE.Object3D[] = []
      Object.values(objsRef.current).forEach(o => meshes.push(o))
      const hits = raycaster.current.intersectObjects(meshes, true)
      if (hits.length > 0) {
        const obj = hits[0].object
        const tag = (obj.userData && obj.userData.pick) as ClickInfo | undefined
        if (tag) onPick(tag)
      }
    }
    renderer.domElement.addEventListener('click', onClick)

    return () => {
      renderer.domElement.removeEventListener('click', onClick)
      ro.disconnect()
      controls?.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  // Build or update bodies and orbits when sets change
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // clear previous (but keep lights/grid)
    for (const k in objsRef.current) {
      const obj = objsRef.current[k]
      scene.remove(obj)
    }
    objsRef.current = {}

    // Sun sphere at origin
    const sunGeo = new THREE.SphereGeometry(5, 32, 16)
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd27d })
    const sunMesh = new THREE.Mesh(sunGeo, sunMat)
    sunMesh.userData.pick = { id: '10', label: 'Sun', kind: 'star' } as ClickInfo
    scene.add(sunMesh)

    sets.forEach(set => {
      if (!set.states || set.states.length === 0) return
      const label = HORIZON_NAMES[set.id] || set.id
      const kind: ClickInfo['kind'] = PLANET_IDS.has(set.id) ? 'planet' : 'small'

      // path line
      const pts: THREE.Vector3[] = set.states.map(s => new THREE.Vector3(s.r[0] * KM_TO_UNIT, s.r[1] * KM_TO_UNIT, s.r[2] * KM_TO_UNIT))
      const pathGeo = new THREE.BufferGeometry().setFromPoints(pts)
      const pathMat = new THREE.LineBasicMaterial({ linewidth: 1 })
      const line = new THREE.Line(pathGeo, pathMat)
      scene.add(line)

      // body sphere
      const size = SIZE_BY_ID[set.id] || 1.5
      const geo = new THREE.SphereGeometry(size, 24, 16)
      const mat = new THREE.MeshStandardMaterial({ color: COLOR_BY_ID[set.id] || 0x9db4ff, metalness: 0.1, roughness: 0.6 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData.pick = { id: set.id, label, kind }
      scene.add(mesh)
      objsRef.current[set.id] = mesh
    })
  }, [sets])

  // animate positions per frameIndex
  useEffect(() => {
    const objs = objsRef.current
    sets.forEach(set => {
      const mesh = objs[set.id] as THREE.Mesh
      if (!mesh || set.states.length === 0) return
      const r = positionAt(set.states, frameIndex)
      mesh.position.set(r[0] * KM_TO_UNIT, r[1] * KM_TO_UNIT, r[2] * KM_TO_UNIT)
    })
  }, [frameIndex, sets])

  return <div ref={mountRef} className="canvas-wrap" />
}

const PLANET_IDS = new Set(['199', '299', '399', '499', '599', '699', '799', '899'])
const HORIZON_NAMES: Record<string, string> = {
  '199': 'Mercury', '299': 'Venus', '399': 'Earth', '499': 'Mars',
  '599': 'Jupiter', '699': 'Saturn', '799': 'Uranus', '899': 'Neptune', '10': 'Sun'
}
const SIZE_BY_ID: Record<string, number> = {
  '10': 5, '399': 2.2, '499': 2.0
}
const COLOR_BY_ID: Record<string, number> = {
  '399': 0x6ec6ff, // Earth
  '499': 0xff785a, // Mars
}
