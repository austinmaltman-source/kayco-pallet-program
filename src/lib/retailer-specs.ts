import type { PalletSpec, Retailer, RetailerPreset } from '../types'

const RETAILER_SPECS: Record<RetailerPreset, PalletSpec> = {
  costco: {
    id: 'gma-48x40',
    label: 'Costco 48 x 40',
    widthIn: 48,
    depthIn: 40,
    baseHeightIn: 6,
    maxLoadLb: 2500,
    maxHeightIn: 58,
    noOverhang: true,
    underhangMaxIn: 0,
    primaryFaceIn: 48,
    retailerPreset: 'costco',
  },
  sams: {
    id: 'gma-48x40',
    label: "Sam's Club 48 x 40",
    widthIn: 48,
    depthIn: 40,
    baseHeightIn: 6,
    maxLoadLb: 2100,
    maxHeightIn: 60,
    noOverhang: true,
    underhangMaxIn: 0,
    primaryFaceIn: 48,
    retailerPreset: 'sams',
  },
  walmart: {
    id: 'gma-48x40',
    label: 'Walmart 48 x 40',
    widthIn: 48,
    depthIn: 40,
    baseHeightIn: 6,
    maxLoadLb: 2100,
    maxHeightIn: 60,
    noOverhang: true,
    underhangMaxIn: 0,
    primaryFaceIn: 48,
    retailerPreset: 'walmart',
  },
  bjs: {
    id: 'gma-48x40',
    label: "BJ's 48 x 40",
    widthIn: 48,
    depthIn: 40,
    baseHeightIn: 6,
    maxLoadLb: 2500,
    maxHeightIn: 60,
    noOverhang: true,
    underhangMaxIn: 0,
    primaryFaceIn: 40,
    retailerPreset: 'bjs',
  },
}

export const PALLET_SPECS: PalletSpec[] = Object.values(RETAILER_SPECS)

export function getRetailerSpec(preset: RetailerPreset): PalletSpec {
  return { ...RETAILER_SPECS[preset] }
}

export function getDefaultPalletSpec(palletType: 'full' | 'half' = 'full'): PalletSpec {
  if (palletType === 'half') {
    return {
      id: 'half-48x20',
      label: 'Half pallet 48 x 20',
      widthIn: 48,
      depthIn: 20,
      baseHeightIn: 6,
      maxLoadLb: 1250,
      maxHeightIn: 60,
      noOverhang: true,
      underhangMaxIn: 0,
      primaryFaceIn: 48,
    }
  }

  return {
    id: 'gma-48x40',
    label: 'GMA 48 x 40',
    widthIn: 48,
    depthIn: 40,
    baseHeightIn: 6,
    maxLoadLb: 2500,
    maxHeightIn: 60,
    noOverhang: true,
    underhangMaxIn: 0,
    primaryFaceIn: 48,
  }
}

export function inferRetailerPreset(retailer: Pick<Retailer, 'name'>): RetailerPreset | null {
  const name = retailer.name.toLowerCase()
  if (name.includes('costco')) return 'costco'
  if (name.includes("sam's") || name.includes('sams') || name.includes('sam club')) return 'sams'
  if (name.includes('walmart') || name.includes('wal-mart')) return 'walmart'
  if (name.includes("bj's") || name.includes('bjs') || name.includes('bj wholesale')) return 'bjs'
  return null
}

export function getPalletSpecForRetailer(
  retailer: Pick<Retailer, 'name' | 'palletDimensions' | 'maxDisplayHeight'> | undefined,
  palletType: 'full' | 'half' = 'full',
): PalletSpec {
  if (!retailer) return getDefaultPalletSpec(palletType)

  const preset = inferRetailerPreset(retailer)
  if (preset) {
    const spec = getRetailerSpec(preset)
    if (palletType === 'half') {
      return { ...spec, id: 'half-48x20', label: `${spec.label} half`, depthIn: 20 }
    }
    return spec
  }

  const fallback = getDefaultPalletSpec(palletType)
  return {
    ...fallback,
    widthIn: retailer.palletDimensions.width,
    depthIn:
      palletType === 'half'
        ? retailer.palletDimensions.depth / 2
        : retailer.palletDimensions.depth,
    baseHeightIn: retailer.palletDimensions.height,
    maxHeightIn: retailer.maxDisplayHeight,
  }
}
