import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { DisplayBranding, PalletType, PlacedProduct } from '../../types'
import type { Block, Invalid, ShelfSurface } from '../../lib/builder/placement-engine'
import { displaySpec, defaultHeaderText } from '../../lib/builder/display-spec'
import { DisplayModel } from './display-model'
import { CaseMesh } from './case-mesh'

export type CameraView = '3d' | 'front' | 'top' | 'left' | 'right' | 'back'

export interface DragTarget {
  tier: number
  x: number
  z: number
  stack: boolean
}

interface BuilderSceneProps {
  palletType: PalletType
  tierCount: number
  palletDims: { width: number; depth: number; height: number }
  maxDisplayHeight: number
  lipColor: string
  branding: DisplayBranding
  holiday?: string
  showHeader: boolean
  surfaces: ShelfSurface[]
  placements: PlacedProduct[]
  blocks: Map<string, Block>
  selectedId: string | null
  view: CameraView
  viewToken: number
  cartons: boolean
  showGrid: boolean
  onSelect: (id: string | null) => void
  // Drag lifecycle: the scene reports pointer targets, the parent resolves
  // them through the placement engine and hands back the landing preview.
  onDragStart: (id: string) => Set<string>
  onDragMove: (id: string, target: DragTarget) => { block: Block; invalid: Invalid | null } | null
  onDragEnd: (id: string, commit: boolean) => void
}

const CAMERA_TARGET_Y = 24

function viewPose(view: CameraView, aspect: number, isHalf: boolean) {
  // Narrow (phone) screens need the camera further back to fit the width.
  const k = Math.max(1.2, 1.25 / Math.max(0.45, aspect))
  const t = new THREE.Vector3(0, CAMERA_TARGET_Y, isHalf ? 0 : 0)
  const dist = 88 * k
  switch (view) {
    case 'front':
      return { pos: new THREE.Vector3(0, CAMERA_TARGET_Y + 6, dist), target: t }
    case 'back':
      return { pos: new THREE.Vector3(0, CAMERA_TARGET_Y + 6, -dist), target: t }
    case 'left':
      return { pos: new THREE.Vector3(-dist, CAMERA_TARGET_Y + 6, 0), target: t }
    case 'right':
      return { pos: new THREE.Vector3(dist, CAMERA_TARGET_Y + 6, 0), target: t }
    case 'top':
      return { pos: new THREE.Vector3(0, 70 + dist, 0.01), target: new THREE.Vector3(0, 0, 0) }
    default:
      return {
        pos: new THREE.Vector3(dist * 0.55, CAMERA_TARGET_Y + dist * 0.42, dist * 0.8),
        target: t,
      }
  }
}

