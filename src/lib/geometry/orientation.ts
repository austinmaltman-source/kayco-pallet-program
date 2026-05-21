import type { Orientation3D, Product } from '../../types'
import { withProductPlanningDefaults } from '../product-variants'

export interface EffectiveCaseDimensions {
  width: number
  depth: number
  height: number
}

function applyOrientation(
  dimensions: EffectiveCaseDimensions,
  orientation: Orientation3D,
): EffectiveCaseDimensions {
  switch (orientation) {
    case 'upright':
    case 'inverted':
      return dimensions
    case 'on-side':
      return {
        width: dimensions.width,
        depth: dimensions.height,
        height: dimensions.depth,
      }
    case 'on-end':
      return {
        width: dimensions.height,
        depth: dimensions.depth,
        height: dimensions.width,
      }
  }
}

function applyRotation(
  dimensions: EffectiveCaseDimensions,
  rotationDeg: 0 | 90 | 180 | 270,
): EffectiveCaseDimensions {
  if (rotationDeg === 90 || rotationDeg === 270) {
    return {
      width: dimensions.depth,
      depth: dimensions.width,
      height: dimensions.height,
    }
  }

  return dimensions
}

export function getEffectiveCaseDimensions(
  product: Product,
  orientation: Orientation3D = 'upright',
  rotationDeg: 0 | 90 | 180 | 270 = 0,
): EffectiveCaseDimensions {
  const normalized = withProductPlanningDefaults(product)
  const base = {
    width: normalized.caseWidth ?? normalized.width,
    depth: normalized.caseDepth ?? normalized.depth,
    height: normalized.caseHeight ?? normalized.height,
  }

  return applyRotation(applyOrientation(base, orientation), rotationDeg)
}

export function isOrientationAllowed(
  product: Product,
  orientation: Orientation3D = 'upright',
): boolean {
  return (withProductPlanningDefaults(product).allowedOrientations ?? ['upright']).includes(
    orientation,
  )
}
