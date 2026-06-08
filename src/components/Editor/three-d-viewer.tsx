import { useDisplayStore } from '../../stores/display-store'
import { PalletDisplay } from '../PalletDisplay'
import { PalletNavigator } from './pallet-navigator'
import { AutoPackButton } from './auto-pack-button'
import { CompliancePanel } from './compliance-panel'
import { RulesEditor } from './rules-editor'
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

export function ThreeDViewer() {
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

  return (
    <div className="w-full h-full relative">
      <PalletDisplay
        tierCount={currentProject.tierCount}
        palletType={currentProject.palletType}
        palletDimensions={activePalletDimensions}
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
      <AutoPackButton />
      <CompliancePanel />
      <RulesEditor />
    </div>
  )
}
