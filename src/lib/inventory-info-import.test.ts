import { describe, expect, it } from 'vitest'
import { makeProduct } from '../test/test-utils'
import {
  mergeInventoryInfoIntoProducts,
  mergeInventoryInfoRowsIntoProducts,
  shouldExcludeIcaBuyer,
} from './inventory-info-import'

const makeInventoryRow = ({
  itemNumber,
  casePack,
  caseWeight,
  unitLength,
  unitWidth,
  unitHeight,
  status = 'A',
}: {
  itemNumber: string | number
  status?: string
  casePack: number
  caseWeight: number
  unitLength: number
  unitWidth: number
  unitHeight: number
}) => {
  const row: unknown[] = []
  row[0] = itemNumber
  row[7] = status
  row[17] = casePack
  row[108] = caseWeight
  row[177] = unitLength
  row[178] = unitWidth
  row[179] = unitHeight
  return row
}

describe('mergeInventoryInfoRowsIntoProducts', () => {
  it('detects ICA buyers that should be excluded from the catalog', () => {
    expect(shouldExcludeIcaBuyer('DEFAULT')).toBe(true)
    expect(shouldExcludeIcaBuyer('')).toBe(true)
    expect(shouldExcludeIcaBuyer(' dcarn ')).toBe(true)
    expect(shouldExcludeIcaBuyer('BROSENBERG')).toBe(false)
  })

  it('updates product dimensions, case pack, and each weight by Kayco item number', () => {
    const product = makeProduct({
      id: 'prod-100100',
      sku: 'KED-GJ-64',
      kaycoItemNumber: '100100',
      width: 1,
      height: 1,
      depth: 1,
      weight: 1,
    })

    const result = mergeInventoryInfoRowsIntoProducts(
      [product],
      [
        ['citemno'],
        makeInventoryRow({
          itemNumber: '100100',
          casePack: 8,
          caseWeight: 38.3,
          unitLength: 4.4,
          unitWidth: 4.4,
          unitHeight: 10.5,
        }),
      ],
    )

    expect(result.updatedProducts).toBe(1)
    expect(result.products[0]).toMatchObject({
      width: 4.4,
      depth: 4.4,
      height: 10.5,
      unitsPerCase: 8,
    })
    expect(result.products[0].weight).toBe(4.79)
  })

  it('can match by SKU and creates products for new inventory rows', () => {
    const result = mergeInventoryInfoRowsIntoProducts(
      [
        makeProduct({
          id: 'prod-sku-match',
          sku: '100101',
        }),
      ],
      [
        ['citemno'],
        makeInventoryRow({
          itemNumber: '100101.0',
          casePack: 8,
          caseWeight: 40,
          unitLength: 5,
          unitWidth: 4,
          unitHeight: 9,
        }),
        makeInventoryRow({
          itemNumber: '999999',
          casePack: 12,
          caseWeight: 12,
          unitLength: 1,
          unitWidth: 1,
          unitHeight: 1,
        }),
      ],
    )

    expect(result.matchedRows).toBe(2)
    expect(result.skippedRows).toBe(0)
    expect(result.products).toHaveLength(2)
    expect(result.products[0].kaycoItemNumber).toBe('100101')
    expect(result.products[0].weight).toBe(5)
    expect(result.products[1].kaycoItemNumber).toBe('999999')
  })

  it('rounds imported each weight to 2 decimals', () => {
    const result = mergeInventoryInfoRowsIntoProducts(
      [
        makeProduct({
          id: 'prod-rounded',
          sku: '100102',
        }),
      ],
      [
        ['citemno'],
        makeInventoryRow({
          itemNumber: '100102',
          casePack: 3,
          caseWeight: 10,
          unitLength: 5,
          unitWidth: 4,
          unitHeight: 9,
        }),
      ],
    )

    expect(result.products[0].weight).toBe(3.33)
  })

  it('applies background inventory info including description-adjacent fields but not category', () => {
    const result = mergeInventoryInfoIntoProducts(
      [
        makeProduct({
          id: 'prod-100103',
          sku: '100103',
          brand: 'tuscanini',
          brandColor: '#1B4D3E',
          category: 'Keep Me',
        }),
      ],
      [
        {
          itemNumber: '100103',
          description: 'GRAPE JUICE WHITE 64OZ KEDEM',
          upc: '123456789012',
          brandCode: 'KJC',
          buyer: 'BROSENBERG',
          casePack: 8,
          caseCost: 26.51,
          width: 4.4,
          depth: 4.4,
          height: 10.5,
          weight: 4.81,
        },
      ],
    )

    expect(result.products[0]).toMatchObject({
      name: 'GRAPE JUICE WHITE 64OZ KEDEM',
      sku: '100103',
      upc: '123456789012',
      brand: 'kedem',
      brandCode: 'KJC',
      brandColor: '#991B1B',
      buyer: 'BROSENBERG',
      category: '',
      unitsPerCase: 8,
      caseCost: 26.51,
      weight: 4.81,
    })
  })

  it('updates matched products and preserves the rest of the catalog', () => {
    const result = mergeInventoryInfoIntoProducts(
      [
        makeProduct({
          id: 'active-product',
          sku: '100104',
          kaycoItemNumber: '100104',
        }),
        makeProduct({
          id: 'inactive-product',
          sku: '100105',
          kaycoItemNumber: '100105',
        }),
        makeProduct({
          id: 'manual-product',
          sku: 'MANUAL-SKU',
        }),
      ],
      [
        {
          itemNumber: '100104',
          status: 'A',
          description: 'ACTIVE ITEM',
          weight: 4.67,
        },
      ],
    )

    expect(result.products).toHaveLength(3)
    expect(result.products[0]).toMatchObject({
      id: 'active-product',
      name: 'ACTIVE ITEM',
      sku: '100104',
      kaycoItemNumber: '100104',
      weight: 4.67,
    })
    // Unmatched products survive the merge - manually authorized or
    // hand-imported items must not be dropped by an inventory refresh.
    const ids = result.products.map((product) => product.id)
    expect(ids).toContain('inactive-product')
    expect(ids).toContain('manual-product')
    expect(result.skippedRows).toBe(2)
  })
})
