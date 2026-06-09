import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
import { RigidBodyType } from '@dimforge/rapier3d-compat'
import { ORIENTATION_PRESETS } from '../../../lib/orientation-presets'
import { useDisplayStore } from '../../../stores/display-store'
import { usePhysicsDisabled } from './SandboxPhysics'

// How far above the surface under the cursor a held item hovers.
const HOVER_OFFSET = 0.75
// Pixels of pointer travel before a press becomes a drag (below this it is a click).
const DRAG_THRESHOLD_PX = 5
// Wheel travel per 90 degree rotation step while holding an item.
const WHEEL_STEP = 60
// Rapier's auto-sleep thresholds assume meter-scale worlds; in this
// inch-scale world a visually still body can wobble above them forever.
// The watchdog force-sleeps any body that stays slower than this for
// QUIET_SECONDS, which also triggers the settled-transform write-back.
const QUIET_SPEED = 2.5
const QUIET_SECONDS = 1
// Cap how fast a bystander can be launched by the held (kinematic) item.
const MAX_LINEAR_SPEED = 50
const MAX_ANGULAR_SPEED = 12

const PRESET_QUATERNIONS = ORIENTATION_PRESETS.map((preset) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...preset.rotation, 'XYZ')),
)

function nearestPresetIndex(q: THREE.Quaternion): number {
  let best = 0
  let bestAngle = Infinity
  PRESET_QUATERNIONS.forEach((preset, index) => {
    const angle = q.angleTo(preset)
    if (angle < bestAngle) {
      bestAngle = angle
      best = index
    }
  })
  return best
}

interface DragManagerApi {
  register: (id: string, body: RapierRigidBody) => void
  unregister: (id: string) => void
  // Called from an item's pointer-down. Becomes a drag once the pointer
  // passes the movement threshold; otherwise the press stays a click.
  beginGrab: (id: string, clientX: number, clientY: number) => void
  // True exactly once after a drag ends, so the synthetic click that
  // follows pointer-up can be swallowed instead of toggling selection.
  consumeDragClick: () => boolean
  isHeld: (id: string) => boolean
}

const DragManagerContext = createContext<DragManagerApi | null>(null)

export function useDragManager() {
  return useContext(DragManagerContext)
}

interface HeldState {
  id: string
  mode: 'drag' | 'carry'
  active: boolean
  startX: number
  startY: number
  orientationIndex: number
  targetQuaternion: THREE.Quaternion
  wheelAccum: number
}

interface DragManagerProps {
  maxDisplayHeight?: number
  children: React.ReactNode
}

