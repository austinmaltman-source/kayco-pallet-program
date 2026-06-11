import { useEffect, useMemo } from 'react'
import { Plus, Undo2, Weight } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import { PalletDisplay } from '../PalletDisplay'
import { PalletNavigator } from './pallet-navigator'
import { useAppSettingsStore } from '../../stores/app-settings-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { resolvePlacementWeight } from '../../lib/dimensionEngine'
import { PALLET_WEIGHT_LIMIT } from '../../lib/constants'

export function ThreeDViewer() {
  const currentProject = useDisplayStore(s => s.currentProject)
  const selectedProductId = useDisplayStore(s => s.selectedProductId)
  const cameraPreset = useDisplayStore(s => s.cameraPreset)
  const selectProduct = useDisplayStore(s => s.selectProduct)
  const rotateProduct = useDisplayStore(s => s.rotateProduct)
  const removeProduct = useDisplayStore(s => s.removeProduct)
  const openPicker = useDisplayStore(s => s.openPicker)
  const carryPlacementId = useDisplayStore(s => s.carryPlacementId)
  const offPalletNotice = useDisplayStore(s => s.offPalletNotice)
  const clearOffPalletNotice = useDisplayStore(s => s.clearOffPalletNotice)
  const show3DHeader = useAppSettingsStore((s) => s.settings.show3DHeader)
  const displayEnvironment = useAppSettingsStore(
    (s) => s.settings.displayEnvironment
  )
  const allProducts = useCatalogStore((s) => s.products)
  const retailer = useRetailerStore((s) =>
    currentProject ? s.getRetailer(currentProject.retailerId) : undefined,
  )

  // Auto-dismiss the off-pallet return notice.
  useEffect(() => {
    if (!offPalletNotice) return
    const timer = setTimeout(clearOffPalletNotice, 4000)
    return () => clearTimeout(timer)
  }, [offPalletNotice, clearOffPalletNotice])

  // Advisory total weight (physics enforces fit, not truck limits).
  const totalWeight = useMemo(() => {
    if (!currentProject) return 0
    return currentProject.placements.reduce((sum, placement) => {
      const weight = resolvePlacementWeight(placement, allProducts)
      return sum + (Number.isFinite(weight) ? weight : 0)
    }, 0)
  }, [currentProject, allProducts])

  if (!currentProject) return null

  const overWeight = totalWeight > PALLET_WEIGHT_LIMIT

  return (
    <div className="w-full h-full relative">
      <PalletDisplay
        tierCount={currentProject.tierCount}
        palletType={currentProject.palletType}
        palletDimensions={retailer?.palletDimensions}
        maxDisplayHeight={retailer?.maxDisplayHeight}
        branding={currentProject.branding}
        placedProducts={currentProject.placements}
        selectedProductId={selectedProductId}
        onProductClick={(id) => selectProduct(id === selectedProductId ? null : id)}
        onRotateProduct={rotateProduct}
        onDeleteProduct={(id) => { removeProduct(id); selectProduct(null); }}
        cameraPreset={cameraPreset}
        lipColor={currentProject.lipColor}
        showHeader={show3DHeader}
        environment={displayEnvironment}
      />

      {/* Pallet Navigator — same widget as 2D, also controls camera in 3D */}
      <div className="absolute top-20 left-4 z-20">
        <PalletNavigator />
      </div>

      {/* Advisory weight chip */}
      <div className="absolute top-20 right-4 z-20">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-card backdrop-blur text-[11px] font-medium tabular-nums ${
            overWeight ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-white/95 text-[#555]'
          }`}
        >
          <Weight className="w-3.5 h-3.5" />
          {Math.round(totalWeight).toLocaleString()} lbs
          <span className={overWeight ? 'text-[#B91C1C]' : 'text-[#bbb]'}>
            / {PALLET_WEIGHT_LIMIT.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Off-pallet return notice */}
      {offPalletNotice && (
        <div className="absolute top-32 right-4 z-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#171717] text-white shadow-elevated text-[11px] font-medium">
            <Undo2 className="w-3.5 h-3.5" />
            {offPalletNotice.label} fell off the pallet and was returned to the catalog
          </div>
        </div>
      )}

      {/* Add product: spawns an item carried by the cursor */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {carryPlacementId && (
          <div className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-[11px] font-medium text-white">
            Click to place &middot; R rotates &middot; Esc cancels
          </div>
        )}
        {!carryPlacementId && selectedProductId && (
          <div className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-[11px] font-medium text-white">
            Arrows nudge &middot; D duplicates &middot; Del removes &middot; C resets camera
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
