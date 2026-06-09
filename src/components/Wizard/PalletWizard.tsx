import { useReducer, useCallback, useState, Suspense } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Canvas } from '@react-three/fiber'
import { X, Sparkles } from 'lucide-react'
import {
  WizardState,
  WizardPalletConfig,
  getInitialWizardState,
  wizardReducer,
} from './wizardTypes'
import { PalletTypeStep } from './steps/PalletTypeStep'
import { PalletDisplayScene } from '../PalletDisplay/PalletDisplayScene'

interface PalletWizardProps {
  open: boolean
  onClose: () => void
  onComplete: (config: WizardPalletConfig) => void
  initialState?: Partial<WizardState>
  editMode?: boolean
}

export function PalletWizard({
  open,
  onClose,
  onComplete,
  initialState,
  editMode = false,
}: PalletWizardProps) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    { ...getInitialWizardState(), ...initialState },
  )
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const handleClose = useCallback(() => {
    setShowConfirmClose(true)
  }, [])

  const confirmClose = useCallback(() => {
    setShowConfirmClose(false)
    onClose()
  }, [onClose])

  const handleCreate = useCallback(() => {
    const isCustom =
      state.palletType === 'full' &&
      Object.values(state.walls).every((w) => w.type === 'shelves')
        ? state.palletType
        : state.palletType === 'half' &&
            state.walls.front.type === 'shelves' &&
            state.walls.back.type === 'open' &&
            state.walls.left.type === 'branded-panel' &&
            state.walls.right.type === 'branded-panel'
          ? state.palletType
          : 'custom'

    const config: WizardPalletConfig = {
      id: crypto.randomUUID(),
      name: `${state.palletType === 'full' ? 'Full' : 'Half'} ${state.baseWidth}×${state.baseDepth}`,
      type: isCustom,
      base: {
        width: state.baseWidth,
        depth: state.baseDepth,
        height: state.baseHeight,
        preset: state.preset,
      },
      display: {
        tierCount: state.tierCount,
        maxHeight: state.maxHeight,
        tiers: state.tierHeights.map((h, i) => ({ id: i + 1, trayHeight: h })),
        walls: {
          front: { ...state.walls.front, backgroundColor: state.panelColor },
          back: { ...state.walls.back, backgroundColor: state.panelColor },
          left: { ...state.walls.left, backgroundColor: state.panelColor },
          right: { ...state.walls.right, backgroundColor: state.panelColor },
        },
        shelfDepth: state.shelfDepth,
        header: {
          enabled: state.headerEnabled,
          text: state.headerText,
          color: state.headerColor,
        },
      },
      branding: {
        lipColor: state.lipColor,
        lipText: state.lipText,
        lipTextColor: state.lipTextColor,
        panelColor: state.panelColor,
        panelText: state.panelText,
        featuredBrands: state.featuredBrands,
      },
    }

    onComplete(config)
  }, [state, onComplete])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative flex flex-col bg-white rounded-2xl overflow-hidden"
        style={{
          width: 900,
          height: 620,
          boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 56, borderBottom: '1px solid #E2E8F0' }}
        >
          <h2 className="text-[16px] font-bold" style={{ color: '#0F172A' }}>
            {editMode ? 'Edit Pallet Display' : 'Create New Pallet Display'}
          </h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center rounded-md transition-colors hover:bg-gray-100"
            style={{ width: 32, height: 32, color: '#94A3B8' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Split panel body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Configuration */}
          <div className="relative flex-[55] min-w-0" style={{ borderRight: '1px solid #E2E8F0' }}>
            <PalletTypeStep state={state} dispatch={dispatch} />
          </div>

          {/* Right: 3D Preview */}
          <div className="flex-[45] min-w-0" style={{ background: '#1A1A2E' }}>
            <Canvas
              camera={{ position: [90, 60, 90], fov: 42 }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              style={{ width: '100%', height: '100%' }}
            >
              <Suspense fallback={null}>
                <PalletDisplayScene
                  palletType={state.palletType}
                  palletDimensions={{
                    width: state.baseWidth,
                    depth: state.baseDepth,
                    height: state.baseHeight,
                  }}
                  maxDisplayHeight={state.maxHeight}
                  tierCount={state.tierCount}
                  lipColor={state.lipColor}
                  branding={{
                    lipText: state.lipText,
                    lipTextColor: state.lipTextColor,
                    headerText: state.headerEnabled ? state.headerText : undefined,
                    headerBackgroundColor: state.headerColor,
                  }}
                  placedProducts={[]}
                  showHeader={state.headerEnabled}
                  autoRotate
                  environment="retail"
                />
              </Suspense>
            </Canvas>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-6 shrink-0"
          style={{
            height: 64,
            background: '#FAFBFC',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg text-[13px] font-medium text-white transition-colors hover:opacity-90"
            style={{ background: '#2563EB' }}
          >
            <Sparkles size={14} />
            {editMode ? 'Update Pallet' : 'Create Pallet'}
          </button>
        </div>

        {/* Confirm close dialog */}
        {showConfirmClose && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-white rounded-xl p-6 shadow-xl max-w-xs text-center">
              <p className="text-[14px] font-semibold text-gray-900 mb-2">
                Discard changes?
              </p>
              <p className="text-[12px] text-gray-500 mb-5">
                Your wizard progress will be lost.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 rounded-lg text-[12px] font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Keep editing
                </button>
                <button
                  onClick={confirmClose}
                  className="px-4 py-2 rounded-lg text-[12px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