function DragManagerInner({ maxDisplayHeight = 60, children }: DragManagerProps) {
  const bodies = useRef(new Map<string, RapierRigidBody>())
  const held = useRef<HeldState | null>(null)
  const justDragged = useRef(false)
  const pointerNdc = useRef(new THREE.Vector2())
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const shiftDown = useRef(false)

  const { world, rapier } = useRapier()
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controls = useThree((state) => state.controls) as unknown as
    | { enabled: boolean }
    | null

  const carryPlacementId = useDisplayStore((s) => s.carryPlacementId)
  const wakeToken = useDisplayStore((s) => s.wakeToken)

  // Shelf geometry changed (tier count, pallet type): wake every body so
  // items left hanging in the air fall and re-settle on the new shape.
  useEffect(() => {
    if (wakeToken === 0) return
    bodies.current.forEach((body) => body.wakeUp())
  }, [wakeToken])

  const setControlsEnabled = useCallback(
    (enabled: boolean) => {
      if (controls) controls.enabled = enabled
      useDisplayStore.getState().setDragging3D(!enabled)
    },
    [controls],
  )

  const releaseHeld = useCallback(() => {
    const current = held.current
    if (!current) return
    const body = bodies.current.get(current.id)
    if (body && current.active) {
      // The body's React type prop flips back to dynamic via heldPlacementId;
      // do it imperatively too so gravity takes over this same frame.
      body.setBodyType(RigidBodyType.Dynamic, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      justDragged.current = true
    }
    const store = useDisplayStore.getState()
    if (store.carryPlacementId === current.id) store.setCarryPlacement(null)
    store.setHeldPlacement(null)
    held.current = null
    setControlsEnabled(true)
  }, [setControlsEnabled])

  const activateHold = useCallback((state: HeldState, body: RapierRigidBody) => {
    // heldPlacementId drives the RigidBody type prop to kinematic, so
    // unrelated re-renders cannot flip the held body back to dynamic.
    useDisplayStore.getState().setHeldPlacement(state.id)
    body.setBodyType(RigidBodyType.KinematicPositionBased, true)
    const rotation = body.rotation()
    const q = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    // Snap to the nearest 90 degree preset so held items carry tidily.
    state.orientationIndex = nearestPresetIndex(q)
    state.targetQuaternion = PRESET_QUATERNIONS[state.orientationIndex].clone()
    state.active = true
  }, [])

  const rotateHeld = useCallback((direction: 1 | -1) => {
    const current = held.current
    if (!current || !current.active) return
    const count = PRESET_QUATERNIONS.length
    current.orientationIndex = (current.orientationIndex + direction + count) % count
    current.targetQuaternion = PRESET_QUATERNIONS[current.orientationIndex].clone()
  }, [])

  // Pick up a freshly spawned placement (picker carry mode).
  useEffect(() => {
    if (!carryPlacementId) return
    if (held.current?.id === carryPlacementId) return
    held.current = {
      id: carryPlacementId,
      mode: 'carry',
      active: false,
      startX: 0,
      startY: 0,
      orientationIndex: 0,
      targetQuaternion: PRESET_QUATERNIONS[0].clone(),
      wheelAccum: 0,
    }
    setControlsEnabled(false)
  }, [carryPlacementId, setControlsEnabled])

  // DOM listeners: pointer tracking, release, rotate, cancel, delete.
  useEffect(() => {
    const dom = gl.domElement

    const updateNdc = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect()
      pointerNdc.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
    }

    const onPointerMove = (event: PointerEvent) => {
      updateNdc(event)
      shiftDown.current = event.shiftKey
      const current = held.current
      if (current && current.mode === 'drag' && !current.active) {
        const dx = event.clientX - current.startX
        const dy = event.clientY - current.startY
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          const body = bodies.current.get(current.id)
          if (body) activateHold(current, body)
        }
      }
    }

    const onPointerUp = () => {
      const current = held.current
      if (!current) return
      if (current.mode === 'drag') {
        if (!current.active) {
          // Plain click: restore orbit, let selection happen.
          held.current = null
          setControlsEnabled(true)
          return
        }
        releaseHeld()
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      updateNdc(event)
      const current = held.current
      if (current && current.mode === 'carry' && event.button === 0) {
        // Click places the carried item.
        justDragged.current = true
        releaseHeld()
      }
    }

    const onWheel = (event: WheelEvent) => {
      const current = held.current
      if (!current || !current.active) return
      event.preventDefault()
      current.wheelAccum += event.deltaY
      while (current.wheelAccum > WHEEL_STEP) {
        rotateHeld(1)
        current.wheelAccum -= WHEEL_STEP
      }
      while (current.wheelAccum < -WHEEL_STEP) {
        rotateHeld(-1)
        current.wheelAccum += WHEEL_STEP
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      shiftDown.current = event.shiftKey

      if ((event.key === 'r' || event.key === 'R') && held.current) {
        const current = held.current
        const body = bodies.current.get(current.id)
        // Allow rotating a pressed-but-not-yet-dragged item too.
        if (body && !current.active) activateHold(current, body)
        rotateHeld(event.shiftKey ? -1 : 1)
        return
      }

      if (event.key === 'Escape' && held.current?.mode === 'carry') {
        const id = held.current.id
        held.current = null
        setControlsEnabled(true)
        useDisplayStore.getState().setCarryPlacement(null)
        useDisplayStore.getState().removeProduct(id)
        return
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !held.current
      ) {
        const { selectedProductId, removeProduct, selectProduct } =
          useDisplayStore.getState()
        if (selectedProductId) {
          removeProduct(selectedProductId)
          selectProduct(null)
        }
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      shiftDown.current = event.shiftKey
    }

    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gl, activateHold, releaseHeld, rotateHeld, setControlsEnabled])

  const quietSince = useRef(new Map<string, number>())

  // Follow the cursor while holding an item; watchdog the rest.
  useFrame((state) => {
    const now = state.clock.elapsedTime
    bodies.current.forEach((body, id) => {
      if (held.current?.id === id || body.isSleeping()) {
        quietSince.current.delete(id)
        return
      }
      if (body.bodyType() !== RigidBodyType.Dynamic) {
        quietSince.current.delete(id)
        return
      }

      const linvel = body.linvel()
      const angvel = body.angvel()
      const linSpeed = Math.hypot(linvel.x, linvel.y, linvel.z)
      const angSpeed = Math.hypot(angvel.x, angvel.y, angvel.z)

      // Velocity clamp: collisions with the hand-held kinematic body can
      // impart absurd speeds; cap them so items get nudged, not launched.
      if (linSpeed > MAX_LINEAR_SPEED) {
        const scale = MAX_LINEAR_SPEED / linSpeed
        body.setLinvel(
          { x: linvel.x * scale, y: linvel.y * scale, z: linvel.z * scale },
          true,
        )
      }
      if (angSpeed > MAX_ANGULAR_SPEED) {
        const scale = MAX_ANGULAR_SPEED / angSpeed
        body.setAngvel(
          { x: angvel.x * scale, y: angvel.y * scale, z: angvel.z * scale },
          true,
        )
      }

      // Settle watchdog: force-sleep visually still bodies.
      if (linSpeed + angSpeed * 4 < QUIET_SPEED) {
        const since = quietSince.current.get(id)
        if (since === undefined) {
          quietSince.current.set(id, now)
        } else if (now - since > QUIET_SECONDS) {
          quietSince.current.delete(id)
          body.sleep()
        }
      } else {
        quietSince.current.delete(id)
      }
    })

    const current = held.current
    if (!current) return
    const body = bodies.current.get(current.id)
    if (!body) return

    // Carry mode activates as soon as the spawned body registers.
    if (current.mode === 'carry' && !current.active) {
      activateHold(current, body)
      // Carried items start upright, not at their spawn rotation.
      current.orientationIndex = 0
      current.targetQuaternion = PRESET_QUATERNIONS[0].clone()
    }
    if (!current.active) return

    raycaster.setFromCamera(pointerNdc.current, camera)
    const origin = raycaster.ray.origin
    const direction = raycaster.ray.direction
    const translation = body.translation()

    let target: THREE.Vector3 | null = null

    if (shiftDown.current) {
      // Vertical mode: keep x/z, slide the item up and down along a
      // camera-facing plane through its current position.
      const normal = new THREE.Vector3(direction.x, 0, direction.z)
      if (normal.lengthSq() > 1e-6) {
        normal.normalize()
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          normal,
          new THREE.Vector3(translation.x, translation.y, translation.z),
        )
        const intersection = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(plane, intersection)) {
          target = new THREE.Vector3(translation.x, intersection.y, translation.z)
        }
      }
    } else {
      // Surface mode: cast against the physics world (excluding the held
      // body) and hover just above whatever is under the cursor.
      const ray = new rapier.Ray(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: direction.x, y: direction.y, z: direction.z },
      )
      const hit = world.castRay(
        ray,
        1000,
        true,
        undefined,
        undefined,
        undefined,
        body,
      )
      if (hit) {
        const point = ray.pointAt(hit.timeOfImpact)
        target = new THREE.Vector3(point.x, point.y + HOVER_OFFSET, point.z)
      }
    }

    if (!target) return

    // Keep the held item below the display ceiling (it is kinematic, so the
    // ceiling collider alone cannot stop it).
    const maxY = Math.max(2, maxDisplayHeight - 1)
    target.y = Math.min(Math.max(target.y, 0.5), maxY)

    // Smooth follow, exact rotation.
    const next = new THREE.Vector3(translation.x, translation.y, translation.z).lerp(
      target,
      0.4,
    )
    body.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z })

    const rotation = body.rotation()
    const currentQ = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    currentQ.slerp(current.targetQuaternion, 0.5)
    body.setNextKinematicRotation({
      x: currentQ.x,
      y: currentQ.y,
      z: currentQ.z,
      w: currentQ.w,
    })
  })

  const api = useMemo<DragManagerApi>(
    () => ({
      register: (id, body) => {
        bodies.current.set(id, body)
      },
      // Note: a suspense remount (GLB/texture load) unregisters and
      // re-registers the same id; the hold survives and resumes when the
      // body comes back. Deleted items resolve on the next release/escape.
      unregister: (id) => {
        bodies.current.delete(id)
      },
      beginGrab: (id, clientX, clientY) => {
        if (held.current) return
        held.current = {
          id,
          mode: 'drag',
          active: false,
          startX: clientX,
          startY: clientY,
          orientationIndex: 0,
          targetQuaternion: PRESET_QUATERNIONS[0].clone(),
          wheelAccum: 0,
        }
        setControlsEnabled(false)
      },
      consumeDragClick: () => {
        const was = justDragged.current
        justDragged.current = false
        return was
      },
      isHeld: (id) => held.current?.id === id,
    }),
    [setControlsEnabled],
  )

  return (
    <DragManagerContext.Provider value={api}>{children}</DragManagerContext.Provider>
  )
}

export function DragManager({ maxDisplayHeight, children }: DragManagerProps) {
  const physicsDisabled = usePhysicsDisabled()
  if (physicsDisabled) return <>{children}</>
  return (
    <DragManagerInner maxDisplayHeight={maxDisplayHeight}>{children}</DragManagerInner>
  )
}
