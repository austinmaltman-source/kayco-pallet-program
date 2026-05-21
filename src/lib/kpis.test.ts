import { describe, expect, it } from 'vitest'
import { computeKPIs } from './kpis'
import { getDefaultPalletSpec } from './retailer-specs'
import { makeProduct } from '../test/test-utils'
import type { PlacedProduct } from '../types'

function placed(id: string, productId: string, x: number, y: number, z: number): PlacedProduct {
  return {
    id,
    sourceProductId: productId,
    slotId: id,
    width: 10,
    height: 10,
    depth: 10,
    color: '#111111',
    label: 'Case',
    sku: 'CASE',
    position: { x, y, z },
    rotationDeg: 0,
    orientation3D: 'upright',
    quantity: 1,
  }
}

describe('pallet KPIs', () => {
  it('computes case, unit, weight, and utilization totals', () => {
    const product = makeProduct({
      id: 'case',
      width: 10,
      depth: 10,
      height: 10,
      weight: 25,
      unitsPerCase: 12,
    })
    const kpis = computeKPIs(
      [
        placed('a', 'case', 0, 6, 0),
        placed('b', 'case', 10, 6, 0),
      ],
      getDefaultPalletSpec('full'),
      [product],
    )

    expect(kpis.totalCases).toBe(2)
    expect(kpis.totalUnits).toBe(24)
    expect(kpis.totalWeightLb).toBe(50)
    expect(kpis.footprintUtilizationPct).toBeCloseTo(10.42, 1)
  })

  it('surfaces overheight, overhang, and overweight warnings', () => {
    const product = makeProduct({
      id: 'case',
      width: 10,
      depth: 10,
      height: 60,
      weight: 3000,
    })
    const kpis = computeKPIs(
      [placed('a', 'case', 44, 6, 0)],
      getDefaultPalletSpec('full'),
      [product],
    )

    expect(kpis.warnings.map((warning) => warning.kind)).toEqual(
      expect.arrayContaining(['overheight', 'overhang', 'overweight']),
    )
  })
})
