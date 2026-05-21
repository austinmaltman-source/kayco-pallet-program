import type { AABB, ContainerAABB } from './aabb'
import { bottomArea, horizontalOverlapArea } from './aabb'

export interface SupportSurface extends ContainerAABB {
  surfaceY: number
}

export function supportSurfacePct(
  box: AABB,
  supportingBoxes: AABB[],
  supportSurfaces: SupportSurface[] = [],
  tolerance = 0.05,
): number {
  const area = bottomArea(box)
  if (area === 0) return 0

  const supportedByBoxes = supportingBoxes.reduce((sum, supporter) => {
    const aligned = Math.abs(supporter.max.y - box.min.y) <= tolerance
    return aligned ? sum + horizontalOverlapArea(box, supporter) : sum
  }, 0)

  const supportedBySurfaces = supportSurfaces.reduce((sum, surface) => {
    const aligned = Math.abs(surface.surfaceY - box.min.y) <= tolerance
    if (!aligned) return sum

    const overlapWidth = Math.max(
      0,
      Math.min(box.max.x, surface.max.x) - Math.max(box.min.x, surface.min.x),
    )
    const overlapDepth = Math.max(
      0,
      Math.min(box.max.z, surface.max.z) - Math.max(box.min.z, surface.min.z),
    )
    return sum + overlapWidth * overlapDepth
  }, 0)

  return Math.min(100, ((supportedByBoxes + supportedBySurfaces) / area) * 100)
}

export function palletSupportSurface(widthIn: number, depthIn: number, surfaceY: number): SupportSurface {
  return {
    surfaceY,
    min: { x: 0, y: surfaceY, z: 0 },
    max: { x: widthIn, y: surfaceY, z: depthIn },
  }
}
