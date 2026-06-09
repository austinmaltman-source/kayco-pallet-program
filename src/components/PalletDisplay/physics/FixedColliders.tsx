import React from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import type { TierConfig, PalletType } from '../../../types'
import { usePhysicsDisabled } from './SandboxPhysics'

const PLATFORM_THICKNESS = 1
const WALL_THICKNESS = 0.75
const SHELF_LIP_HEIGHT = 1.4

interface FixedCollidersProps {
  tiers: TierConfig[]
  palletType: PalletType
  palletDimensions: { width: number; depth: number; height: number }
}

// Invisible static collision geometry mirroring what the scene renders:
// the ground, the wooden pallet base, and each tier's platform, walls, and
// retaining lips. Dynamic item bodies rest on and collide with these.
export const FixedColliders: React.FC<FixedCollidersProps> = ({
  tiers,
  palletType,
  palletDimensions,
}) => {
  const physicsDisabled = usePhysicsDisabled()
  if (physicsDisabled) return null

  const isHalf = palletType === 'half'
  const palletHeight = palletDimensions.height

  return (
    <RigidBody type="fixed" colliders={false}>
      {/* Ground plane (items knocked off the pallet land here) */}
      <CuboidCollider args={[200, 0.5, 200]} position={[0, -0.5, 0]} />

      {/* Wooden pallet base */}
      <CuboidCollider
        args={[palletDimensions.width / 2, palletHeight / 2, palletDimensions.depth / 2]}
        position={[0, palletHeight / 2, 0]}
      />

      {tiers.map((tier) => {
        const yBase = palletHeight + tier.yOffset
        const platformCenterY = yBase + PLATFORM_THICKNESS / 2
        const platformTopY = yBase + PLATFORM_THICKNESS
        const innerWidth = Math.max(2, tier.width - tier.shelfDepth * 2)
        const innerDepth = Math.max(2, tier.depth - tier.shelfDepth * 2)

        return (
          <React.Fragment key={tier.id}>
            {/* Tier platform */}
            <CuboidCollider
              args={[tier.width / 2, PLATFORM_THICKNESS / 2, tier.depth / 2]}
              position={[0, platformCenterY, 0]}
            />

            {isHalf ? (
              <>
                {/* Solid back wall */}
                <CuboidCollider
                  args={[tier.width / 2, tier.trayHeight / 2, WALL_THICKNESS / 2]}
                  position={[
                    0,
                    platformTopY + tier.trayHeight / 2,
                    -tier.depth / 2 + WALL_THICKNESS / 2,
                  ]}
                />
                {/* Side panels */}
                <CuboidCollider
                  args={[WALL_THICKNESS / 2, tier.trayHeight / 2, tier.depth / 2]}
                  position={[
                    -tier.width / 2 + WALL_THICKNESS / 2,
                    platformTopY + tier.trayHeight / 2,
                    0,
                  ]}
                />
                <CuboidCollider
                  args={[WALL_THICKNESS / 2, tier.trayHeight / 2, tier.depth / 2]}
                  position={[
                    tier.width / 2 - WALL_THICKNESS / 2,
                    platformTopY + tier.trayHeight / 2,
                    0,
                  ]}
                />
                {/* Front retaining lip */}
                <CuboidCollider
                  args={[tier.width / 2, SHELF_LIP_HEIGHT / 2, 0.21]}
                  position={[
                    0,
                    platformTopY + SHELF_LIP_HEIGHT / 2,
                    tier.depth / 2 - 0.21,
                  ]}
                />
              </>
            ) : (
              <>
                {/* Hollow center column, modeled as one solid block - items
                    rest on the trays around it and cannot be pushed inside */}
                <CuboidCollider
                  args={[innerWidth / 2, tier.trayHeight / 2, innerDepth / 2]}
                  position={[0, platformTopY + tier.trayHeight / 2, 0]}
                />

                {/* Retaining lips on all four faces */}
                <CuboidCollider
                  args={[tier.width / 2, SHELF_LIP_HEIGHT / 2, 0.21]}
                  position={[0, platformTopY + SHELF_LIP_HEIGHT / 2, tier.depth / 2 - 0.21]}
                />
                <CuboidCollider
                  args={[tier.width / 2, SHELF_LIP_HEIGHT / 2, 0.21]}
                  position={[0, platformTopY + SHELF_LIP_HEIGHT / 2, -tier.depth / 2 + 0.21]}
                />
                <CuboidCollider
                  args={[0.21, SHELF_LIP_HEIGHT / 2, tier.depth / 2]}
                  position={[-tier.width / 2 + 0.21, platformTopY + SHELF_LIP_HEIGHT / 2, 0]}
                />
                <CuboidCollider
                  args={[0.21, SHELF_LIP_HEIGHT / 2, tier.depth / 2]}
                  position={[tier.width / 2 - 0.21, platformTopY + SHELF_LIP_HEIGHT / 2, 0]}
                />
              </>
            )}
          </React.Fragment>
        )
      })}
    </RigidBody>
  )
}
