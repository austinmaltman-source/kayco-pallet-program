import { describe, expect, it } from 'vitest'
import { applyRulesToPackInput } from '../apply'
import { getDefaultPalletSpec } from '../../retailer-specs'
import { makeProduct } from '../../../test/test-utils'

describe('rules pipeline', () => {
  it('applies min and max facings to pack quantities', () => {
    const product = makeProduct({ id: 'tuna' })
    const result = applyRulesToPackInput(
      {
        spec: getDefaultPalletSpec('full'),
        boxes: [{ product, quantity: 12 }],
      },
      [{ kind: 'min-max-facings', productId: 'tuna', min: 2, max: 5 }],
    )

    expect(result.input.boxes[0].quantity).toBe(5)
  })

  it('warns when capping references a product outside the assortment', () => {
    const product = makeProduct({ id: 'snack' })
    const result = applyRulesToPackInput(
      {
        spec: getDefaultPalletSpec('full'),
        boxes: [{ product, quantity: 1 }],
      },
      [{ kind: 'capping', productId: 'cap', quantity: 1 }],
    )

    expect(result.warnings[0]).toMatchObject({
      ruleKind: 'capping',
    })
  })

  it('orders block products contiguously before other products', () => {
    const a = makeProduct({ id: 'a', name: 'A' })
    const b = makeProduct({ id: 'b', name: 'B' })
    const c = makeProduct({ id: 'c', name: 'C' })
    const result = applyRulesToPackInput(
      {
        spec: getDefaultPalletSpec('full'),
        boxes: [
          { product: c, quantity: 1 },
          { product: a, quantity: 1 },
          { product: b, quantity: 1 },
        ],
      },
      [{ kind: 'block', productIds: ['a', 'b'] }],
    )

    expect(result.input.boxes.map((box) => box.product.id)).toEqual(['a', 'b', 'c'])
  })
})
