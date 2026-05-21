import React, { useMemo, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { PlacedProduct, TierConfig, PalletType } from '../../types'
import { ProductRenderer } from './products/ProductRenderer'
import { useCatalogStore } from '../../stores/catalog-store'
import { useAppSettingsStore } from '../../stores/app-settings-store'
import {
  createDefaultWallConfigs,
  derivePlacementFromSlotId,
  getShelfPosition,
} from '../../lib/shelfCoordinates'
import { getEffectiveCaseDimensions } from '../../lib/geometry/orientation'

interface PlacedProductsProps {
  products: PlacedProduct[]
  tiers: TierConfig[]
  palletType?: PalletType
  palletDimensions?: { width: number; depth: number; height: number }
  palletBaseHeight?: number
  selectedProductId?: string | null
  onProductClick?: (productId: string) => void
  onRotateProduct?: (productId: string) => void
  onDeleteProduct?: (productId: string) => void
}

export const PlacedProducts: React.FC<PlacedProductsProps> = ({
  products,
  tiers,
  palletType = 'full',
  palletDimensions = { width: 48, depth: 40, height: 6 },
  palletBaseHeight = 6,
  selectedProductId,
  onProductClick,
  onRotateProduct,
  onDeleteProduct,
}) => {
  const catalogProducts = useCatalogStore((state) => state.products)
  const editorGridColumns = useAppSettingsStore((state) => state.settings.editorGridColumns)

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

  const wallConfigs = useMemo(
    () => createDefaultWallConfigs(palletType, editorGridColumns),
    [editorGridColumns, palletType],
  )

  return (
    <group>
      {products.map((product) => {
        const catalogProduct = product.sourceProductId
          ? catalogProducts.find((entry) => entry.id === product.sourceProductId)
          : undefined

        if (product.position) {
          const dimensions = catalogProduct
            ? getEffectiveCaseDimensions(
                catalogProduct,
                product.orientation3D ?? 'upright',
                product.rotationDeg ?? 0,
              )
            : {
                width: product.width,
                depth: product.depth,
                height: product.height,
              }
          const freeformPosition: [number, number, number] = [
            product.position.x - palletDimensions.width / 2 + dimensions.width / 2,
            product.position.y,
            palletDimensions.depth / 2 - product.position.z - dimensions.depth / 2,
          ]
          const freeformProduct = {
            ...product,
            width: dimensions.width,
            depth: dimensions.depth,
            height: dimensions.height * (product.caseStackHeight ?? 1),
            orientation: 0,
          }

          return (
            <ProductRenderer
              key={product.id}
              product={freeformProduct}
              products={catalogProducts}
              position={freeformPosition}
              rotation={[0, 0, 0]}
              availableSpace={dimensions}
              isSelected={product.id === selectedProductId}
              onClick={() => onProductClick?.(product.id)}
              onRotate={() => onRotateProduct?.(product.id)}
              onDelete={() => onDeleteProduct?.(product.id)}
            />
          )
        }

        const placement =
          product.wall && product.tier && product.gridCol !== undefined
            ? {
                wall: product.wall,
                tier: product.tier,
                gridCol: product.gridCol,
                colSpan: product.colSpan ?? 1,
                displayMode: product.displayMode ?? 'face-out',
              }
            : (() => {
                const derived = derivePlacementFromSlotId(
                  product.slotId,
                  tiers,
                  palletType,
                )
                if (!derived) return null
                return {
                  wall: derived.wall,
                  tier: derived.tier,
                  gridCol: derived.gridCol,
                  colSpan: product.colSpan ?? 1,
                  displayMode: product.displayMode ?? 'face-out',
                }
              })()

        if (!placement) return null

        const shelfPosition = getShelfPosition(
          placement,
          {
            width: product.width,
            height: product.height,
            depth: product.depth,
            source: 'manual',
          },
          {
            base: palletDimensions,
            maxWeight: 2500,
          },
          tiers,
          wallConfigs[placement.wall],
        )
        const position: [number, number, number] = [
          shelfPosition.position[0],
          shelfPosition.position[1],
          shelfPosition.position[2],
        ]

        return (
          <ProductRenderer
            key={product.id}
            product={product}
            products={catalogProducts}
            position={position}
            rotation={shelfPosition.rotation}
            availableSpace={shelfPosition.availableSpace}
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
