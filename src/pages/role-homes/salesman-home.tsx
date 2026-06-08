import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, ChevronDown, Plus, UserCircle2 } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { useSeasonStore } from '../../stores/season-store'
import { useSalespersonStore } from '../../stores/salesperson-store'
import { useRoleStore } from '../../stores/role-store'
import { StatusPill } from '../../components/Status/status-pill'
import { DeadlineChip } from '../../components/Deadline/deadline-chip'
import { StartProgramWizard } from '../../components/StartProgramWizard'
import { computeConfirmByDate } from '../../lib/deadline'
import type { DisplayProject, PalletStatus } from '../../types'

// When a program has multiple pallets in different states, surface the one
// furthest along.
const STATUS_INDEX: Record<PalletStatus, number> = {
  draft: 0,
  ready: 1,
  in_build: 2,
  built: 3,
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SalesmanHome() {
  const projects = useDisplayStore((state) => state.projects)
  const retailers = useRetailerStore((state) => state.retailers)
  const seasons = useSeasonStore((state) => state.seasons)
  const salespeople = useSalespersonStore((state) => state.salespeople)
  const activeSalespersonId = useRoleStore((state) => state.activeSalespersonId)
  const setActiveSalespersonId = useRoleStore((state) => state.setActiveSalespersonId)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardPinnedRetailerId, setWizardPinnedRetailerId] = useState<
    string | null
  >(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleItems = (retailerId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(retailerId)) next.delete(retailerId)
      else next.add(retailerId)
      return next
    })
  }

  const openWizard = (retailerId: string | null = null) => {
    setWizardPinnedRetailerId(retailerId)
    setWizardOpen(true)
  }

  const activeSalesperson = activeSalespersonId
    ? salespeople.find((sp) => sp.id === activeSalespersonId) ?? null
    : null

  const retailerById = useMemo(
    () => new Map(retailers.map((r) => [r.id, r])),
    [retailers],
  )
  const seasonById = useMemo(
    () => new Map(seasons.map((s) => [s.id, s])),
    [seasons],
  )

  const scopedRetailerIds = useMemo(
    () => new Set(activeSalesperson?.retailerIds ?? []),
    [activeSalesperson],
  )

  // Salesmen can see pallets on inactive programs (history) but can't start
  // new ones. The wizard's allowed-retailer list filters out inactives.
  const buildableRetailerIds = useMemo(() => {
    if (!activeSalesperson) return [] as string[]
    return retailers
      .filter((r) => activeSalesperson.retailerIds.includes(r.id) && r.status !== 'inactive')
      .map((r) => r.id)
  }, [retailers, activeSalesperson])

  const scopedProjects = useMemo(() => {
    if (!activeSalesperson) return []
    return projects.filter((p) => scopedRetailerIds.has(p.retailerId))
  }, [projects, scopedRetailerIds, activeSalesperson])

  // Roll pallets up by program (retailer × season).
  interface ProgramCard {
    key: string
    retailerId: string
    seasonId: string | null
    seasonName: string
    pallets: DisplayProject[]
    leadStatus: PalletStatus
    updatedAt: number
  }
  const programs: ProgramCard[] = useMemo(() => {
    const map = new Map<string, ProgramCard>()
    for (const project of scopedProjects) {
      const key = `${project.retailerId}::${project.seasonId ?? '__none__'}`
      const existing = map.get(key)
      const seasonName = project.seasonId
        ? seasonById.get(project.seasonId)?.name ?? 'Season'
        : 'Everyday'
      if (existing) {
        existing.pallets.push(project)
        if (STATUS_INDEX[project.status] > STATUS_INDEX[existing.leadStatus]) {
          existing.leadStatus = project.status
        }
        existing.updatedAt = Math.max(existing.updatedAt, project.updatedAt)
      } else {
        map.set(key, {
          key,
          retailerId: project.retailerId,
          seasonId: project.seasonId,
          seasonName,
          pallets: [project],
          leadStatus: project.status,
          updatedAt: project.updatedAt,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )
  }, [scopedProjects, seasonById])

  // Group programs by retailer for the unified view.
  interface RetailerBucket {
    retailerId: string
    retailerName: string
    isInactive: boolean
    programs: ProgramCard[]
  }
  const retailerBuckets: RetailerBucket[] = useMemo(() => {
    if (!activeSalesperson) return []
    const programsByRetailer = new Map<string, ProgramCard[]>()
    for (const program of programs) {
      const list = programsByRetailer.get(program.retailerId) ?? []
      list.push(program)
      programsByRetailer.set(program.retailerId, list)
    }
    // Sort programs within each retailer by most-recent-update.
    for (const list of programsByRetailer.values()) {
      list.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    const buckets: RetailerBucket[] = activeSalesperson.retailerIds
      .map((id) => retailerById.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        retailerId: r.id,
        retailerName: r.name,
        isInactive: r.status === 'inactive',
        programs: programsByRetailer.get(r.id) ?? [],
      }))
    // Retailers with programs float to the top; otherwise alpha.
    return buckets.sort((a, b) => {
      if (a.programs.length !== b.programs.length) {
        return b.programs.length - a.programs.length
      }
      return a.retailerName.localeCompare(b.retailerName)
    })
  }, [activeSalesperson, programs, retailerById])

  // Hero state when no salesperson is picked yet.
  if (!activeSalesperson) {
    return (
      <div className="px-8 py-16 max-w-[840px] mx-auto">
        <p className="text-[11px] uppercase tracking-wider text-[#999] flex items-center gap-1.5">
          <Briefcase className="w-3 h-3" />
          Salesman
        </p>
        <h1 className="text-[32px] font-semibold tracking-display text-[#171717] mt-2">
          Who's working today?
        </h1>
        <p className="text-[14px] text-[#666] mt-2 max-w-lg">
          Pick your name to scope the app to your retailers. You can switch later from the top-right.
        </p>

        {salespeople.length === 0 ? (
          <div className="mt-10 bg-white shadow-card rounded-2xl p-12 text-center">
            <UserCircle2 className="w-9 h-9 text-[#ccc] mx-auto mb-3" />
            <p className="text-[14px] text-[#666]">
              No salespeople have been added yet. Ask your manager to set up the team.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {salespeople.map((sp) => (
              <button
                key={sp.id}
                onClick={() => setActiveSalespersonId(sp.id)}
                className="group bg-white shadow-card hover:shadow-elevated transition-all rounded-xl p-5 flex items-center gap-4 text-left"
              >
                <span className="w-12 h-12 rounded-full bg-[#171717] text-white text-[14px] font-semibold flex items-center justify-center shrink-0">
                  {initialsOf(sp.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#171717] truncate">
                    {sp.name}
                  </p>
                  <p className="text-[12px] text-[#888] mt-0.5">
                    {sp.retailerIds.length} retailer
                    {sp.retailerIds.length === 1 ? '' : 's'} assigned
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#ccc] group-hover:text-[#171717] group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <div className="mb-6 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#999]">
            Hello, {activeSalesperson.name.split(' ')[0]}
          </p>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#171717] mt-1">
            Your retailers &amp; programs
          </h1>
        </div>
        <button
          onClick={() => openWizard(null)}
          disabled={buildableRetailerIds.length === 0}
          title={
            buildableRetailerIds.length === 0
              ? 'All your programs are inactive — ask your manager to reactivate one.'
              : undefined
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Start a program
        </button>
      </div>

      {retailerBuckets.length === 0 ? (
        <div className="bg-white shadow-card rounded-2xl p-16 text-center">
          <Briefcase className="w-9 h-9 text-[#ccc] mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[#171717]">
            No retailers assigned yet
          </p>
          <p className="text-[13px] text-[#888] mt-2 max-w-md mx-auto">
            Ask your manager to assign you to retailers from the Assignments
            page.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {retailerBuckets.map((bucket) => {
            const retailer = retailerById.get(bucket.retailerId)
            const authorizedItems = (retailer?.authorizedItems ?? []).filter(
              (item) => item.status === 'authorized',
            )
            const itemsOpen = expandedItems.has(bucket.retailerId)

            return (
            <section key={bucket.retailerId}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-[16px] font-semibold text-[#171717] truncate">
                    {bucket.retailerName}
                  </h3>
                  {bucket.isInactive && (
                    <span className="text-[10px] uppercase tracking-wider text-[#999] px-1.5 py-0.5 rounded bg-[#f5f5f5]">
                      Inactive
                    </span>
                  )}
                  <span className="text-[11px] text-[#888]">
                    · {bucket.programs.length} program
                    {bucket.programs.length === 1 ? '' : 's'}
                  </span>
                </div>
                {authorizedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleItems(bucket.retailerId)}
                    aria-expanded={itemsOpen}
                    className="inline-flex items-center gap-1 text-[11px] text-[#0a72ef] hover:underline shrink-0"
                  >
                    {authorizedItems.length} item{authorizedItems.length === 1 ? '' : 's'}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        itemsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
              </div>

              {itemsOpen && authorizedItems.length > 0 && (
                <div className="mb-3 bg-white shadow-card rounded-xl p-4 max-h-72 overflow-y-auto">
                  <ul className="space-y-1.5">
                    {authorizedItems.map((item) => (
                      <li
                        key={item.productId}
                        className="flex items-center justify-between gap-3 text-[12px]"
                      >
                        <span className="text-[#171717] truncate">{item.productName}</span>
                        <span className="text-[10px] text-[#999] font-mono tabular-nums shrink-0">
                          {item.sku}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bucket.programs.length === 0 ? (
                <div className="bg-white shadow-card rounded-xl p-8 text-center">
                  <p className="text-[13px] text-[#888]">
                    No programs yet for {bucket.retailerName}.
                  </p>
                  {!bucket.isInactive && (
                    <button
                      onClick={() => openWizard(bucket.retailerId)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#171717] text-white text-[12px] font-medium hover:bg-[#333] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Start a program
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {bucket.programs.map((program) => {
                    const season = program.seasonId
                      ? seasonById.get(program.seasonId)
                      : undefined
                    const half = program.pallets.find(
                      (p) => p.palletType === 'half',
                    )
                    const full = program.pallets.find(
                      (p) => p.palletType === 'full',
                    )
                    const skuIds = new Set<string>()
                    let totalCases = 0
                    for (const pallet of program.pallets) {
                      const qty = pallet.quantity ?? 1
                      for (const entry of pallet.assortment) {
                        if (entry.cases > 0) skuIds.add(entry.productId)
                        totalCases += entry.cases * qty
                      }
                    }
                    const confirmBy = season?.holidayDate
                      ? computeConfirmByDate(season.holidayDate)
                      : null
                    const programLink = `/salesman/retailers/${program.retailerId}/program/${program.seasonId ?? program.pallets[0].season}`
                    return (
                      <div
                        key={program.key}
                        className="group bg-white shadow-card hover:shadow-elevated transition-all rounded-xl p-4"
                      >
                        <Link
                          to={programLink}
                          className="block"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-[13px] font-semibold text-[#171717] truncate">
                              {program.seasonName}
                            </p>
                            <StatusPill
                              status={program.leadStatus}
                              role="salesman"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#888]">
                            {half && (
                              <span className="px-1.5 py-0.5 rounded bg-[#f5f5f5] font-medium">
                                Half x {half.quantity ?? 1}
                              </span>
                            )}
                            {full && (
                              <span className="px-1.5 py-0.5 rounded bg-[#f5f5f5] font-medium">
                                Full x {full.quantity ?? 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#666] tabular-nums">
                            <span>{skuIds.size} SKUs</span>
                            <span>·</span>
                            <span>{totalCases} cases</span>
                          </div>
                          {confirmBy && program.leadStatus !== 'built' && (
                            <div className="mt-2">
                              <DeadlineChip confirmByMs={confirmBy} size="sm" />
                            </div>
                          )}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
            )
          })}
        </div>
      )}

      <StartProgramWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        allowedRetailerIds={buildableRetailerIds}
        pinnedRetailerId={wizardPinnedRetailerId ?? undefined}
      />
    </div>
  )
}
