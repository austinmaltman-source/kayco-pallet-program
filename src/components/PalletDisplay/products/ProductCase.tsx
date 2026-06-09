import React, { Suspense } from 'react'
import type { PlacedProduct, Product } from '../../../types'
import { BasicBoxProduct } from './BasicBoxProduct'
import { CaseDividers } from './CaseDividers'
import { CaseItemGrid } from './CaseItemGrid'
import { PrimitiveCaseItemGrid } from './PrimitiveCaseItemGrid'
import { CaseShell } from './CaseShell'

interface ProductCaseProps {
  product: PlacedProduct
  unitProduct: Product
  position: [number, number, number]
  rotation?: [number, number, number]
  isSelected?: boolean
  isHovered?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}

function ProductCaseInner({
  product,
  unitProduct,
  position,
  rotation = [0, 0, 0],
  onClick,
  onPointerOver,
  onPointerOut,
}: ProductCaseProps) {
  if (!product.caseConfig) {
    return (
      <BasicBoxProduct
        product={product}
        position={position}
        rotation={rotation}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
    )
  }

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        onPointerOver?.()
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        onPointerOut?.()
      }}
    >
      <CaseShell
        dimensions={{
          width: product.width,
          height: product.height,
          depth: product.depth,
        }}
        style={product.caseConfig.caseStyle}
        color={product.color}
      />

      {product.caseConfig.caseStyle !== 'closed' &&
        (unitProduct.modelUrl ? (
          <CaseItemGrid
            unitModelUrl={unitProduct.modelUrl}
            packaging={unitProduct.packaging}
            unitDimensions={{
              width: unitProduct.width,
              height: unitProduct.height,
              depth: unitProduct.depth,
            }}
            caseDimensions={{
              width: product.width,
              height: product.height,
              depth: product.depth,
            }}
            layout={product.caseConfig.layout}
            padding={product.caseConfig.innerPadding}
          />
        ) : (
          // No GLB for the unit: render each unit as a primitive sized from
          // its real dimensions, so a case of 12 still shows 12 items.
          <PrimitiveCaseItemGrid
            color={unitProduct.brandColor || product.color}
            packaging={unitProduct.packaging}
            unitDimensions={{
              width: unitProduct.width,
              height: unitProduct.height,
              depth: unitProduct.depth,
            }}
            caseDimensions={{
              width: product.width,
              height: product.height,
              depth: product.depth,
            }}
            layout={product.caseConfig.layout}
            padding={product.caseConfig.innerPadding}
          />
        ))}

      {product.caseConfig.dividers && (
        <CaseDividers
          caseDimensions={{
            width: product.width,
            height: product.height,
            depth: product.depth,
          }}
          layout={product.caseConfig.layout}
          padding={product.caseConfig.innerPadding}
        />
      )}
    </group>
  )
}

class ProductCaseErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export function ProductCase(props: ProductCaseProps) {
  const fallback = (
    <BasicBoxProduct
      product={props.product}
      position={props.position}
      rotation={props.rotation}
      onClick={props.onClick}
      onPointerOver={props.onPointerOver}
      onPointerOut={props.onPointerOut}
    />
  )

  return (
    <ProductCaseErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <ProductCaseInner {...props} />
      </Suspense>
    </ProductCaseErrorBoundary>
  )
}
