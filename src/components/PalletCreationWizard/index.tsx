import { useState, useCallback, useMemo, useEffect, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoleHref } from '../../lib/role-href'
import { motion, AnimatePresence } from 'motion/react'
import { Canvas } from '@react-three/fiber'
import { ArrowLeft, ArrowRight, CalendarRange, Check, X } from 'lucide-react'
import { PalletDisplayScene } from '../PalletDisplay/PalletDisplayScene'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { compareSeasonsByHolidayDate, useSeasonStore } from '../../stores/season-store'
import { useAppSettingsStore } from '../../stores/app-settings-store'
import type { Holiday, PalletType, RetailerTier } from '../../types'

const SEASONS: { label: string; value: Holiday; icon: string }[] = [
  { label: 'Rosh Hashanah', value: 'rosh-hashanah', icon: '🍎' },
  { label: 'Pesach', value: 'pesach', icon: '🫓' },
  { label: 'Sukkos', value: 'sukkos', icon: '🌿' },
  { label: 'Everyday', value: 'none', icon: '📦' },
]

const tierColors: Record<RetailerTier, string> = {
  enterprise: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  premium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  standard: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-10">
      {Array.from({ length: total }, (_, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              index === current
                ? 'bg-white scale-125'
                : index < current
                  ? 'bg-white/60'
                  : 'bg-white/20'
            }`}
          />
          {index < total - 1 && (
            <div
              className={`w-8 h-px transition-colors duration-300 ${
                index < current ? 'bg-white/40' : 'bg-white/10'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function SelectionCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl border p-6 text-left transition-all duration-200
        cursor-pointer group w-full
        ${
          selected
            ? 'border-white/40 bg-white/[0.08] ring-1 ring-white/20'
            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
        }
        ${className}
      `}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
          <Check size={12} className="text-[#111]" />
        </div>
      )}
      {children}
    </button>
  )
}

type PalletOption = {
  value: PalletType
  label: string
  size: string
}

const PALLET_OPTIONS: PalletOption[] = [
  { value: 'half', label: 'Half Pallet', size: '24" x 20"' },
  { value: 'full', label: 'Full Pallet', size: '48" x 40"' },
]

function PalletTypeCarousel({
  value,
  onChange,
}: {
  value: PalletType
  onChange: (next: PalletType) => void
}) {
  const activeIndex = PALLET_OPTIONS.findIndex((option) => option.value === value)
  const activeOption = PALLET_OPTIONS[activeIndex]

  const goPrev = () => {
    const next = (activeIndex - 1 + PALLET_OPTIONS.length) % PALLET_OPTIONS.length
    onChange(PALLET_OPTIONS[next].value)
  }
  const goNext = () => {
    const next = (activeIndex + 1) % PALLET_OPTIONS.length
    onChange(PALLET_OPTIONS[next].value)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative mx-auto w-full h-[340px] rounded-xl overflow-hidden bg-gradient-to-b from-[#1d1d1d] to-[#0f0f0f] border border-white/[0.06]">
        <Canvas
          camera={{ position: [85, 60, 85], fov: 38 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <PalletDisplayScene
              key={value}
              palletType={value}
              palletDimensions={{ width: 48, depth: 40, height: 6 }}
              tierCount={4}
              maxDisplayHeight={60}
              lipColor="#3B7DD8"
              branding={{
                lipText: '',
                lipTextColor: '#FFFFFF',
                headerText: 'Rosh Hashanah',
                headerTextColor: '#FFFFFF',
                headerBackgroundColor: '#3B7DD8',
              }}
              placedProducts={[]}
              showHeader
              autoRotate
              environment="retail"
            />
          </Suspense>
        </Canvas>

        <button
          type="button"
          onClick={goPrev}
          className="group absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/[0.15] hover:bg-black/70 hover:border-white/40 text-white/90 transition-colors"
          aria-label={`Switch to ${PALLET_OPTIONS[(activeIndex - 1 + PALLET_OPTIONS.length) % PALLET_OPTIONS.length].label}`}
        >
          <ArrowLeft size={14} />
          <span className="text-[11px] font-medium uppercase tracking-wide">
            {PALLET_OPTIONS[(activeIndex - 1 + PALLET_OPTIONS.length) % PALLET_OPTIONS.length].label.replace(' Pallet', '')}
          </span>
        </button>
        <button
          type="button"
          onClick={goNext}
          className="group absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-2 pl-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/[0.15] hover:bg-black/70 hover:border-white/40 text-white/90 transition-colors"
          aria-label={`Switch to ${PALLET_OPTIONS[(activeIndex + 1) % PALLET_OPTIONS.length].label}`}
        >
          <span className="text-[11px] font-medium uppercase tracking-wide">
            {PALLET_OPTIONS[(activeIndex + 1) % PALLET_OPTIONS.length].label.replace(' Pallet', '')}
          </span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex flex-col items-center mt-8 gap-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeOption.value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <p className="text-[15px] font-medium text-white">{activeOption.label}</p>
            <p className="text-[12px] text-[#666] mt-0.5">{activeOption.size}</p>
          </motion.div>
        </AnimatePresence>
        <div className="inline-flex p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
          {PALLET_OPTIONS.map((option) => {
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-[#111]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface PalletCreationWizardProps {
  open: boolean
  onClose: () => void
  retailerId?: string
  allowedRetailerIds?: string[]
}

export function PalletCreationWizard({
  open,
  onClose,
  retailerId: pinnedRetailerId,
  allowedRetailerIds,
}: PalletCreationWizardProps) {
  const navigate = useNavigate()
  const roleHref = useRoleHref()
  const lastUsedConfig = useDisplayStore((state) => state.lastUsedConfig)
  const createProject = useDisplayStore((state) => state.createProject)
  const allRetailers = useRetailerStore((state) => state.retailers)
  const retailers = useMemo(() => {
    if (!allowedRetailerIds) return allRetailers
    const allowed = new Set(allowedRetailerIds)
    return allRetailers.filter((retailer) => allowed.has(retailer.id))
  }, [allRetailers, allowedRetailerIds])
  const seasons = useSeasonStore((state) => state.seasons)
  const appSettings = useAppSettingsStore((s) => s.settings)

  const retailerSelectionRequired = !pinnedRetailerId
  const steps = retailerSelectionRequired
    ? ['Pallet Type', 'Season', 'Retailer', 'Name']
    : ['Pallet Type', 'Season', 'Name']

  const seasonStepIndex = 1
  const retailerStepIndex = retailerSelectionRequired ? 2 : -1

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [palletType, setPalletType] = useState<PalletType>(
    lastUsedConfig?.palletType ?? appSettings.defaultPalletType
  )
  const [season, setSeason] = useState<Holiday>(
    lastUsedConfig?.season ?? appSettings.defaultHoliday
  )
  const isRetailerAllowed = useCallback(
    (id: string | undefined | null) => {
      if (!id) return false
      if (!allowedRetailerIds) return true
      return allowedRetailerIds.includes(id)
    },
    [allowedRetailerIds],
  )
  const [retailerId, setRetailerId] = useState<string>(
    pinnedRetailerId ?? (isRetailerAllowed(lastUsedConfig?.retailerId) ? lastUsedConfig?.retailerId ?? '' : '')
  )
  const [seasonId, setSeasonId] = useState<string | null>(
    lastUsedConfig?.seasonId ?? null
  )
  const [name, setName] = useState('')

  const selectedRetailer = retailers.find((retailer) => retailer.id === retailerId)

  const selectedSeasonName = seasonId
    ? seasons.find((entry) => entry.id === seasonId)?.name
    : null

  const defaultName = useMemo(() => {
    if (!selectedRetailer) return ''
    const prefix = selectedSeasonName ?? 'Pallet'
    return `${prefix} - ${selectedRetailer.name}`
  }, [selectedSeasonName, selectedRetailer])

  useEffect(() => {
    if (!open) return

    const seeded = pinnedRetailerId ?? lastUsedConfig?.retailerId ?? ''
    const nextRetailerId = isRetailerAllowed(seeded) ? seeded : ''
    setStep(0)
    setDirection(1)
    setPalletType(lastUsedConfig?.palletType ?? appSettings.defaultPalletType)
    setSeason(lastUsedConfig?.season ?? appSettings.defaultHoliday)
    setRetailerId(nextRetailerId)
    setSeasonId(lastUsedConfig?.seasonId ?? null)
    // Reset only on open transition; other deps would jump the user back to step 0 mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    setName(defaultName)
  }, [defaultName, open])

  const canProceed = useMemo(() => {
    const nameStepIndex = steps.length - 1

    if (step === 0) return !!palletType
    if (step === seasonStepIndex) return seasonId !== null
    if (step === retailerStepIndex) return !!retailerId
    if (step === nameStepIndex) return name.trim().length > 0
    return false
  }, [step, palletType, seasonId, retailerId, name, seasonStepIndex, retailerStepIndex, steps.length])

  const goNext = useCallback(() => {
    if (step < steps.length - 1) {
      setDirection(1)
      setStep((current) => current + 1)
    }
  }, [step, steps.length])

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1)
      setStep((current) => current - 1)
    }
  }, [step])

  const handleCreate = useCallback(() => {
    if (!retailerId || !name.trim()) return

    const retailer = retailers.find((entry) => entry.id === retailerId)
    const project = createProject(
      name.trim(),
      { palletType, season, retailerId, seasonId },
      retailer?.defaultTierCount ?? 4
    )

    onClose()
    navigate(roleHref(`/retailers/${retailerId}/pallets/${project.id}`))
  }, [retailerId, name, retailers, palletType, season, seasonId, createProject, navigate, roleHref, onClose])

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-6 bg-[#161616] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-2">
          <h1 className="text-[22px] font-semibold text-white tracking-tight">
            New Pallet
          </h1>
          <p className="text-[13px] text-[#666] mt-1">{steps[step]}</p>
        </div>

        <StepIndicator current={step} total={steps.length} />

        <div className="relative overflow-hidden min-h-[480px]">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <PalletTypeCarousel value={palletType} onChange={setPalletType} />
              </motion.div>
            )}

            {step === seasonStepIndex && (
              <motion.div
                key="step-season"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-3 max-h-[420px] overflow-y-auto pr-1"
              >
                {seasons
                  .filter((entry) => !entry.archived)
                  .slice()
                  .sort(compareSeasonsByHolidayDate)
                  .map((entry) => (
                    <SelectionCard
                      key={entry.id}
                      selected={seasonId === entry.id}
                      onClick={() => setSeasonId(entry.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-white/[0.08] flex items-center justify-center">
                          <CalendarRange size={16} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-white">{entry.name}</p>
                        </div>
                      </div>
                    </SelectionCard>
                  ))}
              </motion.div>
            )}

            {retailerSelectionRequired && step === retailerStepIndex && (
              <motion.div
                key="step-retailer"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-2 max-h-[420px] overflow-y-auto pr-1"
              >
                {retailers
                  .filter((retailer) =>
                    !allowedRetailerIds || allowedRetailerIds.includes(retailer.id),
                  )
                  .map((retailer) => (
                  <SelectionCard
                    key={retailer.id}
                    selected={retailer.id === retailerId}
                    onClick={() => setRetailerId(retailer.id)}
                    className="!p-4"
                  >
                    <p className="text-[14px] font-medium text-white">{retailer.name}</p>
                  </SelectionCard>
                ))}
              </motion.div>
            )}

            {step === steps.length - 1 && (
              <motion.div
                key="step-name"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="max-w-xl mx-auto pt-10"
              >
                <div className="mb-6 rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
                  <p className="text-[11px] uppercase tracking-wider text-[#777]">Retailer</p>
                  <p className="text-[15px] font-medium text-white mt-1">
                    {selectedRetailer?.name ?? 'Select a retailer'}
                  </p>
                  <p className="text-[12px] text-[#777] mt-3">
                    Season:{' '}
                    {seasonId
                      ? seasons.find((entry) => entry.id === seasonId)?.name ?? '—'
                      : 'None'}
                  </p>
                </div>

                <label className="block text-[12px] font-medium text-[#aaa] mb-2">
                  Pallet name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter pallet name"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <p className="text-[12px] text-[#666] mt-3">
                  This pallet will automatically live inside the selected retailer.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={goBack}
            disabled={step === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-[#bbb] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-[12px] font-medium bg-white text-[#111] hover:bg-[#eee] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-[12px] font-medium bg-white text-[#111] hover:bg-[#eee] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Create Pallet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
