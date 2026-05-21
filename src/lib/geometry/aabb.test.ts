import { describe, expect, it } from 'vitest'
import { boxFromPlacement, intersects, overhangAmount } from './aabb'
import { makeProduct } from '../../test/test-utils'
import type { PalletSpec, PlacedProduct } from '../../types'

const spec: PalletSpec = {
  id: 'gma-48x40',
  label: 'Test pallet',
  widthIn: 48,
  depthIn: 40,
  baseHeightIn: 6,
  maxLoadLb: 2500,
  maxHeightIn: 60,
  noOverhang: true,
  underhangMaxIn: 0,
  primaryFaceIn: 48,
}

function placement(overrides: Partial<PlacedProduct>): PlacedProduct {
  return {
    id: overrides.id ?? 'p-1',
    sourceProductId: overrides.sourceProductId,
    slotId: overrides.slotId ?? 'freeform-1',
    width: overrides.width ?? 10,
    height: overrides.height ?? 10,
    depth: overrides.depth ?? 10,
    color: overrides.color ?? '#111111',
    label: overrides.label ?? 'Case',
    sku: overrides.sku ?? 'CASE',
    position: overrides.position ?? { x: 0, y: 6, z: 0 },
    rotationDeg: overrides.rotationDeg,
    orientation3D: overrides.orientation3D,
    quantity: overrides.quantity,
  }
}

describe('AABB geometry', () => {
  it('detects overlaps and non-overlaps', () => {
    const product = makeProduct({ width: 10, depth: 10, height: 10 })
    const a = boxFromPlacement(placement({ id: 'a' }), product)
    const b = boxFromPlacement(placement({ id: 'b', position: { x: 9, y: 6, z: 0 } }), product)
    const c = boxFromPlacement(placement({ id: 'c', position: { x: 10, y: 6, z: 0 } }), product)

    expect(a && b && intersects(a, b)).toBe(true)
    expect(a && c && intersects(a, c)).toBe(false)
  })

  it('computes overhang from pallet footprint', () => {
    const product = makeProduct({ width: 10, depth: 10, height: 10 })
    const box = boxFromPlacement(
      placement({ position: { x: 42, y: 6, z: 0 } }),
      product,
    )

    expect(box ? overhangAmount(box, spec) : 0).toBe(4)
  })
})
