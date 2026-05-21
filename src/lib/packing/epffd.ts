import type { AABB } from '../geometry/aabb'
import { intersects, overhangAmount } from '../geometry/aabb'
import { getEffectiveCaseDimensions, isOrientationAllowed } from '../geometry/orientation'
import { palletSupportSurface, supportSurfacePct } from '../geometry/stability'
import { withProductPlanningDefaults } from '../product-variants'
import { updateExtremePoints } from './extremePoints'
import { applyPackingPattern } from './patterns'
import type {
  ExtremePoint,
  PackInput,
  PackOptions,
  PackResult,
  PackedPlacement,
} from './types'

type NormalizedOptions = PackOptions

interface ExpandedBox {
  key: string
  product: ReturnType<typeof withProductPlanningDefaults>
}

interface Candidate {
  placement: PackedPlacement
  box: AABB
  merit: number
}

function expandBoxes(input: PackInput): ExpandedBox[] {
  return input.boxes.flatMap((box) => {
    const product = withProductPlanningDefaults(box.product)
    return Array.from({ length: Math.max(0, Math.floor(box.quantity)) }, (_, index) => ({
      key: `${product.id}-${index}`,
      product,
    }))
  })
}

function toBox(candidate: ExpandedBox, placement: PackedPlacement): AABB {
  const dimensions = getEffectiveCaseDimensions(
    candidate.product,
    placement.orientation3D,
    placement.rotationDeg,
  )

  return {
    placementId: placement.id,
    productId: candidate.product.id,
    min: { x: placement.x, y: placement.y, z: placement.z },
    max: {
      x: placement.x + dimensions.width,
      y: placement.y + dimensions.height,
      z: placement.z + dimensions.depth,
    },
    weightLb: candidate.product.caseWeight ?? candidate.product.weight,
    maxStackLoadLb: candidate.product.maxStackLoadLb,
    stackable: candidate.product.stackable ?? true,
    fragile: candidate.product.fragile ?? false,
    crushable: candidate.product.crushable ?? false,
  }
}

function hasStableSupport(box: AABB, placed: AABB[], input: PackInput): boolean {
  return (
    supportSurfacePct(box, placed, [
      palletSupportSurface(input.spec.widthIn, input.spec.depthIn, input.spec.baseHeightIn),
    ]) >= 80
  )
}

function passesLightOnTop(box: AABB, placed: AABB[]): boolean {
  const supporters = placed.filter(
    (candidate) =>
      Math.abs(candidate.max.y - box.min.y) <= 0.05 &&
      candidate.max.x > box.min.x &&
      candidate.min.x < box.max.x &&
      candidate.max.z > box.min.z &&
      candidate.min.z < box.max.z,
  )

  return supporters.every((supporter) => box.weightLb <= supporter.weightLb * 1.2)
}

function findCandidate(
  item: ExpandedBox,
  points: ExtremePoint[],
  placed: AABB[],
  input: PackInput,
  options: NormalizedOptions,
): Candidate | null {
  const orientations = item.product.allowedOrientations ?? ['upright']
  const rotations: Array<0 | 90 | 180 | 270> = [0, 90]
  let best: Candidate | null = null

  for (const point of points) {
    for (const orientation of orientations) {
      if (!isOrientationAllowed(item.product, orientation)) continue

      for (const rotationDeg of rotations) {
        const placement: PackedPlacement = {
          id: item.key,
          productId: item.product.id,
          x: point.x,
          y: point.y,
          z: point.z,
          rotationDeg,
          orientation3D: orientation,
        }
        const box = toBox(item, placement)

        if (box.max.y > input.spec.maxHeightIn) continue
        if (overhangAmount(box, input.spec) > 0 && input.spec.noOverhang) continue
        if (placed.some((candidate) => intersects(box, candidate))) continue
        if (!hasStableSupport(box, placed, input)) continue
        if (options.lightOnTop && !passesLightOnTop(box, placed)) continue
        if (
          options.respectFragile &&
          placed.some(
            (candidate) =>
              candidate.fragile &&
              box.min.y >= candidate.max.y - 0.05 &&
              box.weightLb > candidate.weightLb * 1.2,
          )
        ) {
          continue
        }

        const projectedWeight =
          placed.reduce((sum, candidate) => sum + candidate.weightLb, 0) + box.weightLb
        if (projectedWeight > input.spec.maxLoadLb) continue

        const merit = box.min.y * 1_000_000 + box.min.z * 1_000 + box.min.x
        if (!best || merit < best.merit) {
          best = { placement, box, merit }
        }
      }
    }
  }

  return best
}

export function packEpffd(
  input: PackInput,
  options: PackOptions = {
    pattern: 'column',
    respectFragile: true,
    lightOnTop: true,
    homogeneousLayers: false,
  },
): PackResult {
  const expanded = expandBoxes(input).sort((a, b) => {
    const aWeight = a.product.caseWeight ?? a.product.weight
    const bWeight = b.product.caseWeight ?? b.product.weight
    const aVolume = (a.product.caseWidth ?? a.product.width) *
      (a.product.caseDepth ?? a.product.depth) *
      (a.product.caseHeight ?? a.product.height)
    const bVolume = (b.product.caseWidth ?? b.product.width) *
      (b.product.caseDepth ?? b.product.depth) *
      (b.product.caseHeight ?? b.product.height)
    return bWeight - aWeight || bVolume - aVolume
  })

  let points: ExtremePoint[] = [
    { x: 0, y: input.spec.baseHeightIn, z: 0 },
  ]
  const placedBoxes: AABB[] = []
  const placements: PackedPlacement[] = []
  const unplaced: PackResult['unplaced'] = []

  for (const item of expanded) {
    const candidate = findCandidate(item, points, placedBoxes, input, options)

    if (!candidate) {
      unplaced.push({
        productId: item.product.id,
        productName: item.product.name,
        reason: 'No orientation fits remaining space without overlap, overhang, or instability.',
      })
      continue
    }

    placedBoxes.push(candidate.box)
    placements.push(candidate.placement)
    points = updateExtremePoints(points, candidate.box, placedBoxes, {
      width: input.spec.widthIn,
      depth: input.spec.depthIn,
      maxY: input.spec.maxHeightIn,
    })
  }

  return {
    placements: applyPackingPattern(placements, options.pattern),
    unplaced,
  }
}
