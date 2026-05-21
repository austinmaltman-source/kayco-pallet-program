import type { PalletSpec, PlacedProduct, Product } from '../../types'
import { getEffectiveCaseDimensions } from './orientation'

export interface AABB {
  placementId: string
  productId?: string
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
  weightLb: number
  maxStackLoadLb?: number
  stackable: boolean
  fragile: boolean
  crushable: boolean
}

export interface ContainerAABB {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

export function intersects(a: AABB, b: AABB, tolerance = 0.001): boolean {
  return (
    a.min.x < b.max.x - tolerance &&
    a.max.x > b.min.x + tolerance &&
    a.min.y < b.max.y - tolerance &&
    a.max.y > b.min.y + tolerance &&
    a.min.z < b.max.z - tolerance &&
    a.max.z > b.min.z + tolerance
  )
}

export function contains(container: ContainerAABB, box: AABB, tolerance = 0.001): boolean {
  return (
    box.min.x >= container.min.x - tolerance &&
    box.max.x <= container.max.x + tolerance &&
    box.min.y >= container.min.y - tolerance &&
    box.max.y <= container.max.y + tolerance &&
    box.min.z >= container.min.z - tolerance &&
    box.max.z <= container.max.z + tolerance
  )
}

export function overhangAmount(box: AABB, pallet: Pick<PalletSpec, 'widthIn' | 'depthIn'>): number {
  return Math.max(
    0,
    -box.min.x,
    box.max.x - pallet.widthIn,
    -box.min.z,
    box.max.z - pallet.depthIn,
  )
}

export function palletContainer(spec: PalletSpec): ContainerAABB {
  return {
    min: { x: 0, y: spec.baseHeightIn, z: 0 },
    max: { x: spec.widthIn, y: spec.maxHeightIn, z: spec.depthIn },
  }
}

export function boxFromPlacement(
  placement: PlacedProduct,
  product: Product | undefined,
): AABB | null {
  if (!placement.position) return null

  const dimensions = product
    ? getEffectiveCaseDimensions(
        product,
        placement.orientation3D ?? 'upright',
        placement.rotationDeg ?? 0,
      )
    : {
        width: placement.width,
        depth: placement.depth,
        height: placement.height,
      }
  const stackHeight = Math.max(1, placement.caseStackHeight ?? 1)
  const weight = product?.caseWeight ?? product?.weight ?? placement.width * placement.height * 0.01

  return {
    placementId: placement.id,
    productId: placement.sourceProductId,
    min: placement.position,
    max: {
      x: placement.position.x + dimensions.width,
      y: placement.position.y + dimensions.height * stackHeight,
      z: placement.position.z + dimensions.depth,
    },
    weightLb: weight * (placement.quantity ?? 1) * stackHeight,
    maxStackLoadLb: product?.maxStackLoadLb,
    stackable: product?.stackable ?? true,
    fragile: product?.fragile ?? false,
    crushable: product?.crushable ?? false,
  }
}

export function horizontalOverlapArea(a: AABB, b: AABB): number {
  const width = Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x))
  const depth = Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z))
  return width * depth
}

export function bottomArea(box: AABB): number {
  return Math.max(0, box.max.x - box.min.x) * Math.max(0, box.max.z - box.min.z)
}
