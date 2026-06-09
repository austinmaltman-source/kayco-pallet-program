import React, { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { PlacedProduct, TierConfig, PalletType } from '../../types'
import { ItemBody } from './physics/ItemBody'
import { useCatalogStore } from '../../stores/catalog-store'

interface PlacedProductsProps {
  products: PlacedProduct[]
  tiers: TierConfig[]
  palletType?: PalletType
  palletDimensions?: { width: number; depth: number; height: number }
  selectedProductId?: string | null
  onProductClick?: (productId: string) => void
  onRotateProduct?: (productId: string) => void
  onDeleteProduct?: (productId: string) => void
}

export const PlacedProducts: React.FC<PlacedProductsProps> = ({
  products,
  selectedProductId,
  onProductClick,
  onRotateProduct,
  onDeleteProduct,
}) => {
  const catalogProducts = useCatalogStore((state) => state.products)

  // Preload all .glb models
  useEffect(() => {
    const productMap = new Map(
      catalogProducts.map((catalogProduct) => [catalogProduct.id, catalogProduct])
    )

    const modelUrls = products.flatMap((product) => {
      const urls: string[] = []
      if (product.modelUrl) {
        urls.push(product.modelUrl)
      }

      const unitModelUrl = product.caseConfig
        ? productMap.get(product.caseConfig.unitProductId)?.modelUrl
        : undefined

      if (unitModelUrl) {
        urls.push(unitModelUrl)
      }

      return urls
    })

    const uniqueUrls = [...new Set(modelUrls)]
    uniqueUrls.forEach((url) => useGLTF.preload(url))
  }, [catalogProducts, products])

  return (
    <group>
      {products.map((product) => {
        // Every placement carries a world transform (stamped by migration or
        // by physics settling); anything without one cannot be positioned.
        if (!product.position || !product.quaternion) return null

        return (
          <ItemBody
            key={product.id}
            placement={
              product as PlacedProduct & {
                position: [number, number, number]
                quaternion: [number, number, number, number]
              }
            }
            products={catalogProducts}
            isSelected={product.id === selectedProductId}
            onClick={() => onProductClick?.(product.id)}
            onRotate={() => onRotateProduct?.(product.id)}
            onDelete={() => onDeleteProduct?.(product.id)}
          />
        )
      })}
    </group>
  )
}
