import { describe, expect, it } from 'vitest'
import { validateFreeformPlacement } from './freeform-validator'
import { getDefaultPalletSpec } from '../retailer-specs'
import { makeProduct } from '../../test/test-utils'
import type { PlacedProduct } from '../../types'

function placed(id: string, x: number, y: number, z: number): PlacedProduct {
  return {
    id,
    sourceProductId: 'case',
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
  }
}

describe('freeform placement validator', () => {
  const product = makeProduct({
    id: 'case',
    width: 10,
    depth: 10,
    height: 10,
    allowedOrientations: ['upright'],
  })
  const spec = getDefaultPalletSpec('full')

  it('blocks collisions', () => {
    const result = validateFreeformPlacement(
      placed('next', 9, 6, 0),
      [placed('existing', 0, 6, 0)],
      [product],
      spec,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.rule)).toContain('collision')
  })

  it('blocks overhang when the retailer spec forbids it', () => {
    const result = validateFreeformPlacement(placed('next', 42, 6, 0), [], [product], spec)

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.rule)).toContain('overhang')
  })

  it('blocks disallowed orientations', () => {
    const candidate = {
      ...placed('next', 0, 6, 0),
      orientation3D: 'on-side' as const,
    }
    const result = validateFreeformPlacement(candidate, [], [product], spec)

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.rule)).toContain('orientation')
  })
})
