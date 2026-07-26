import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, ArrowRight, CalendarRange, Check, X } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { useRoleStore } from '../../stores/role-store'
import {
  compareSeasonsByHolidayDate,
  useSeasonStore,
} from '../../stores/season-store'
import { useRoleHref } from '../../lib/role-href'
import { canRoleDo } from '../../lib/role-routes'
import { SpinningPallet } from './SpinningPallet'
import type { Holiday, PalletType, Retailer, Season } from '../../types'

interface StartProgramWizardProps {
  open: boolean
  onClose: () => void
  /** Pin the wizard to a single retailer (skips the retailer step). */
  pinnedRetailerId?: string
  /** Filter the retailer step to a subset (used for salesman scoping). */
  allowedRetailerIds?: string[]
}

type Step = 'retailer' | 'season' | 'types' | 'review'

// Infer the Holiday family from a free-form season name so users don't have
// to pick one explicitly. Falls back to 'none' (everyday).
function inferHoliday(name: string): Holiday {
  const lower = name.toLowerCase()
  if (lower.includes('rosh') || lower.includes('hashan')) return 'rosh-hashanah'
  if (lower.includes('pesach') || lower.includes('passover')) return 'pesach'
  if (lower.includes('sukk')) return 'sukkos'
  return 'none'
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
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
      className={`relative rounded-xl border p-5 text-left transition-all duration-200 cursor-pointer w-full ${
        selected
          ? 'border-white/40 bg-white/[0.08] ring-1 ring-white/20'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
      } ${className}`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center z-10 shadow-md">
          <Check size={12} className="text-[#111]" />
        </div>
      )}
      {children}
    </button>
  )
}