function CameraRig({ view, viewToken, isHalf }: { view: CameraView; viewToken: number; isHalf: boolean }) {
  const { camera, size, controls } = useThree()
  const anim = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null)
  useEffect(() => {
    const pose = viewPose(view, size.width / Math.max(1, size.height), isHalf)
    anim.current = { ...pose, t: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewToken, isHalf, size.width < size.height])
  useFrame((_, delta) => {
    const a = anim.current
    const c = controls as unknown as OrbitControlsImpl | null
    if (!a || !c) return
    a.t = Math.min(1, a.t + delta * 2.4)
    const ease = 1 - Math.pow(1 - a.t, 3)
    camera.position.lerp(a.pos, ease)
    c.target.lerp(a.target, ease)
    c.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

// Invisible stand-ins for every surface a case can land on and every solid
// part of the display that blocks the view (centre column, platform
// undersides, half-pallet back wall). Drag rays hit these, not the art.
function PickProxies({ surfaces, isHalf, groupRef }: { surfaces: ShelfSurface[]; isHalf: boolean; groupRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={groupRef} visible={false}>
      {surfaces.map((s, index) => {
        const w = s.outer.x1 - s.outer.x0
        const d = s.outer.z1 - s.outer.z0
        const cx = (s.outer.x0 + s.outer.x1) / 2
        const cz = (s.outer.z0 + s.outer.z1) / 2
        const next = surfaces[index + 1]
        const blockH = next ? next.y - 0.5 - s.y : Math.min(s.clearance, 18)
        return (
          <group key={s.tier}>
            {/* tray floor: its top face is the shelf */}
            <mesh position={[cx, s.y - 0.25, cz]} userData={{ kind: 'shelf', tier: s.tier }}>
              <boxGeometry args={[w + 0.5, 0.5, d + 0.5]} />
            </mesh>
            {s.core && (
              <mesh position={[(s.core.x0 + s.core.x1) / 2, s.y + blockH / 2, (s.core.z0 + s.core.z1) / 2]} userData={{ kind: 'block' }}>
                <boxGeometry args={[s.core.x1 - s.core.x0, blockH, s.core.z1 - s.core.z0]} />
              </mesh>
            )}
            {isHalf && (
              <mesh position={[0, s.y + blockH / 2, s.outer.z0 - 0.25]} userData={{ kind: 'block' }}>
                <boxGeometry args={[w + 1, blockH, 0.5]} />
              </mesh>
            )}
            {s.cubbies && next &&
              s.cubbies.slice(0, -1).map((c, k) => (
                <mesh key={k} position={[c.x1 + 0.17, s.y + blockH / 2, cz]} userData={{ kind: 'block' }}>
                  <boxGeometry args={[0.35, blockH, d]} />
                </mesh>
              ))}
          </group>
        )
      })}
    </group>
  )
}

function ShelfGrid({ surfaces }: { surfaces: ShelfSurface[] }) {
  const geometry = useMemo(() => {
    const pts: number[] = []
    const step = 2
    for (const s of surfaces) {
      const y = s.y + 0.03
      for (let x = Math.ceil(s.outer.x0 / step) * step; x <= s.outer.x1; x += step) {
        segments(x, s.outer.z0, x, s.outer.z1, y, s, pts, 'z')
      }
      for (let z = Math.ceil(s.outer.z0 / step) * step; z <= s.outer.z1; z += step) {
        segments(s.outer.x0, z, s.outer.x1, z, y, s, pts, 'x')
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [surfaces])
  return (
    <lineSegments geometry={geometry} raycast={() => null}>
      <lineBasicMaterial color="#2563eb" transparent opacity={0.22} />
    </lineSegments>
  )
}

// A grid line clipped around the centre column.
function segments(x0: number, z0: number, x1: number, z1: number, y: number, s: ShelfSurface, out: number[], axis: 'x' | 'z') {
  const c = s.core
  if (!c) {
    out.push(x0, y, z0, x1, y, z1)
    return
  }
  if (axis === 'z') {
    if (x0 > c.x0 && x0 < c.x1) {
      out.push(x0, y, z0, x0, y, c.z0, x0, y, c.z1, x0, y, z1)
    } else out.push(x0, y, z0, x1, y, z1)
  } else if (z0 > c.z0 && z0 < c.z1) {
    out.push(x0, y, z0, c.x0, y, z0, c.x1, y, z0, x1, y, z0)
  } else out.push(x0, y, z0, x1, y, z1)
}

function DragController({
  dragRef,
  proxiesRef,
  casesRef,
  onDragMove,
  onDragEnd,
  setGhost,
  controlsEnabled,
}: {
  dragRef: React.MutableRefObject<DragState | null>
  proxiesRef: React.RefObject<THREE.Group | null>
  casesRef: React.RefObject<THREE.Group | null>
  onDragMove: BuilderSceneProps['onDragMove']
  onDragEnd: BuilderSceneProps['onDragEnd']
  setGhost: (g: { id: string; block: Block; invalid: Invalid | null } | null) => void
  controlsEnabled: (on: boolean) => void
}) {
  const { camera, gl } = useThree()
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const el = gl.domElement
    const move = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || ev.pointerId !== drag.pointerId) return
      if (!drag.started) {
        if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 5) return
        drag.started = true
      }
      const rect = el.getBoundingClientRect()
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const targets: THREE.Object3D[] = []
      if (proxiesRef.current) targets.push(...proxiesRef.current.children)
      if (casesRef.current) targets.push(casesRef.current)
      const hits = raycaster.intersectObjects(targets, true).filter((h) => {
        const data = h.object.userData
        if (data.kind === 'case') return !drag.ignore.has(data.id)
        return data.kind === 'shelf' || data.kind === 'block'
      })
      const hit = hits[0]
      if (!hit) return
      const data = hit.object.userData
      if (data.kind === 'block') return
      const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0)
      const x = hit.point.x + drag.offsetX
      const z = hit.point.z + drag.offsetZ
      let target: DragTarget
      if (data.kind === 'case') {
        target = { tier: data.tier, x, z, stack: normal.y > 0.6 }
      } else {
        if (normal.y < 0.6) return
        target = { tier: data.tier, x, z, stack: false }
      }
      const preview = onDragMove(drag.id, target)
      if (preview) {
        drag.last = preview
        setGhost({ id: drag.id, ...preview })
      }
    }
    const up = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || ev.pointerId !== drag.pointerId) return
      dragRef.current = null
      controlsEnabled(true)
      setGhost(null)
      onDragEnd(drag.id, drag.started && !!drag.last && !drag.last.invalid)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [camera, gl, dragRef, proxiesRef, casesRef, onDragMove, onDragEnd, setGhost, controlsEnabled])
  return null
}

