import type { PalletKPIs, PalletSpec, PalletWarning, PlacedProduct, Product } from '../types'
import { boxFromPlacement, intersects, overhangAmount, palletContainer } from './geometry/aabb'
import { computeCrushWarnings } from './geometry/crush'
import { isOrientationAllowed } from './geometry/orientation'
import { palletSupportSurface, supportSurfacePct } from './geometry/stability'

const SUPPORT_WARNING_THRESHOLD = 80

export function computeKPIs(
  placements: PlacedProduct[],
  spec: PalletSpec,
  products: Product[],
): PalletKPIs {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const boxes = placements
    .map((placement) =>
      boxFromPlacement(
        placement,
        placement.sourceProductId ? productMap.get(placement.sourceProductId) : undefined,
      ),
    )
    .filter((box): box is NonNullable<typeof box> => Boolean(box))

  const warnings: PalletWarning[] = []
  const container = palletContainer(spec)
  const supportSurface = palletSupportSurface(spec.widthIn, spec.depthIn, spec.baseHeightIn)

  for (const box of boxes) {
    const overhangIn = overhangAmount(box, spec)
    if (spec.noOverhang && overhangIn > 0) {
      warnings.push({ kind: 'overhang', placementId: box.placementId, overhangIn })
    }

    if (box.max.y > container.max.y) {
      warnings.push({ kind: 'overheight', usedIn: box.max.y, maxIn: spec.maxHeightIn })
    }

    const supportPct = supportSurfacePct(
      box,
      boxes.filter((candidate) => candidate.placementId !== box.placementId),
      [supportSurface],
    )
    if (supportPct < SUPPORT_WARNING_THRESHOLD) {
      warnings.push({
        kind: 'unsupported',
        placementId: box.placementId,
        supportPct,
      })
    }

    const placement = placements.find((entry) => entry.id === box.placementId)
    const product = box.productId ? productMap.get(box.productId) : undefined
    if (
      placement &&
      product &&
      !isOrientationAllowed(product, placement.orientation3D ?? 'upright')
    ) {
      warnings.push({
        kind: 'orientation-disallowed',
        placementId: box.placementId,
        orientation: placement.orientation3D ?? 'upright',
      })
    }
  }

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (intersects(boxes[i], boxes[j])) {
        warnings.push({
          kind: 'unsupported',
          placementId: boxes[j].placementId,
          supportPct: 0,
        })
      }
    }
  }

  warnings.push(...computeCrushWarnings(boxes))

  const totalWeightLb = boxes.reduce((sum, box) => sum + box.weightLb, 0)
  if (totalWeightLb > spec.maxLoadLb) {
    warnings.push({
      kind: 'overweight',
      lb: totalWeightLb,
      maxLb: spec.maxLoadLb,
    })
  }

  const totalCases = placements.reduce(
    (sum, placement) => sum + (placement.quantity ?? 1) * (placement.caseStackHeight ?? 1),
    0,
  )
  const totalUnits = placements.reduce((sum, placement) => {
    const product = placement.sourceProductId
      ? productMap.get(placement.sourceProductId)
      : undefined
    return (
      sum +
      (placement.quantity ?? 1) *
        (placement.caseStackHeight ?? 1) *
        (product?.unitsPerCase ?? 1)
    )
  }, 0)
  const caseVolume = boxes.reduce((sum, box) => {
    return sum + (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z)
  }, 0)
  const usableVolume =
    spec.widthIn * spec.depthIn * Math.max(1, spec.maxHeightIn - spec.baseHeightIn)
  const footprintArea = spec.widthIn * spec.depthIn
  const footprintUtilizationPct =
    boxes.length === 0
      ? 0
      : Math.min(
          100,
          (boxes.reduce((sum, box) => {
            return sum + (box.max.x - box.min.x) * (box.max.z - box.min.z)
          }, 0) /
            footprintArea) *
            100,
        )

  return {
    cubeUtilizationPct: usableVolume === 0 ? 0 : Math.min(100, (caseVolume / usableVolume) * 100),
    weightUtilizationPct:
      spec.maxLoadLb === 0 ? 0 : Math.min(100, (totalWeightLb / spec.maxLoadLb) * 100),
    footprintUtilizationPct,
    totalCases,
    totalUnits,
    totalWeightLb,
    heightUsedIn:
      boxes.length === 0
        ? spec.baseHeightIn
        : Math.max(...boxes.map((box) => box.max.y), spec.baseHeightIn),
    warnings,
  }
}
