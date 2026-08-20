import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import type { PlacedProduct, Product, SelectMode } from '../../../types'
import { ProductRenderer } from '../products/ProductRenderer'
import { resolvePlacementWeight } from '../../../lib/dimensionEngine'
import { useDisplayStore } from '../../../stores/display-store'
import { usePhysicsDisabled } from './SandboxPhysics'
import { useDragManager } from './DragManager'
import { queueSettledTransform } from './settle'
import { deriveMerchBlockLayout } from '../products/merchUtils'

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
  onClick?: (mode: SelectMode) => void
  onRotate?: () => void
  onDelete?: () => void
}

const EPSILON = 0.01

// Shared marker object: identifies a body as product (not shelf/pallet
// structure) for the drag raycast filter.
const ITEM_USER_DATA = { isItem: true }

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
  // Reactive held state: while held (directly or as part of a dragged
  // multi-selection), the body type prop is kinematic so re-renders re-apply
  // the correct type instead of reverting to dynamic.
  const isHeldByCursor = useDisplayStore(
    (s) =>
      s.heldPlacementId === placement.id ||
      s.heldGroupIds.includes(placement.id),
  )
  // While any item is being dragged, every OTHER item is pinned. Merchandised
  // shelves are packed touching, so without this, moving one bottle shoves its
  // neighbours off the shelf - a planogram tool must place, not play pinball.
  // Declarative (not imperative) so a re-render mid-drag cannot unpin them.
  const isDragging = useDisplayStore((s) => s.isDragging3D)
  const isPinned = isDragging && !isHeldByCursor

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

  // Unit-block placements (unpacked merchandising: rows of touching units)
  // carry UNIT dims + a facings/rows/layers grid; the collider must span the
  // whole block exactly like the renderer does.
  const colliderDims = useMemo(() => {
    if (placement.caseConfig || !placement.facings) {
      return {
        width: placement.width,
        height: placement.height,
        depth: placement.depth,
      }
    }
    const layout = deriveMerchBlockLayout(placement, {
      width: placement.width,
      height: placement.height,
      depth: placement.depth,
    })
    return {
      width: layout.blockWidth,
      height: layout.blockHeight,
      depth: layout.blockDepth,
    }
  }, [placement])

  // Slot-derived and auto-filled placements sit exactly on a shelf surface,
  // so they spawn asleep and a reloaded pallet never twitches. Free
  // transforms (physics settled, or freshly spawned) spawn awake: if they are
  // in contact they auto-sleep immediately, and if they are floating they
  // fall and settle.
  const slotDerived = Boolean(
    placement.spawnAsleep ||
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

  // Last store transform this body was synced to. The effect below compares
  // against THIS rather than the live body pose: comparing to the body would
  // re-teleport an item every time physics (or the user's drag) moved it away
  // from a store value that has not been written back yet.
  const appliedRef = useRef<{
    position: [number, number, number]
    quaternion: [number, number, number, number]
  } | null>(null)

  // Spawn resting placements asleep, and teleport when the store transform
  // changes from OUTSIDE the physics loop (undo, nudge, rotate, re-fill).
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    // Never fight the user's hand.
    if (dragManager?.isHeld(placement.id)) return

    const [px, py, pz] = placement.position
    const [qx, qy, qz, qw] = placement.quaternion
    const applied = appliedRef.current
    const isFirstSync = applied === null
    const storeChanged =
      isFirstSync ||
      Math.abs(applied.position[0] - px) > EPSILON ||
      Math.abs(applied.position[1] - py) > EPSILON ||
      Math.abs(applied.position[2] - pz) > EPSILON ||
      Math.abs(applied.quaternion[0] - qx) > EPSILON ||
      Math.abs(applied.quaternion[1] - qy) > EPSILON ||
      Math.abs(applied.quaternion[2] - qz) > EPSILON ||
      Math.abs(applied.quaternion[3] - qw) > EPSILON

    appliedRef.current = {
      position: [px, py, pz],
      quaternion: [qx, qy, qz, qw],
    }
    if (!storeChanged) return

    const t = body.translation()
    const bodyIsElsewhere =
      Math.abs(t.x - px) > EPSILON ||
      Math.abs(t.y - py) > EPSILON ||
      Math.abs(t.z - pz) > EPSILON
    if (bodyIsElsewhere || isFirstSync) {
      body.setTranslation({ x: px, y: py, z: pz }, true)
      body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    // Items placed exactly on a surface rest immediately; waking hundreds of
    // touching bodies at once is what makes an auto-filled pallet explode.
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
    const modifier = dragManager?.clickModifier() ?? null
    onClick?.(
      modifier === 'shift' ? 'same-product' : modifier === 'meta' ? 'toggle' : 'single',
    )
  }, [dragManager, onClick])

  // Pointer-downs are captured (and stopped) by ProductHoverEffect's root
  // group, so the grab MUST flow through this prop - a wrapper group above
  // the renderer never sees the event.
  const handleDragStart = useCallback(
    (pointer: { clientX: number; clientY: number }) => {
      dragManager?.beginGrab(placement.id, pointer.clientX, pointer.clientY)
    },
    [dragManager, placement.id],
  )

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
        onDragStart={handleDragStart}
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
      type={isHeldByCursor ? 'kinematicPosition' : isPinned ? 'fixed' : 'dynamic'}
      // Marks this body as product rather than structure, so the drag
      // raycast can follow the shelf underneath instead of landing the held
      // item on top of whatever it happens to be passing over. Stable
      // reference: a fresh object each render churns the rigid body.
      userData={ITEM_USER_DATA}
      colliders={false}
      ccd
      position={placement.position}
      quaternion={placement.quaternion}
      linearDamping={0.5}
      angularDamping={1.5}
      onSleep={handleSleep}
    >
      <CuboidCollider
        args={[colliderDims.width / 2, colliderDims.height / 2, colliderDims.depth / 2]}
        position={[0, colliderDims.height / 2, 0]}
        mass={mass}
        friction={0.9}
        restitution={0.05}
      />
      {renderer}
    </RigidBody>
  )
}
