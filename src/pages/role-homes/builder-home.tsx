import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Hammer, HardHat, MapPin, Package } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { compareSeasonsByHolidayDate, useSeasonStore } from '../../stores/season-store'
import { StatusPill } from '../../components/Status/status-pill'
import { DeadlineChip } from '../../components/Deadline/deadline-chip'
import { CommentCountBadge } from '../../components/Comments/comment-count-badge'
import { computeConfirmByDate } from '../../lib/deadline'
import type { BuildLocation, DisplayProject, PalletStatus } from '../../types'

const LOCATION_LABELS: Record<BuildLocation | 'unassigned', string> = {
  hook: 'Hook',
  goshen: 'Goshen',
  'third-party': '3rd Party',
  unassigned: 'Unassigned',
}

const ALL_LOCATIONS: (BuildLocation | 'unassigned')[] = [
  'hook',
  'goshen',
  'third-party',
  'unassigned',
]

function deadlineMs(pallet: DisplayProject, seasons: ReturnType<typeof useSeasonStore.getState>['seasons']): number | null {
  if (pallet.shipByDate) return pallet.shipByDate
  const season = pallet.seasonId ? seasons.find((s) => s.id === pallet.seasonId) : undefined
  if (!season?.holidayDate) return null
  return computeConfirmByDate(season.holidayDate)
}

