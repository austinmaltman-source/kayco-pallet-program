import * as THREE from 'three'
import type { DisplayProject, PlacedProduct, PalletType } from '../types'
import {
  buildTierConfigs,
  createDefaultWallConfigs,
  derivePlacementFromSlotId,
  getShelfPosition,
} from './shelfCoordinates'
import { getOrientationRotation } from './orientation-presets'
import { DEFAULT_GRID_COLUMNS } from './constants'

export interface PlacementTransform {
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

interface TransformContext {
  palletType: PalletType
  tierCount: number
  palletDimensions: { width: number; depth: number; height: number }
  maxDisplayHeight: number
  gridColumns?: number
}

// Compute the world transform for a slot-based placement. This is the bridge
// from the legacy slot model into the physics sandbox: it reuses the exact
// getShelfPosition math so migrated items land where they always rendered.
// Returns null when the slot data cannot be resolved (orphaned slot ids).
export function computePlacementTransform(
  placement: PlacedProduct,
  context: TransformContext,
): PlacementTransform | null {
  const tiers = buildTierConfigs(
    context.tierCount,
    context.maxDisplayHeight,
    context.palletType,
  )
  const wallConfigs = createDefaultWallConfigs(
    context.palletType,
    context.gridColumns ?? DEFAULT_GRID_COLUMNS,
  )

  const slotPlacement =
    placement.wall && placement.tier && placement.gridCol !== undefined
      ? {
          wall: placement.wall,
          tier: placement.tier,
          gridCol: placement.gridCol,
          colSpan: placement.colSpan ?? 1,
          displayMode: placement.displayMode ?? ('face-out' as const),
        }
      : (() => {
          const derived = derivePlacementFromSlotId(
            placement.slotId,
            tiers,
            context.palletType,
          )
          if (!derived) return null
          return {
            wall: derived.wall,
            tier: derived.tier,
            gridCol: derived.gridCol,
            colSpan: placement.colSpan ?? 1,
            displayMode: placement.displayMode ?? ('face-out' as const),
          }
        })()

  if (!slotPlacement) return null

  let shelfPosition
  try {
    shelfPosition = getShelfPosition(
      slotPlacement,
      {
        width: placement.width,
        height: placement.height,
        depth: placement.depth,
        source: 'manual',
      },
      { base: context.palletDimensions, maxWeight: 2500 },
      tiers,
      wallConfigs[slotPlacement.wall],
    )
  } catch {
    return null
  }

  // Replicate the legacy render rotation: wall rotation plus orientation
  // preset, combined component-wise (matches ProductRenderer behavior).
  const orientation = getOrientationRotation(placement.orientation)
  const euler = new THREE.Euler(
    shelfPosition.rotation[0] + orientation[0],
    shelfPosition.rotation[1] + orientation[1],
    shelfPosition.rotation[2] + orientation[2],
    'XYZ',
  )
  const q = new THREE.Quaternion().setFromEuler(euler)

  return {
    position: [
      shelfPosition.position[0],
      shelfPosition.position[1],
      shelfPosition.position[2],
    ],
    quaternion: [q.x, q.y, q.z, q.w],
  }
}

// Ensure every placement on a project carries a world transform. Slot-based
// placements get one computed; placements that already have a transform are
// left untouched (their physics-settled pose is the source of truth).
// Unresolvable slot placements are dropped rather than rendered nowhere.
export function migrateProjectPlacements(
  project: DisplayProject,
  retailer?: {
    palletDimensions: { width: number; depth: number; height: number }
    maxDisplayHeight: number
  },
): DisplayProject {
  const context: TransformContext = {
    palletType: project.palletType,
    tierCount: project.tierCount,
    palletDimensions: retailer?.palletDimensions ?? {
      width: 48,
      depth: 40,
      height: 6,
    },
    maxDisplayHeight: retailer?.maxDisplayHeight ?? 60,
  }

  let changed = false
  const placements = project.placements.flatMap((placement) => {
    if (placement.position && placement.quaternion) return [placement]
    const transform = computePlacementTransform(placement, context)
    changed = true
    if (!transform) {
      console.warn(
        `placementMigration: dropping unresolvable placement "${placement.label}" (${placement.id}) from project "${project.name}"`,
      )
      return []
    }
    return [{ ...placement, ...transform }]
  })

  if (!changed) return project
  return { ...project, placements }
}
