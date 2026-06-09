import React, { useEffect, useMemo, useRef } from 'react'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import type { PlacedProduct, Product } from '../../../types'
import { ProductRenderer } from '../products/ProductRenderer'
import { resolveProductWeight } from '../../../lib/dimensionEngine'
import { usePhysicsDisabled } from './SandboxPhysics'

interface ItemBodyProps {
  placement: PlacedProduct & {
    position: [number, number, number]
    quaternion: [number, number, number, number]
  }
  products: Product[]
  isSelected?: boolean
  onClick?: () => void
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
  onClick,
  onRotate,
  onDelete,
}) => {
  const physicsDisabled = usePhysicsDisabled()
  const bodyRef = useRef<RapierRigidBody>(null)

  // The body owns the world transform, so the renderer must not re-apply the
  // orientation preset baked into the quaternion.
  const renderPlacement = useMemo(
    () => ({ ...placement, orientation: 0 }),
    [placement],
  )

  const mass = useMemo(() => {
    const source = placement.sourceProductId
      ? products.find((product) => product.id === placement.sourceProductId)
      : undefined
    if (!source) return 1
    const weight = resolveProductWeight(source, products)
    return Number.isFinite(weight) && weight > 0 ? weight : 1
  }, [placement.sourceProductId, products])

  // Slot-derived placements sit exactly on a shelf surface, so they spawn
  // asleep and a reloaded pallet never twitches. Free transforms (physics
  // settled, or seeded by hand) spawn awake: if they are in contact they
  // auto-sleep immediately, and if they are floating they fall and settle.
  const slotDerived = Boolean(
    placement.wall !== undefined ||
      (placement.slotId && placement.slotId.includes('-')),
  )

  // Spawn slot-derived placements asleep, and teleport (still asleep) when
  // the store transform changes from outside the physics loop.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

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
      body.setTranslation({ x: px, y: py, z: pz }, false)
      body.setRotation({ x: qx, y: qy, z: qz, w: qw }, false)
      body.setLinvel({ x: 0, y: 0, z: 0 }, false)
      body.setAngvel({ x: 0, y: 0, z: 0 }, false)
    }
    if (slotDerived) body.sleep()
  }, [placement.position, placement.quaternion, slotDerived])

  const renderer = (
    <ProductRenderer
      product={renderPlacement}
      products={products}
      position={[0, 0, 0]}
      isSelected={isSelected}
      onClick={onClick}
      onRotate={onRotate}
      onDelete={onDelete}
    />
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
      type="dynamic"
      colliders={false}
      position={placement.position}
      quaternion={placement.quaternion}
      linearDamping={0.2}
      angularDamping={0.4}
    >
      <CuboidCollider
        args={[placement.width / 2, placement.height / 2, placement.depth / 2]}
        position={[0, placement.height / 2, 0]}
        mass={mass}
        friction={0.9}
        restitution={0.05}
      />
      {renderer}
    </RigidBody>
  )
}
