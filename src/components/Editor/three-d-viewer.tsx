import { useState } from 'react'
import { useDisplayStore } from '../../stores/display-store'
import { PalletDisplay } from '../PalletDisplay'
import { PalletNavigator } from './pallet-navigator'
import { AutoPackButton } from './auto-pack-button'
import { CompliancePanel } from './compliance-panel'
import { CaseTray } from './case-tray'
import { PackagePlus } from 'lucide-react'
import { useAppSettingsStore } from '../../stores/app-settings-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { useTierConfig } from '../../hooks/useTierConfig'
import { getEffectiveColSpan } from '../../lib/colSpanCalculator'
import { resolveProductDimensions } from '../../lib/dimensionEngine'
import {
  createDefaultWallConfigs,
  derivePlacementFromSlotId,
  getShelfPosition,
} from '../../lib/shelfCoordinates'
import { validatePlacement } from '../../lib/spatialValidator'
import { validateFreeformPlacement } from '../../lib/geometry/freeform-validator'
import { getEffectiveCaseDimensions } from '../../lib/geometry/orientation'
import type { PlacedProduct, Product } from '../../types'

interface DraggingCase {
  product: Product
  placementId?: string
  startClient?: { x: number; y: number }
  startPosition?: { x: number; y: number; z: number }
}

function overlapArea(
  a: { x: number; z: number; width: number; depth: number },
  b: { x: number; z: number; width: number; depth: number },
) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const depth = Math.max(0, Math.min(a.z + a.depth, b.z + b.depth) - Math.max(a.z, b.z))
  return width * depth
}

