import type { PackedPlacement, PackOptions } from './types'

export function applyPackingPattern(
  placements: PackedPlacement[],
  pattern: PackOptions['pattern'],
): PackedPlacement[] {
  if (pattern === 'column') return placements

  return placements.map((placement, index) => {
    if (pattern === 'interlock') {
      const layer = Math.round(placement.y)
      return {
        ...placement,
        rotationDeg: layer % 2 === 0 ? placement.rotationDeg : rotate90(placement.rotationDeg),
      }
    }

    return {
      ...placement,
      rotationDeg: index % 2 === 0 ? placement.rotationDeg : rotate90(placement.rotationDeg),
    }
  })
}

function rotate90(rotation: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  switch (rotation) {
    case 0:
      return 90
    case 90:
      return 180
    case 180:
      return 270
    case 270:
      return 0
  }
}
