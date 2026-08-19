import { useEffect, useMemo } from 'react'
import { ArrowUpDown, Plus, RotateCw, Sparkles, Undo2, Weight } from 'lucide-react'
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
  const selectedProductIds = useDisplayStore(s => s.selectedProductIds)
  const cameraPreset = useDisplayStore(s => s.cameraPreset)
  const selectProduct = useDisplayStore(s => s.selectProduct)
  const rotateProduct = useDisplayStore(s => s.rotateProduct)
  const removeProduct = useDisplayStore(s => s.removeProduct)
  const openPicker = useDisplayStore(s => s.openPicker)
  const carryPlacementId = useDisplayStore(s => s.carryPlacementId)
  const heldPlacementId = useDisplayStore(s => s.heldPlacementId)
  const verticalDragMode = useDisplayStore(s => s.verticalDragMode)
  const requestHeldRotate = useDisplayStore(s => s.requestHeldRotate)
  const toggleVerticalDragMode = useDisplayStore(s => s.toggleVerticalDragMode)
  const offPalletNotice = useDisplayStore(s => s.offPalletNotice)
  const clearOffPalletNotice = useDisplayStore(s => s.clearOffPalletNotice)
  const show3DHeader = useAppSettingsStore((s) => s.settings.show3DHeader)
  const autoFillOnOpen = useAppSettingsStore((s) => s.settings.autoFill3DOnOpen)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const populateFromAssortment = useDisplayStore((s) => s.populateFromAssortment)
  const displayEnvironment = useAppSettingsStore(
    (s) => s.settings.displayEnvironment
  )
  const allProducts = useCatalogStore((s) => s.products)
  const retailer = useRetailerStore((s) =>
    currentProject ? s.getRetailer(currentProject.retailerId) : undefined,
  )

  // Auto-fill an empty pallet from the program assortment when enabled.
  const projectId = currentProject?.id
  const hasPlacements = (currentProject?.placements.length ?? 0) > 0
  const hasAssortment = (currentProject?.assortment ?? []).some((e) => e.cases > 0)
  useEffect(() => {
    if (!projectId || !autoFillOnOpen || hasPlacements || !hasAssortment) return
    populateFromAssortment()
    // Only on entering a pallet (or turning the setting on) - not on every
    // placement change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, autoFillOnOpen])

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
        selectedProductIds={selectedProductIds}
        onProductClick={(id, additive) => selectProduct(id, additive)}
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

      {/* Auto-fill controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 mt-16">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 backdrop-blur shadow-card text-[11px] font-medium text-[#555] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoFillOnOpen}
            onChange={(e) => updateSettings({ autoFill3DOnOpen: e.target.checked })}
            className="accent-[#171717]"
          />
          Auto-fill on open
        </label>
        {hasAssortment && (
          <button
            onClick={() => {
              if (
                hasPlacements &&
                !window.confirm(
                  'Auto-fill replaces the current layout with a fresh arrangement from the program items. Continue?',
                )
              )
                return
              populateFromAssortment()
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 backdrop-blur shadow-card text-[11px] font-medium text-[#171717] hover:bg-white transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-fill now
          </button>
        )}
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

      {/* Held-item touch controls: on-screen equivalents of R (rotate) and
          Shift-drag (vertical move), which have no touch gesture. */}
      {(carryPlacementId || heldPlacementId) && (
        <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={requestHeldRotate}
            aria-label="Rotate held item"
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-md bg-white/95 backdrop-blur shadow-elevated text-[12px] font-medium text-[#171717] hover:bg-white transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            Rotate
          </button>
          <button
            onClick={toggleVerticalDragMode}
            aria-pressed={verticalDragMode}
            aria-label="Toggle vertical move"
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-md backdrop-blur shadow-elevated text-[12px] font-medium transition-colors ${
              verticalDragMode
                ? 'bg-[#171717] text-white hover:bg-[#333]'
                : 'bg-white/95 text-[#171717] hover:bg-white'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Vertical
          </button>
        </div>
      )}

      {/* Add product: spawns an item carried by the cursor */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {carryPlacementId && (
          <div className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-[11px] font-medium text-white">
            Click to place &middot; R or Rotate &middot; Esc cancels
          </div>
        )}
        {!carryPlacementId && selectedProductId && (
          <div className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-[11px] font-medium text-white">
            {selectedProductIds.length > 1
              ? `${selectedProductIds.length} selected · Arrows nudge · D duplicates · Del removes`
              : 'Shift-click to multi-select · Arrows nudge · D duplicates · Del removes · C resets camera'}
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
