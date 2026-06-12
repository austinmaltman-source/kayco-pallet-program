import React, { useState } from 'react'
import { PlacedProduct, Product } from '../../../types'
import { getOrientationRotation } from '../../../lib/orientation-presets'
import { ProductHoverEffect } from './ProductHoverEffect'
import { ProductCase } from './ProductCase'
import { MerchBlockRenderer } from './MerchBlockRenderer'
import { deriveMerchBlockLayout } from './merchUtils'

interface ProductRendererProps {
  product: PlacedProduct
  products: Product[]
  position: [number, number, number]
  rotation?: [number, number, number]
  availableSpace?: { width: number; height: number; depth: number }
  isSelected?: boolean
  isPrimary?: boolean
  onClick?: () => void
  onRotate?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

export const ProductRenderer: React.FC<ProductRendererProps> = ({
  product,
  products,
  position,
  rotation: baseRotation = [0, 0, 0],
  availableSpace = { width: product.width, height: product.height, depth: product.depth },
  isSelected = false,
  isPrimary = true,
  onClick,
  onRotate,
  onDuplicate,
  onDelete,
}) => {
  const [hovered, setHovered] = useState(false)
  const orientationRotation = getOrientationRotation(product.orientation)
  const rotation: [number, number, number] = [
    baseRotation[0] + orientationRotation[0],
    baseRotation[1] + orientationRotation[1],
    baseRotation[2] + orientationRotation[2],
  ]
  const merchLayout = deriveMerchBlockLayout(product, availableSpace)
  const hoverWidth = product.caseConfig ? product.width : Math.max(product.width, merchLayout.blockWidth)
  const hoverDepth = product.caseConfig ? product.depth : Math.max(product.depth, merchLayout.blockDepth)
  const hoverHeight = product.caseConfig ? product.height : Math.max(product.height, merchLayout.blockHeight)

  const sharedProps = {
    product,
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    onClick,
    onPointerOver: () => setHovered(true),
    onPointerOut: () => setHovered(false),
  }

  const renderProduct = () => {
    if (product.caseConfig) {
      const unitProduct = products.find(
        (catalogProduct) => catalogProduct.id === product.caseConfig?.unitProductId
      )
      if (unitProduct) {
        return (
          <ProductCase
            {...sharedProps}
            unitProduct={unitProduct}
          />
        )
      }
    }
    if (product.modelUrl) {
      return (
        <MerchBlockRenderer
          product={product}
          layout={merchLayout}
          onClick={onClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        />
      )
    }
    if (product.imageUrl) {
      return (
        <MerchBlockRenderer
          product={product}
          layout={merchLayout}
          onClick={onClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        />
      )
    }
    return (
      <MerchBlockRenderer
        product={product}
        layout={merchLayout}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />
    )
  }

  return (
    <ProductHoverEffect
      isSelected={isSelected}
      showActions={isSelected && isPrimary}
      isHovered={hovered}
      productWidth={hoverWidth}
      productHeight={hoverHeight}
      productDepth={hoverDepth}
      position={position}
      rotation={rotation}
      onRotate={onRotate}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    >
      {renderProduct()}
    </ProductHoverEffect>
  )
}