export function StartProgramWizard({
  open,
  onClose,
  pinnedRetailerId,
  allowedRetailerIds,
}: StartProgramWizardProps) {
  const navigate = useNavigate()
  const roleHref = useRoleHref()
  const retailers = useRetailerStore((state) => state.retailers)
  const seasons = useSeasonStore((state) => state.seasons)
  const createSeason = useSeasonStore((state) => state.createSeason)
  const createProject = useDisplayStore((state) => state.createProject)
  const role = useRoleStore((state) => state.role)
  const canCreateSeason = canRoleDo(role, 'createSeason')

  const allowedRetailers = useMemo(() => {
    let list = retailers.filter((r) => r.status !== 'inactive')
    if (allowedRetailerIds) {
      const allow = new Set(allowedRetailerIds)
      list = list.filter((r) => allow.has(r.id))
    }
    if (pinnedRetailerId) {
      list = list.filter((r) => r.id === pinnedRetailerId)
    }
    return list.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [retailers, allowedRetailerIds, pinnedRetailerId])

  const activeSeasons = useMemo(
    () => seasons.filter((s) => !s.archived).slice().sort(compareSeasonsByHolidayDate),
    [seasons],
  )

  const steps: Step[] = pinnedRetailerId
    ? ['season', 'types', 'review']
    : ['retailer', 'season', 'types', 'review']

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [retailerId, setRetailerId] = useState<string>(pinnedRetailerId ?? '')
  const [seasonId, setSeasonId] = useState<string>('')
  const [newSeasonName, setNewSeasonName] = useState('')
  const [includeHalf, setIncludeHalf] = useState(false)
  const [includeFull, setIncludeFull] = useState(true)

  useEffect(() => {
    if (!open) return
    setStepIndex(0)
    setDirection(1)
    setRetailerId(pinnedRetailerId ?? '')
    setSeasonId('')
    setNewSeasonName('')
    setIncludeHalf(false)
    setIncludeFull(true)
  }, [open, pinnedRetailerId])

  if (!open) return null

  const step = steps[stepIndex]
  const retailer: Retailer | undefined = retailers.find((r) => r.id === retailerId)
  const season: Season | undefined = seasons.find((s) => s.id === seasonId)

  const canAdvanceRetailer = retailerId !== ''
  const canAdvanceSeason =
    seasonId !== '' ||
    (canCreateSeason && newSeasonName.trim().length > 0)
  const canAdvanceTypes = includeHalf || includeFull
  const isLastStep = step === 'review'

  function goNext() {
    if (step === 'retailer' && !canAdvanceRetailer) return
    if (step === 'season' && !canAdvanceSeason) return
    if (step === 'types' && !canAdvanceTypes) return
    setDirection(1)
    setStepIndex((i) => Math.min(steps.length - 1, i + 1))
  }

  function goBack() {
    setDirection(-1)
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function handleCreate() {
    if (!retailer) return
    let effectiveSeason: Season | undefined = season
    if (!effectiveSeason) {
      if (!canCreateSeason) return
      const name = newSeasonName.trim()
      if (!name) return
      effectiveSeason = createSeason(name)
    }
    const seasonLabel = effectiveSeason.name
    const holiday = inferHoliday(seasonLabel)
    const types: PalletType[] = []
    if (includeHalf) types.push('half')
    if (includeFull) types.push('full')

    for (const type of types) {
      createProject(
        `${seasonLabel} ${type === 'full' ? 'Full' : 'Half'} — ${retailer.name}`,
        {
          palletType: type,
          season: holiday,
          retailerId: retailer.id,
          seasonId: effectiveSeason.id,
        },
        retailer.defaultTierCount ?? 4,
      )
    }

    onClose()
    navigate(
      roleHref(`/retailers/${retailer.id}/program/${effectiveSeason.id}`),
    )
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  const reviewTypesLabel = [
    includeHalf ? 'Half' : null,
    includeFull ? 'Full' : null,
  ]
    .filter(Boolean)
    .join(' + ')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-6 bg-[#161616] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-2">
          <h1 className="text-[22px] font-semibold text-white tracking-tight">
            Start a program
          </h1>
          <p className="text-[13px] text-[#666] mt-1 capitalize">
            {step === 'types' ? 'Pallet types' : step}
          </p>
        </div>

        <StepDots current={stepIndex} total={steps.length} />

        <div className="relative overflow-hidden min-h-[420px]">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 'retailer' && (
              <motion.div
                key="step-retailer"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-2 max-h-[380px] overflow-y-auto pr-1"
              >
                {allowedRetailers.length === 0 ? (
                  <p className="text-[12px] text-[#888] px-2 py-4">
                    No retailers available.
                  </p>
                ) : (
                  allowedRetailers.map((r) => (
                    <SelectionCard
                      key={r.id}
                      selected={retailerId === r.id}
                      onClick={() => setRetailerId(r.id)}
                      className="!p-4"
                    >
                      <p className="text-[14px] font-medium text-white">
                        {r.name}
                      </p>
                    </SelectionCard>
                  ))
                )}
              </motion.div>
            )}

            {step === 'season' && (
              <motion.div
                key="step-season"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {activeSeasons.length > 0 ? (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {activeSeasons.map((s) => (
                      <SelectionCard
                        key={s.id}
                        selected={seasonId === s.id}
                        onClick={() => {
                          setSeasonId(s.id)
                          setNewSeasonName('')
                        }}
                        className="!p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-white/[0.08] flex items-center justify-center">
                            <CalendarRange size={15} className="text-white" />
                          </div>
                          <p className="text-[14px] font-medium text-white">
                            {s.name}
                          </p>
                        </div>
                      </SelectionCard>
                    ))}
                  </div>
                ) : (
                  !canCreateSeason && (
                    <p className="text-[13px] text-[#888] px-2 py-6 text-center">
                      No active seasons yet. Ask your manager to set one up
                      before starting a program.
                    </p>
                  )
                )}
                {canCreateSeason && (
                  <div className={activeSeasons.length > 0 ? 'mt-5' : ''}>
                    <p className="text-[11px] uppercase tracking-wider text-[#777] mb-2">
                      Or create a new season
                    </p>
                    <input
                      autoFocus={activeSeasons.length === 0}
                      type="text"
                      value={newSeasonName}
                      onChange={(e) => {
                        setNewSeasonName(e.target.value)
                        if (e.target.value.trim()) setSeasonId('')
                      }}
                      placeholder="e.g. Rosh Hashanah 2026"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {step === 'types' && (
              <motion.div
                key="step-types"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <p className="text-[13px] text-[#888] mb-5 text-center">
                  Pick which pallet sizes are part of this program. You can edit
                  quantities and assortment after creation.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectionCard
                    selected={includeHalf}
                    onClick={() => setIncludeHalf((v) => !v)}
                  >
                    <div className="h-[280px] -mx-2 -mt-2 mb-3 pointer-events-none">
                      <SpinningPallet palletType="half" />
                    </div>
                    <p className="text-[15px] font-semibold text-white">
                      Half pallet
                    </p>
                    <p className="text-[12px] text-[#888] mt-1">
                      24" × 20" footprint
                    </p>
                  </SelectionCard>
                  <SelectionCard
                    selected={includeFull}
                    onClick={() => setIncludeFull((v) => !v)}
                  >
                    <div className="h-[280px] -mx-2 -mt-2 mb-3 pointer-events-none">
                      <SpinningPallet palletType="full" />
                    </div>
                    <p className="text-[15px] font-semibold text-white">
                      Full pallet
                    </p>
                    <p className="text-[12px] text-[#888] mt-1">
                      48" × 40" footprint
                    </p>
                  </SelectionCard>
                </div>
              </motion.div>
            )}

            {step === 'review' && retailer && (
              <motion.div
                key="step-review"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="max-w-md mx-auto pt-6"
              >
                <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5 space-y-3">
                  <ReviewRow label="Retailer" value={retailer.name} />
                  <ReviewRow
                    label="Season"
                    value={season?.name ?? (newSeasonName.trim() || '—')}
                  />
                  <ReviewRow label="Pallets" value={reviewTypesLabel || '—'} />
                </div>
                <p className="text-[12px] text-[#777] mt-5 text-center">
                  You'll land on the program matrix where you can fill in cases
                  per item and adjust how many pallets to build.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-[#bbb] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          {isLastStep ? (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-[12px] font-medium bg-white text-[#111] hover:bg-[#eee] transition-colors"
            >
              Create program
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={
                (step === 'retailer' && !canAdvanceRetailer) ||
                (step === 'season' && !canAdvanceSeason) ||
                (step === 'types' && !canAdvanceTypes)
              }
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-[12px] font-medium bg-white text-[#111] hover:bg-[#eee] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] uppercase tracking-wider text-[#666]">
        {label}
      </span>
      <span className="text-[14px] font-medium text-white text-right">
        {value || '—'}
      </span>
    </div>
  )
}