export function ThreeDViewer() {
  const [draggingCase, setDraggingCase] = useState<DraggingCase | null>(null)
  const currentProject = useDisplayStore(s => s.currentProject)
  const selectedProductId = useDisplayStore(s => s.selectedProductId)
  const ghostProduct = useDisplayStore(s => s.ghostProduct)
  const placementMode = useDisplayStore(s => s.placementMode)
  const pickerSelectedProduct = useDisplayStore(s => s.pickerSelectedProduct)
  const cameraPreset = useDisplayStore(s => s.cameraPreset)
  const selectProduct = useDisplayStore(s => s.selectProduct)
  const selectSlot = useDisplayStore(s => s.selectSlot)
  const setGhostProduct = useDisplayStore(s => s.setGhostProduct)
  const setPickerProduct = useDisplayStore(s => s.setPickerProduct)
  const placeProduct = useDisplayStore(s => s.placeProduct)
  const placeProductFreeform = useDisplayStore(s => s.placeProductFreeform)
  const movePlacement = useDisplayStore(s => s.movePlacement)
  const openPicker = useDisplayStore(s => s.openPicker)
  const rotateProduct = useDisplayStore(s => s.rotateProduct)
  const removeProduct = useDisplayStore(s => s.removeProduct)
  const show3DSlotGrid = useAppSettingsStore((s) => s.settings.show3DSlotGrid)
  const show3DHeader = useAppSettingsStore((s) => s.settings.show3DHeader)
  const editorGridColumns = useAppSettingsStore((s) => s.settings.editorGridColumns)
  const displayEnvironment = useAppSettingsStore(
    (s) => s.settings.displayEnvironment
  )
  const allProducts = useCatalogStore((s) => s.products)
  const retailer = useRetailerStore((s) =>
    currentProject ? s.getRetailer(currentProject.retailerId) : undefined,
  )

  const tiers = useTierConfig(
    currentProject?.tierCount ?? 4,
    retailer?.maxDisplayHeight ?? 60,
    currentProject?.palletType ?? 'full',
  )

  if (!currentProject) return null

  const activePalletDimensions = currentProject.palletSpec
    ? {
        width: currentProject.palletSpec.widthIn,
        depth: currentProject.palletSpec.depthIn,
        height: currentProject.palletSpec.baseHeightIn,
      }
    : retailer?.palletDimensions ?? { width: 48, depth: 40, height: 6 }
  const activePalletConfig = {
    base: activePalletDimensions,
    maxWeight: currentProject.palletSpec?.maxLoadLb ?? 2500,
  }
  const draggedCaseProduct = draggingCase
    ? {
        productId: draggingCase.product.id,
        placementId: draggingCase.placementId,
        startClient: draggingCase.startClient,
        startPosition: draggingCase.startPosition,
        ...getEffectiveCaseDimensions(draggingCase.product),
        color: draggingCase.product.brandColor,
        label: draggingCase.product.name,
      }
    : null

  const validateDraggedCase = (position: { x: number; y: number; z: number }) => {
    if (!draggingCase || !currentProject.palletSpec) return undefined
    const dimensions = getEffectiveCaseDimensions(draggingCase.product)
    const placement: PlacedProduct = {
      id: draggingCase.placementId ?? 'draft-drag-placement',
      sourceProductId: draggingCase.product.id,
      slotId: 'draft-drag-placement',
      width: dimensions.width,
      height: dimensions.height,
      depth: dimensions.depth,
      color: draggingCase.product.brandColor,
      label: draggingCase.product.name,
      sku: draggingCase.product.sku,
      category: draggingCase.product.category,
      imageUrl: draggingCase.product.imageUrl,
      modelUrl: draggingCase.product.modelUrl,
      packaging: draggingCase.product.packaging,
      caseConfig: draggingCase.product.caseConfig,
      position,
      rotationDeg: 0,
      orientation3D: 'upright',
      quantity: 1,
      displayMode: 'face-out',
      renderStyle: 'case',
      facings: 1,
      rows: 1,
      layers: 1,
    }

    return validateFreeformPlacement(
      placement,
      currentProject.placements,
      allProducts,
      currentProject.palletSpec,
    )
  }

  const dropDraggedCase = (position: { x: number; y: number; z: number }) => {
    if (!draggingCase) return
    const result = draggingCase.placementId
      ? movePlacement(draggingCase.placementId, position, 0)
      : placeProductFreeform(draggingCase.product, position, 0, 'upright')
    if (result?.valid) {
      setDraggingCase(null)
    }
  }

  const settleDraggedCase = (position: { x: number; y: number; z: number }) => {
    if (!draggingCase) return position
    const dimensions = getEffectiveCaseDimensions(draggingCase.product)
    const footprint = {
      x: position.x,
      z: position.z,
      width: dimensions.width,
      depth: dimensions.depth,
    }
    const minSupportArea = dimensions.width * dimensions.depth * 0.35
    const settledY = currentProject.placements.reduce(
      (highest, placement) => {
        if (placement.id === draggingCase.placementId || !placement.position) return highest
        const candidateArea = overlapArea(footprint, {
          x: placement.position.x,
          z: placement.position.z,
          width: placement.width,
          depth: placement.depth,
        })
        if (candidateArea < minSupportArea) return highest
        return Math.max(highest, placement.position.y + placement.height)
      },
      activePalletDimensions.height,
    )

    return {
      ...position,
      y: settledY,
    }
  }

  const startPlacedCaseDrag = (
    placementId: string,
    pointer: { clientX: number; clientY: number },
  ) => {
    const placement = currentProject.placements.find((entry) => entry.id === placementId)
    const product = placement?.sourceProductId
      ? allProducts.find((entry) => entry.id === placement.sourceProductId)
      : undefined
    if (!placement || !product) return
    setDraggingCase({
      product,
      placementId,
      startClient: { x: pointer.clientX, y: pointer.clientY },
      startPosition: placement.position ?? {
        x: 0,
        y: activePalletDimensions.height,
        z: 0,
      },
    })
    selectProduct(placementId)
  }

  return (
    <div className="w-full h-full relative">
      <PalletDisplay
        tierCount={currentProject.tierCount}
        palletType={currentProject.palletType}
        palletDimensions={activePalletDimensions}
        branding={currentProject.branding}
        placedProducts={currentProject.placements}
        ghostProduct={ghostProduct}
        draggedCaseProduct={draggedCaseProduct}
        hiddenProductId={draggingCase?.placementId ?? null}
        selectedProductId={selectedProductId}
        onProductClick={(id) => selectProduct(id === selectedProductId ? null : id)}
        onRotateProduct={rotateProduct}
        onDeleteProduct={(id) => { removeProduct(id); selectProduct(null); }}
        onProductDragStart={startPlacedCaseDrag}
        onFreeformDrop={dropDraggedCase}
        onFreeformDragCancel={() => setDraggingCase(null)}
        settleFreeformDrop={settleDraggedCase}
        validateFreeformDrop={validateDraggedCase}
        onSlotClick={(tierId, slotIndex) => {
          const slotId = `${tierId}-${slotIndex}`
          if (pickerSelectedProduct) {
            if (placementMode === 'freeform' && retailer) {
              const wallConfigs = createDefaultWallConfigs(
                currentProject.palletType,
                editorGridColumns,
              )
              const derivedPlacement = derivePlacementFromSlotId(
                slotId,
                tiers,
                currentProject.palletType,
              )
              if (!derivedPlacement) return

              const dimensions = resolveProductDimensions(
                pickerSelectedProduct,
                allProducts,
              )
              const shelfPosition = getShelfPosition(
                {
                  wall: derivedPlacement.wall,
                  tier: derivedPlacement.tier,
                  gridCol: derivedPlacement.gridCol,
                  colSpan: 1,
                  displayMode: 'face-out',
                },
                dimensions,
                {
                  ...activePalletConfig,
                },
                tiers,
                wallConfigs[derivedPlacement.wall],
              )
              const result = placeProductFreeform(
                pickerSelectedProduct,
                {
                  x:
                    shelfPosition.position[0] +
                    activePalletDimensions.width / 2 -
                    dimensions.width / 2,
                  y: shelfPosition.position[1],
                  z:
                    activePalletDimensions.depth / 2 -
                    shelfPosition.position[2] -
                    dimensions.depth / 2,
                },
                0,
                'upright',
              )
              if (result?.valid) {
                setPickerProduct(null)
                setGhostProduct(null)
                selectSlot(null)
              }
              return
            }

            const result = placeProduct(pickerSelectedProduct, slotId)
            if (result?.valid) {
              setPickerProduct(null)
              setGhostProduct(null)
              selectSlot(null)
            }
            return
          }

          selectSlot(slotId)
        }}
        onSlotHover={(tierId, slotIndex) => {
          if (!pickerSelectedProduct || !retailer) return

          const slotId = `${tierId}-${slotIndex}`
          const wallConfigs = createDefaultWallConfigs(
            currentProject.palletType,
            editorGridColumns,
          )
          const derivedPlacement = derivePlacementFromSlotId(
            slotId,
            tiers,
            currentProject.palletType,
          )

          if (!derivedPlacement) return

          const displayMode = 'face-out' as const
          const colSpan = getEffectiveColSpan(
            pickerSelectedProduct,
            displayMode,
            wallConfigs[derivedPlacement.wall],
            derivedPlacement.wall,
            activePalletConfig,
            allProducts,
          )
          const validation = validatePlacement(
            pickerSelectedProduct,
            {
              wall: derivedPlacement.wall,
              tier: derivedPlacement.tier,
              gridCol: derivedPlacement.gridCol,
              colSpan,
              quantity: 1,
              displayMode,
            },
            {
              palletConfig: activePalletConfig,
              palletType: currentProject.palletType,
              tierConfigs: tiers,
              wallConfigs,
              existingPlacements: currentProject.placements,
              allProducts,
            },
          )
          const dimensions = resolveProductDimensions(
            pickerSelectedProduct,
            allProducts,
          )
          const shelfPosition = getShelfPosition(
            {
              wall: derivedPlacement.wall,
              tier: derivedPlacement.tier,
              gridCol: derivedPlacement.gridCol,
              colSpan,
              displayMode,
            },
            dimensions,
            activePalletConfig,
            tiers,
            wallConfigs[derivedPlacement.wall],
          )
          const suggestionMarkers = validation.suggestions
            .filter(
              (suggestion) =>
                suggestion.wall &&
                suggestion.tier &&
                suggestion.gridCol !== undefined,
            )
            .map((suggestion) => {
              const suggestionColSpan =
                suggestion.displayMode === 'spine-out'
                  ? getEffectiveColSpan(
                      pickerSelectedProduct,
                      suggestion.displayMode,
                      wallConfigs[suggestion.wall!],
                      suggestion.wall!,
                      activePalletConfig,
                      allProducts,
                    )
                  : getEffectiveColSpan(
                      pickerSelectedProduct,
                      displayMode,
                      wallConfigs[suggestion.wall!],
                      suggestion.wall!,
                      activePalletConfig,
                      allProducts,
                    )

              const suggestionPosition = getShelfPosition(
                {
                  wall: suggestion.wall!,
                  tier: suggestion.tier!,
                  gridCol: suggestion.gridCol!,
                  colSpan: suggestionColSpan,
                  displayMode: suggestion.displayMode ?? displayMode,
                },
                dimensions,
                activePalletConfig,
                tiers,
                wallConfigs[suggestion.wall!],
              )

              return {
                position: suggestionPosition.position,
                message: suggestion.message,
              }
            })

          setGhostProduct({
            slotId,
            width: dimensions.width,
            height: dimensions.height,
            depth: dimensions.depth,
            color: pickerSelectedProduct.brandColor,
            label: pickerSelectedProduct.name,
            isValid: validation.valid,
            worldPosition: shelfPosition.position,
            rotation: shelfPosition.rotation,
            errorReason: validation.errors[0]?.reason,
            suggestions: validation.suggestions,
            suggestionMarkers,
          })
        }}
        onSlotHoverEnd={() => setGhostProduct(null)}
        cameraPreset={cameraPreset}
        lipColor={currentProject.lipColor}
        showSlotGrid={show3DSlotGrid}
        showHeader={show3DHeader}
        environment={displayEnvironment}
      />

      {/* Pallet Navigator — same widget as 2D, also controls camera in 3D */}
      <div className="absolute top-20 left-4 z-20">
        <PalletNavigator />
      </div>
      <div className="absolute top-20 left-[168px] z-20">
        <button
          onClick={openPicker}
          className="h-9 px-3 rounded-md bg-white text-[#171717] text-[12px] font-medium inline-flex items-center gap-2 shadow-card hover:bg-[#fafafa] transition-colors"
        >
          <PackagePlus size={15} />
          Add product
        </button>
      </div>
      <CaseTray
        draggingProductId={draggingCase?.product.id ?? null}
        onDragStart={(product) => setDraggingCase({ product })}
        onDragEnd={() => setDraggingCase(null)}
      />
      <AutoPackButton />
      <CompliancePanel />
    </div>
  )
}
