import type { Product, ProductDimensions } from '../types'
import {
  DEFAULT_PADDING,
  DIVIDER_THICKNESS,
  WALL_THICKNESS,
} from './constants'

function toManualDimensions(product: Pick<Product, 'width' | 'height' | 'depth'>): ProductDimensions {
  return {
    width: product.width,
    height: product.height,
    depth: product.depth,
    source: 'manual',
  }
}

export function calculateCaseDimensions(
  unitDimensions: ProductDimensions,
  layout: { cols: number; rows: number; layers: number },
  padding: number = DEFAULT_PADDING,
  hasDividers: boolean = false,
): ProductDimensions {
  const dividerSpace = hasDividers ? DIVIDER_THICKNESS : 0

  const innerWidth =
    unitDimensions.width * layout.cols +
    padding * Math.max(0, layout.cols - 1) +
    dividerSpace * Math.max(0, layout.cols - 1)

  const innerDepth =
    unitDimensions.depth * layout.rows +
    padding * Math.max(0, layout.rows - 1) +
    dividerSpace * Math.max(0, layout.rows - 1)

  const innerHeight =
    unitDimensions.height * layout.layers +
    padding * Math.max(0, layout.layers - 1)

  return {
    width: innerWidth + WALL_THICKNESS * 2 + padding * 2,
    depth: innerDepth + WALL_THICKNESS * 2 + padding * 2,
    height: innerHeight + WALL_THICKNESS + padding,
    source: 'calculated',
  }
}

export function resolveProductDimensions(
  product: Product,
  allProducts: Product[],
): ProductDimensions {
  if (!product.caseConfig) {
    return toManualDimensions(product)
  }

  const unitProduct = allProducts.find(
    (candidate) => candidate.id === product.caseConfig?.unitProductId,
  )

  if (!unitProduct) {
    return toManualDimensions(product)
  }

  const calculated = calculateCaseDimensions(
    toManualDimensions(unitProduct),
    product.caseConfig.layout,
    product.caseConfig.innerPadding,
    product.caseConfig.dividers,
  )

  const override = product.caseConfig.dimensionOverride
  if (!override) {
    return calculated
  }

  return {
    width: override.width ?? calculated.width,
    height: override.height ?? calculated.height,
    depth: override.depth ?? calculated.depth,
    source: 'manual',
  }
}

export function calculateCaseWeight(
  unitWeight: number,
  layout: { cols: number; rows: number; layers: number },
  caseDimensions: ProductDimensions,
): number {
  const itemCount = layout.cols * layout.rows * layout.layers
  const surfaceArea =
    2 *
    (caseDimensions.width * caseDimensions.height +
      caseDimensions.width * caseDimensions.depth +
      caseDimensions.height * caseDimensions.depth)
  const cardboardWeight = surfaceArea * 0.015
  return unitWeight * itemCount + cardboardWeight
}

// Weight of a placed item. Unlike resolveProductWeight this works off the
// placement's own caseConfig (which may be synthesized from unitsPerCase at
// spawn time, so the source catalog product does not carry it).
export function resolvePlacementWeight(
  placement: {
    sourceProductId?: string
    caseConfig?: Product['caseConfig']
    width: number
    height: number
    depth: number
  },
  allProducts: Product[],
): number {
  if (placement.caseConfig) {
    const unitProduct = allProducts.find(
      (candidate) => candidate.id === placement.caseConfig?.unitProductId,
    )
    if (unitProduct && unitProduct.weight > 0) {
      return calculateCaseWeight(unitProduct.weight, placement.caseConfig.layout, {
        width: placement.width,
        height: placement.height,
        depth: placement.depth,
        source: 'manual',
      })
    }
  }

  const source = placement.sourceProductId
    ? allProducts.find((candidate) => candidate.id === placement.sourceProductId)
    : undefined
  return source ? resolveProductWeight(source, allProducts) : 0
}

export function resolveProductWeight(product: Product, allProducts: Product[]): number {
  if (!product.caseConfig) {
    return product.weight
  }

  const unitProduct = allProducts.find(
    (candidate) => candidate.id === product.caseConfig?.unitProductId,
  )

  if (!unitProduct) {
    return product.weight
  }

  return calculateCaseWeight(
    unitProduct.weight,
    product.caseConfig.layout,
    resolveProductDimensions(product, allProducts),
  )
}
