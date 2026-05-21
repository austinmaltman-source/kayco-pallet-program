import { describe, expect, it } from 'vitest'
import type { AABB } from './aabb'
import { palletSupportSurface, supportSurfacePct } from './stability'

function box(id: string, x: number, y: number, z: number): AABB {
  return {
    placementId: id,
    min: { x, y, z },
    max: { x: x + 10, y: y + 10, z: z + 10 },
    weightLb: 10,
    stackable: true,
    fragile: false,
    crushable: false,
  }
}

describe('support surface checks', () => {
  it('treats the pallet deck as full support', () => {
    expect(
      supportSurfacePct(box('a', 0, 6, 0), [], [palletSupportSurface(48, 40, 6)]),
    ).toBe(100)
  })

  it('reports partial support on cases below', () => {
    const upper = box('upper', 5, 16, 0)
    const lower = box('lower', 0, 6, 0)

    expect(supportSurfacePct(upper, [lower])).toBe(50)
  })
})