interface DragState {
  id: string
  pointerId: number
  startX: number
  startY: number
  started: boolean
  offsetX: number
  offsetZ: number
  ignore: Set<string>
  last: { block: Block; invalid: Invalid | null } | null
}

// Dev-only hook for browser tests: project a world point to client pixels.
function DevProbe() {
  const { camera, gl } = useThree()
  useEffect(() => {
    if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return
    ;(window as unknown as Record<string, unknown>).__builderProject = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
  }, [camera, gl])
  return null
}

function SceneContents(props: BuilderSceneProps) {
  const {
    palletType,
    tierCount,
    palletDims,
    maxDisplayHeight,
    lipColor,
    branding,
    showHeader,
    surfaces,
    placements,
    blocks,
    selectedId,
    view,
    viewToken,
    cartons,
    showGrid,
    onSelect,
    onDragStart,
    onDragMove,
    onDragEnd,
  } = props
  const isHalf = palletType === 'half'
  const spec = useMemo(
    () => displaySpec(palletType, tierCount, palletDims.height, maxDisplayHeight),
    [palletType, tierCount, palletDims.height, maxDisplayHeight],
  )
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const proxiesRef = useRef<THREE.Group>(null)
  const casesRef = useRef<THREE.Group>(null)
  const dragRef = useRef<DragState | null>(null)
  const [ghost, setGhost] = useState<{ id: string; block: Block; invalid: Invalid | null } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const controlsEnabled = useMemo(
    () => (on: boolean) => {
      if (controlsRef.current) controlsRef.current.enabled = on
      setDragging(!on)
    },
    [],
  )

  const startDrag = (placement: PlacedProduct) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    onSelect(placement.id)
    const block = blocks.get(placement.id)
    if (!block) return
    const ignore = onDragStart(placement.id)
    dragRef.current = {
      id: placement.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
      offsetX: block.x - e.point.x,
      offsetZ: block.z - e.point.z,
      ignore,
      last: null,
    }
    controlsEnabled(false)
  }

  return (
    <>
      <color attach="background" args={['#eef1f5']} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.1]} />
      <directionalLight
        position={[40, 90, 60]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={80}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-50, 40, -30]} intensity={0.45} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={() => undefined} raycast={() => null}>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color="#e2e6ec" roughness={1} />
      </mesh>

      <DisplayModel
        spec={spec}
        lipColor={lipColor || '#1f5fbf'}
        lipText={branding?.lipText ?? 'ALL YOUR HOLIDAY NEEDS'}
        lipTextColor={branding?.lipTextColor || '#ffffff'}
        headerText={branding?.headerText || defaultHeaderText(props.holiday)}
        headerTextColor={branding?.headerTextColor || '#ffd54a'}
        headerBackground={branding?.headerBackgroundColor || lipColor || '#1f5fbf'}
        showHeader={showHeader}
      />

      {(showGrid || dragging) && <ShelfGrid surfaces={surfaces} />}
      <PickProxies surfaces={surfaces} isHalf={isHalf} groupRef={proxiesRef} />

      <group ref={casesRef}>
        {placements.map((p) => {
          const block = blocks.get(p.id)
          if (!block) return null
          const isGhost = ghost?.id === p.id
          return (
            <CaseMesh
              key={p.id}
              placement={p}
              block={isGhost ? ghost!.block : block}
              ghost={isGhost ? (ghost!.invalid ? 'bad' : 'ok') : null}
              selected={selectedId === p.id}
              hovered={hoverId === p.id}
              cartons={cartons}
              onPointerDown={isGhost ? undefined : startDrag(p)}
              onPointerOver={() => setHoverId(p.id)}
              onPointerOut={() => setHoverId((cur) => (cur === p.id ? null : cur))}
            />
          )
        })}
      </group>

      <DragController
        dragRef={dragRef}
        proxiesRef={proxiesRef}
        casesRef={casesRef}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        setGhost={setGhost}
        controlsEnabled={controlsEnabled}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={25}
        maxDistance={320}
        maxPolarAngle={Math.PI / 2 - 0.04}
        enableDamping
        dampingFactor={0.08}
        target={[0, CAMERA_TARGET_Y, 0]}
      />
      <CameraRig view={view} viewToken={viewToken} isHalf={isHalf} />
      <DevProbe />
    </>
  )
}

export function BuilderScene(props: BuilderSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [60, 70, 90], fov: 40, near: 1, far: 2000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ touchAction: 'none' }}
    >
      <SceneContents {...props} />
    </Canvas>
  )
}
