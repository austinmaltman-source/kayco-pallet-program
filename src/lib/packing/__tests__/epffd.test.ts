import { describe, expect, it } from 'vitest'
import { packEpffd } from '../epffd'
import { makeProduct } from '../../../test/test-utils'
import type { PalletSpec } from '../../../types'

function spec(overrides: Partial<PalletSpec> = {}): PalletSpec {
  return {
    id: 'custom',
    label: 'Test pallet',
    widthIn: 20,
    depthIn: 20,
    baseHeightIn: 6,
    maxLoadLb: 2500,
    maxHeightIn: 46,
    noOverhang: true,
    underhangMaxIn: 0,
    primaryFaceIn: 48,
    ...overrides,
  }
}

describe('EP-FFD packer', () => {
  it('places four identical 10 in cubes into a 20 x 20 pallet', () => {
    const product = makeProduct({
      id: 'cube',
      width: 10,
      depth: 10,
      height: 10,
      weight: 5,
    })

    const result = packEpffd({
      spec: spec(),
      boxes: [{ product, quantity: 4 }],
    })

    expect(result.unplaced).toEqual([])
    expect(result.placements).toHaveLength(4)
  })

  it('puts heavy cases below light cases', () => {
    const heavy = makeProduct({
      id: 'heavy',
      name: 'Heavy',
      width: 20,
      depth: 20,
      height: 10,
      weight: 50,
    })
    const light = makeProduct({
      id: 'light',
      name: 'Light',
      width: 20,
      depth: 20,
      height: 10,
      weight: 5,
    })

    const result = packEpffd({
      spec: spec(),
      boxes: [
        { product: light, quantity: 1 },
        { product: heavy, quantity: 1 },
      ],
    })

    const heavyPlacement = result.placements.find((placement) => placement.productId === 'heavy')
    const lightPlacement = result.placements.find((placement) => placement.productId === 'light')
    expect(heavyPlacement?.y).toBe(6)
    expect((lightPlacement?.y ?? 0) > (heavyPlacement?.y ?? 0)).toBe(true)
  })

  it('returns overhanging cases as unplaced', () => {
    const product = makeProduct({
      id: 'wide',
      name: 'Too Wide',
      width: 30,
      depth: 10,
      height: 10,
      weight: 5,
      allowedOrientations: ['upright'],
    })

    const result = packEpffd({
      spec: spec(),
      boxes: [{ product, quantity: 1 }],
    })

    expect(result.placements).toHaveLength(0)
    expect(result.unplaced[0]).toMatchObject({
      productId: 'wide',
    })
  })
})
