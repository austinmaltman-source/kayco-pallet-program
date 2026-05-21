import { describe, expect, it } from 'vitest'
import { getPalletSpecForRetailer, getRetailerSpec } from './retailer-specs'
import { makeRetailer } from '../test/test-utils'

describe('retailer specs', () => {
  it('returns the Costco documented pallet spec', () => {
    expect(getRetailerSpec('costco')).toMatchObject({
      widthIn: 48,
      depthIn: 40,
      maxHeightIn: 58,
      maxLoadLb: 2500,
      noOverhang: true,
      primaryFaceIn: 48,
    })
  })

  it('infers specs from retailer names and keeps half pallets at 20 in depth', () => {
    const spec = getPalletSpecForRetailer(makeRetailer({ name: 'Costco Northeast' }), 'half')

    expect(spec).toMatchObject({
      id: 'half-48x20',
      depthIn: 20,
      retailerPreset: 'costco',
    })
  })
})
