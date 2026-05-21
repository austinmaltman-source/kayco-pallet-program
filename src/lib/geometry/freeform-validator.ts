import type {
  FullValidationResult,
  PalletSpec,
  PlacedProduct,
  Product,
} from '../../types'
import { boxFromPlacement, intersects, overhangAmount, palletContainer } from './aabb'
import { computeCrushWarnings } from './crush'
import { isOrientationAllowed } from './orientation'
import { palletSupportSurface, supportSurfacePct } from './stability'

export function validateFreeformPlacement(
  placement: PlacedProduct,
  existingPlacements: PlacedProduct[],
  products: Product[],
  spec: PalletSpec,
): FullValidationResult {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const product = placement.sourceProductId
    ? productMap.get(placement.sourceProductId)
    : undefined
  const box = boxFromPlacement(placement, product)
  const errors: FullValidationResult['errors'] = []
  const warnings: FullValidationResult['warnings'] = []

  if (!box) {
    return {
      valid: false,
      errors: [{ rule: 'position', reason: 'Placement is missing a freeform position.' }],
      warnings,
      suggestions: [],
    }
  }

  if (product && !isOrientationAllowed(product, placement.orientation3D ?? 'upright')) {
    errors.push({
      rule: 'orientation',
      reason: `${placement.orientation3D ?? 'upright'} is not allowed for ${product.name}.`,
    })
  }

  const container = palletContainer(spec)
  if (box.max.y > container.max.y) {
    errors.push({
      rule: 'height',
      reason: `Placement reaches ${box.max.y.toFixed(1)} in but ${spec.label} allows ${spec.maxHeightIn.toFixed(1)} in.`,
    })
  }

  const overhangIn = overhangAmount(box, spec)
  if (spec.noOverhang && overhangIn > 0) {
    errors.push({
      rule: 'overhang',
      reason: `Placement extends ${overhangIn.toFixed(1)} in beyond the pallet footprint.`,
    })
  }

  const existingBoxes = existingPlacements
    .filter((entry) => entry.id !== placement.id)
    .map((entry) =>
      boxFromPlacement(
        entry,
        entry.sourceProductId ? productMap.get(entry.sourceProductId) : undefined,
      ),
    )
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  const collision = existingBoxes.find((candidate) => intersects(box, candidate))
  if (collision) {
    errors.push({
      rule: 'collision',
      reason: `Placement overlaps ${collision.placementId}.`,
    })
  }

  const supportPct = supportSurfacePct(box, existingBoxes, [
    palletSupportSurface(spec.widthIn, spec.depthIn, spec.baseHeightIn),
  ])
  if (supportPct < 80) {
    warnings.push({
      rule: 'support',
      reason: `Only ${supportPct.toFixed(0)}% of the case bottom is supported.`,
    })
  }

  const crushWarnings = computeCrushWarnings([...existingBoxes, box])
  for (const warning of crushWarnings) {
    if (warning.kind === 'overweight' || warning.kind === 'overheight') continue
    if (warning.placementId !== placement.id) continue
    if (warning.kind === 'crush') {
      errors.push({
        rule: 'crush',
        reason: `Stack load is ${warning.loadAboveLb.toFixed(1)} lb over a ${warning.maxLoadLb.toFixed(1)} lb limit.`,
      })
    } else if (warning.kind === 'fragile-under-heavy') {
      warnings.push({
        rule: 'fragile',
        reason: 'A fragile case has a heavier case above it.',
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions: [],
  }
}
