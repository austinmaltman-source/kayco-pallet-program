import { describe, expect, it } from 'vitest'
import {
  buildProductPlanningWorkbookBuffer,
  parseProductPlanningWorkbook,
} from './excel-template'
import { makeProduct } from '../test/test-utils'

describe('product planning Excel template', () => {
  it('round-trips Spaceman-grade product fields', async () => {
    const product = makeProduct({
      id: 'prod-case',
      name: 'Heavy Glass Case',
      width: 12,
      depth: 10,
      height: 8,
      weight: 24,
      unitsPerCase: 6,
      allowedOrientations: ['upright', 'on-side'],
      stackable: true,
      fragile: true,
      crushable: false,
      maxStackLoadLb: 42,
      nestingPercent: 10,
      shelfReadyTray: true,
      heroImageUrl: '/products/heavy-glass.png',
    })

    const buffer = await buildProductPlanningWorkbookBuffer([product])
    const parsed = await parseProductPlanningWorkbook(buffer, [product])

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      id: 'prod-case',
      caseWidth: 12,
      caseDepth: 10,
      caseHeight: 8,
      caseWeight: 24,
      allowedOrientations: ['upright', 'on-side'],
      stackable: true,
      fragile: true,
      crushable: false,
      maxStackLoadLb: 42,
      nestingPercent: 10,
      shelfReadyTray: true,
      heroImageUrl: '/products/heavy-glass.png',
    })
  })
})