export function BuilderHome() {
  const projects = useDisplayStore((state) => state.projects)
  const updateStatusFor = useDisplayStore((state) => state.updateStatusFor)
  const setBuildLocationFor = useDisplayStore((state) => state.setBuildLocationFor)
  const seasons = useSeasonStore((state) => state.seasons)
  const retailers = useRetailerStore((state) => state.retailers)

  const [seasonFilter, setSeasonFilter] = useState<string>('')
  const [locationFilter, setLocationFilter] = useState<BuildLocation | 'unassigned' | 'all'>('all')

  const retailerById = useMemo(
    () => new Map(retailers.map((r) => [r.id, r])),
    [retailers],
  )

  const selectableSeasons = useMemo(
    () => seasons.filter((s) => !s.archived).slice().sort(compareSeasonsByHolidayDate),
    [seasons],
  )

  const queue = useMemo(() => {
    return projects
      .filter((p) => p.status === 'ready' || p.status === 'in_build')
      .filter((p) => (seasonFilter ? p.seasonId === seasonFilter : true))
      .filter((p) => {
        if (locationFilter === 'all') return true
        const loc = p.buildLocation ?? 'unassigned'
        return loc === locationFilter
      })
      .sort((a, b) => {
        const aDl = deadlineMs(a, seasons) ?? Number.POSITIVE_INFINITY
        const bDl = deadlineMs(b, seasons) ?? Number.POSITIVE_INFINITY
        if (aDl !== bDl) return aDl - bDl
        return a.updatedAt - b.updatedAt
      })
  }, [projects, seasonFilter, locationFilter, seasons])

  const counts = useMemo(() => {
    const all = projects.filter((p) => p.status === 'ready' || p.status === 'in_build')
    return {
      ready: all.filter((p) => p.status === 'ready').length,
      inBuild: all.filter((p) => p.status === 'in_build').length,
      built: projects.filter((p) => p.status === 'built').length,
    }
  }, [projects])

  const upNext = queue[0]

  const advance = (pallet: DisplayProject, next: PalletStatus) => {
    updateStatusFor(pallet.id, next)
  }

  return (
    <div className="px-8 py-8 max-w-[1320px] mx-auto">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-[#999] flex items-center gap-1.5">
          <HardHat className="w-3 h-3" />
          Build queue
        </p>
        <h1 className="text-[28px] font-semibold tracking-display text-[#171717] mt-1">
          What to build next
        </h1>
        <p className="text-[13px] text-[#666] mt-2">
          Pallets sorted by ship-by deadline. Move them through ready → in build → built.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white shadow-card rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-[#999]">Ready</p>
          <p className="text-[22px] font-semibold text-[#171717] tabular-nums mt-1">{counts.ready}</p>
        </div>
        <div className="bg-white shadow-card rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-[#999]">In build</p>
          <p className="text-[22px] font-semibold text-amber-700 tabular-nums mt-1">{counts.inBuild}</p>
        </div>
        <div className="bg-white shadow-card rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-[#999]">Built</p>
          <p className="text-[22px] font-semibold text-emerald-700 tabular-nums mt-1">{counts.built}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          className="text-[13px] font-medium text-[#171717] px-3 py-2 shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
        >
          <option value="">All seasons</option>
          {selectableSeasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>

        <div className="flex items-center shadow-ring rounded-md overflow-hidden">
          <button
            onClick={() => setLocationFilter('all')}
            className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
              locationFilter === 'all' ? 'bg-[#171717] text-white' : 'bg-white text-[#666] hover:bg-[#fafafa]'
            }`}
          >
            All
          </button>
          {ALL_LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                locationFilter === loc ? 'bg-[#171717] text-white' : 'bg-white text-[#666] hover:bg-[#fafafa]'
              }`}
            >
              {LOCATION_LABELS[loc]}
            </button>
          ))}
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="bg-white shadow-card rounded-2xl p-16 text-center">
          <Package className="w-9 h-9 text-[#ccc] mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[#171717]">Nothing to build</p>
          <p className="text-[13px] text-[#888] mt-2 max-w-md mx-auto">
            No pallets are ready or in progress for the current filters.
          </p>
        </div>
      ) : (
        <>
          {upNext && (
            <section className="mb-8">
              <p className="text-[11px] uppercase tracking-wider text-[#999] mb-3">Up next</p>
              <PalletQueueCard
                pallet={upNext}
                retailerName={retailerById.get(upNext.retailerId)?.name ?? '—'}
                deadline={deadlineMs(upNext, seasons)}
                onAdvance={advance}
                onSetLocation={setBuildLocationFor}
                hero
              />
            </section>
          )}

          {queue.length > 1 && (
            <section>
              <p className="text-[11px] uppercase tracking-wider text-[#999] mb-3">After that</p>
              <div className="space-y-2">
                {queue.slice(1).map((pallet) => (
                  <PalletQueueCard
                    key={pallet.id}
                    pallet={pallet}
                    retailerName={retailerById.get(pallet.retailerId)?.name ?? '—'}
                    deadline={deadlineMs(pallet, seasons)}
                    onAdvance={advance}
                    onSetLocation={setBuildLocationFor}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

interface PalletQueueCardProps {
  pallet: DisplayProject
  retailerName: string
  deadline: number | null
  onAdvance: (pallet: DisplayProject, next: PalletStatus) => void
  onSetLocation: (palletId: string, location: BuildLocation | null) => void
  hero?: boolean
}

function PalletQueueCard({
  pallet,
  retailerName,
  deadline,
  onAdvance,
  onSetLocation,
  hero,
}: PalletQueueCardProps) {
  const cases = pallet.assortment.reduce((s, e) => s + e.cases, 0)
  const log = pallet.buildLog ?? []
  const totalBuilt = log.reduce((s, e) => s + e.built, 0)

  return (
    <div
      className={`bg-white rounded-xl ${hero ? 'shadow-elevated p-6' : 'shadow-card p-4'}`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 mb-2">
            <StatusPill status={pallet.status} size={hero ? 'md' : 'sm'} role="builder" />
            {deadline && pallet.status !== 'built' && (
              <DeadlineChip confirmByMs={deadline} size="sm" />
            )}
          </div>
          <Link
            to={`/builder/retailers/${pallet.retailerId}/pallets/${pallet.id}`}
            className="block group"
          >
            <p
              className={`${
                hero ? 'text-[20px]' : 'text-[15px]'
              } font-semibold text-[#171717] group-hover:text-[#0a72ef] transition-colors`}
            >
              {pallet.name}
            </p>
            <p className="text-[12px] text-[#888] mt-1">
              {retailerName} · {pallet.palletType} · {pallet.assortment.length} SKUs · {cases} cases
              <span className="ml-2">
                <CommentCountBadge count={pallet.comments?.length} />
              </span>
            </p>
          </Link>
          {totalBuilt > 0 && (
            <p className="text-[11px] text-emerald-700 mt-2 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {totalBuilt} built across {log.length} entries
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pallet.buildLocation ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onSetLocation(pallet.id, v === '' ? null : (v as BuildLocation))
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#555] shadow-border rounded-md bg-white focus:outline-none cursor-pointer"
          >
            <option value="">Unassigned</option>
            <option value="hook">Hook</option>
            <option value="goshen">Goshen</option>
            <option value="third-party">3rd Party</option>
          </select>

          {pallet.status === 'ready' && (
            <button
              onClick={() => onAdvance(pallet, 'in_build')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              <Hammer className="w-3.5 h-3.5" />
              Start build
            </button>
          )}
          {pallet.status === 'in_build' && (
            <button
              onClick={() => onAdvance(pallet, 'built')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark built
            </button>
          )}
        </div>
      </div>

      {pallet.buildLocation && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#888]">
          <MapPin className="w-3 h-3" />
          {LOCATION_LABELS[pallet.buildLocation]}
        </div>
      )}
    </div>
  )
}
