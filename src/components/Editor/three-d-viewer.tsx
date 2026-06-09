import { Plus } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import { PalletDisplay } from '../PalletDisplay'
import { PalletNavigator } from './pallet-navigator'
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

export function ThreeDViewer() {
  const currentProject = useDisplayStore(s => s.currentProject)
  const selectedProductId = useDisplayStore(s => s.selectedProductId)
  const ghostProduct = useDisplayStore(s => s.ghostProduct)
  const pickerSelectedProduct = useDisplayStore(s => s.pickerSelectedProduct)
  const cameraPreset = useDisplayStore(s => s.cameraPreset)
  const selectProduct = useDisplayStore(s => s.selectProduct)
  const selectSlot = useDisplayStore(s => s.selectSlot)
  const setGhostProduct = useDisplayStore(s => s.setGhostProduct)
  const setPickerProduct = useDisplayStore(s => s.setPickerProduct)
  const placeProduct = useDisplayStore(s => s.placeProduct)
  const rotateProduct = useDisplayStore(s => s.rotateProduct)
  const removeProduct = useDisplayStore(s => s.removeProduct)
  const openPicker = useDisplayStore(s => s.openPicker)
  const carryPlacementId = useDisplayStore(s => s.carryPlacementId)
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

  return (
    <div className="w-full h-full relative">
      <PalletDisplay
        tierCount={currentProject.tierCount}
        palletType={currentProject.palletType}
        branding={currentProject.branding}
        placedProducts={currentProject.placements}
        ghostProduct={ghostProduct}
        selectedProductId={selectedProductId}
        onProductClick={(id) => selectProduct(id === selectedProductId ? null : id)}
        onRotateProduct={rotateProduct}
        onDeleteProduct={(id) => { removeProduct(id); selectProduct(null); }}
        onSlotClick={(tierId, slotIndex) => {
          const slotId = `${tierId}-${slotIndex}`
          if (pickerSelectedProduct) {
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
            {
              base: retailer.palletDimensions,
              maxWeight: 2500,
            },
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
              palletConfig: {
                base: retailer.palletDimensions,
                maxWeight: 2500,
              },
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
            {
              base: retailer.palletDimensions,
              maxWeight: 2500,
            },
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
                      {
                        base: retailer.palletDimensions,
                        maxWeight: 2500,
                      },
                      allProducts,
                    )
                  : getEffectiveColSpan(
                      pickerSelectedProduct,
                      displayMode,
                      wallConfigs[suggestion.wall!],
                      suggestion.wall!,
                      {
                        base: retailer.palletDimensions,
                        maxWeight: 2500,
                      },
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
                {
                  base: retailer.palletDimensions,
                  maxWeight: 2500,
                },
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

      {/* Add product: spawns an item carried by the cursor */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {carryPlacementId && (
          <div className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-[11px] font-medium text-white">
            Click to place &middot; R rotates &middot; Esc cancels
          </div>
        )}
        <button
          onClick={openPicker}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#171717] text-white text-[12px] font-medium hover:bg-[#333] shadow-elevated transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add product
        </button>
      </div>
    </div>
  )
}
