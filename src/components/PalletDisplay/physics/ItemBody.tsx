import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import type { PlacedProduct, Product } from '../../../types'
import { ProductRenderer } from '../products/ProductRenderer'
import { resolvePlacementWeight } from '../../../lib/dimensionEngine'
import { useDisplayStore } from '../../../stores/display-store'
import { usePhysicsDisabled } from './SandboxPhysics'
import { useDragManager } from './DragManager'
import { queueSettledTransform } from './settle'

interface ItemBodyProps {
  placement: PlacedProduct & {
    position: [number, number, number]
    quaternion: [number, number, number, number]
  }
  products: Product[]
  isSelected?: boolean
  // The primary (last-clicked) selection shows the floating action pill;
  // other multi-selected items only get the highlight outline.
  isPrimary?: boolean
  onClick?: (additive: boolean) => void
  onRotate?: () => void
  onDelete?: () => void
}

const EPSILON = 0.01

// A placed item as a dynamic rigid body. The body origin is the item's
// bottom-center anchor (matching the render convention), so the cuboid
// collider is offset up by half the height. Bodies spawn asleep at their
// persisted transform; the store transform is re-applied if it changes
// externally (rotate button, slot move, undo).
export const ItemBody: React.FC<ItemBodyProps> = ({
  placement,
  products,
  isSelected = false,
  isPrimary = true,
  onClick,
  onRotate,
  onDelete,
}) => {
  const physicsDisabled = usePhysicsDisabled()
  const dragManager = useDragManager()
  const bodyRef = useRef<RapierRigidBody>(null)
  // Reactive held state: while held, the body type prop is kinematic so
  // re-renders re-apply the correct type instead of reverting to dynamic.
  const isHeldByCursor = useDisplayStore(
    (s) => s.heldPlacementId === placement.id,
  )

  // The body owns the world transform, so the renderer must not re-apply the
  // orientation preset baked into the quaternion.
  const renderPlacement = useMemo(
    () => ({ ...placement, orientation: 0 }),
    [placement],
  )

  const mass = useMemo(() => {
    const weight = resolvePlacementWeight(placement, products)
    return Number.isFinite(weight) && weight > 0 ? weight : 1
  }, [placement, products])

  // Slot-derived placements sit exactly on a shelf surface, so they spawn
  // asleep and a reloaded pallet never twitches. Free transforms (physics
  // settled, or freshly spawned) spawn awake: if they are in contact they
  // auto-sleep immediately, and if they are floating they fall and settle.
  const slotDerived = Boolean(
    placement.wall !== undefined ||
      (placement.slotId && placement.slotId.includes('-')),
  )

  // Register with the drag manager so pointer grabs can reach the body.
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !dragManager) return
    dragManager.register(placement.id, body)
    return () => dragManager.unregister(placement.id)
  }, [dragManager, placement.id])

  // Spawn slot-derived placements asleep, and teleport (still asleep) when
  // the store transform changes from outside the physics loop.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    // Never fight the user's hand.
    if (dragManager?.isHeld(placement.id)) return

    const t = body.translation()
    const r = body.rotation()
    const [px, py, pz] = placement.position
    const [qx, qy, qz, qw] = placement.quaternion
    const moved =
      Math.abs(t.x - px) > EPSILON ||
      Math.abs(t.y - py) > EPSILON ||
      Math.abs(t.z - pz) > EPSILON ||
      Math.abs(r.x - qx) > EPSILON ||
      Math.abs(r.y - qy) > EPSILON ||
      Math.abs(r.z - qz) > EPSILON ||
      Math.abs(r.w - qw) > EPSILON

    if (moved) {
      body.setTranslation({ x: px, y: py, z: pz }, true)
      body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    if (slotDerived) body.sleep()
  }, [placement.position, placement.quaternion, slotDerived, dragManager, placement.id])

  // When the body comes to rest after physics moved it, persist the settled
  // pose. The store skips writes that are within noise of what it has.
  const handleSleep = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    const t = body.translation()
    const r = body.rotation()
    queueSettledTransform({
      id: placement.id,
      position: [t.x, t.y, t.z],
      quaternion: [r.x, r.y, r.z, r.w],
    })
  }, [placement.id])

  const handleClick = useCallback(() => {
    // Swallow the synthetic click that follows a drag release.
    if (dragManager?.consumeDragClick()) return
    onClick?.(dragManager?.wasAdditiveClick() ?? false)
  }, [dragManager, onClick])

  // Per-item suspense boundary: a loading texture or GLB must blank only
  // this item's visuals, not suspend (and remount) the whole physics scene.
  const renderer = (
    <React.Suspense fallback={null}>
      <ProductRenderer
        product={renderPlacement}
        products={products}
        position={[0, 0, 0]}
        isSelected={isSelected}
        isPrimary={isPrimary}
        onClick={handleClick}
        onRotate={onRotate}
        onDuplicate={() =>
          useDisplayStore.getState().duplicatePlacement(placement.id)
        }
        onDelete={onDelete}
      />
    </React.Suspense>
  )

  if (physicsDisabled) {
    // Static fallback when Rapier is unavailable - render at the persisted
    // transform without a physics body.
    return (
      <group position={placement.position} quaternion={placement.quaternion}>
        {renderer}
      </group>
    )
  }

  return (
    <RigidBody
      ref={bodyRef}
      type={isHeldByCursor ? 'kinematicPosition' : 'dynamic'}
      colliders={false}
      position={placement.position}
      quaternion={placement.quaternion}
      linearDamping={0.5}
      angularDamping={1.5}
      onSleep={handleSleep}
    >
      <CuboidCollider
        args={[placement.width / 2, placement.height / 2, placement.depth / 2]}
        position={[0, placement.height / 2, 0]}
        mass={mass}
        friction={0.9}
        restitution={0.05}
      />
      <group
        onPointerDown={(event) => {
          if (!dragManager) return
          event.stopPropagation()
          dragManager.beginGrab(
            placement.id,
            event.nativeEvent.clientX,
            event.nativeEvent.clientY,
          )
        }}
      >
        {renderer}
      </group>
    </RigidBody>
  )
}
