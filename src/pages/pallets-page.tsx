import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Boxes, Search, X } from 'lucide-react'
import { useDisplayStore } from '../stores/display-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useSeasonStore } from '../stores/season-store'
import { useRoleStore } from '../stores/role-store'
import { StatusPill, STATUS_LABELS, getStatusLabel } from '../components/Status/status-pill'
import { DeadlineChip } from '../components/Deadline/deadline-chip'
import { CommentCountBadge } from '../components/Comments/comment-count-badge'
import { computeConfirmByDate } from '../lib/deadline'
import { useRoleHref } from '../lib/role-href'
import { getPalletQuantity } from '../lib/assortment-utils'
import type { PalletStatus } from '../types'

const STATUS_ORDER: PalletStatus[] = ['draft', 'ready', 'in_build', 'built']

export function PalletsPage() {
  const projects = useDisplayStore((state) => state.projects)
  const retailers = useRetailerStore((state) => state.retailers)
  const seasons = useSeasonStore((state) => state.seasons)
  const role = useRoleStore((state) => state.role)
  const roleHref = useRoleHref()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [seasonFilter, setSeasonFilter] = useState<string>('')

  const statusParam = searchParams.get('status') as PalletStatus | null
  const statusFilter: PalletStatus | null =
    statusParam && (STATUS_ORDER as string[]).includes(statusParam)
      ? statusParam
      : null
  const clearStatusFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    setSearchParams(next, { replace: true })
  }

  const retailerById = useMemo(
    () => new Map(retailers.map((r) => [r.id, r])),
    [retailers],
  )
  const seasonById = useMemo(
    () => new Map(seasons.map((s) => [s.id, s])),
    [seasons],
  )

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects
      .filter((p) => (seasonFilter ? p.seasonId === seasonFilter : true))
      .filter((p) => (statusFilter ? p.status === statusFilter : true))
      .filter((p) => {
        if (!query) return true
        const retailerName = retailerById.get(p.retailerId)?.name ?? ''
        return (
          p.name.toLowerCase().includes(query) ||
          retailerName.toLowerCase().includes(query)
        )
      })
  }, [projects, seasonFilter, statusFilter, search, retailerById])

  const grouped = useMemo(() => {
    const groups: Record<PalletStatus, typeof projects> = {
      draft: [],
      ready: [],
      in_build: [],
      built: [],
    }
    for (const project of visibleProjects) {
      groups[project.status].push(project)
    }
    for (const status of STATUS_ORDER) {
      groups[status].sort((a, b) => b.updatedAt - a.updatedAt)
    }
    return groups
  }, [visibleProjects])

  const selectableSeasons = useMemo(
    () => seasons.filter((s) => !s.archived).slice(),
    [seasons],
  )

  return (
    <div className="px-8 py-10 max-w-[1320px] mx-auto">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-wider text-[#999]">All pallets</p>
        <h1 className="text-[28px] font-semibold tracking-display text-[#171717] mt-1">
          Pallets across every program
        </h1>
        <p className="text-[13px] text-[#666] mt-2 max-w-2xl">
          Every pallet from in progress through built, grouped by where it is in the workflow.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px] max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by pallet or retailer name…"
            className="w-full pl-9 pr-4 py-2 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none placeholder:text-[#aaa]"
          />
        </div>

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

        {statusFilter && (
          <button
            onClick={clearStatusFilter}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#171717] text-white text-[12px] font-medium hover:bg-[#333] transition-colors"
          >
            Status: {STATUS_LABELS[statusFilter]}
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {visibleProjects.length === 0 ? (
        <div className="bg-white shadow-card rounded-2xl p-16 text-center">
          <Boxes className="w-9 h-9 text-[#ccc] mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[#171717]">No pallets found</p>
          <p className="text-[13px] text-[#888] mt-2 max-w-md mx-auto">
            {search || seasonFilter
              ? 'Try clearing the filters.'
              : 'No pallets in the system yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {STATUS_ORDER.map((status) => {
            const items = grouped[status]
            if (items.length === 0) return null
            return (
              <section key={status}>
                <div className="flex items-center gap-3 mb-4">
                  <StatusPill status={status} role={role} />
                  <p className="text-[13px] text-[#666]">
                    {items.length} {items.length === 1 ? 'pallet' : 'pallets'}
                    {' · '}
                    {getStatusLabel(status, role)}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((pallet) => {
                    const retailer = retailerById.get(pallet.retailerId)
                    const season = pallet.seasonId
                      ? seasonById.get(pallet.seasonId)
                      : undefined
                    const cases = pallet.assortment.reduce((s, e) => s + e.cases, 0)
                    const quantity = getPalletQuantity(pallet)
                    const confirmBy = season?.holidayDate
                      ? computeConfirmByDate(season.holidayDate)
                      : null
                    return (
                      <Link
                        key={pallet.id}
                        to={roleHref(`/retailers/${pallet.retailerId}/pallets/${pallet.id}`)}
                        className="group bg-white shadow-card hover:shadow-elevated transition-all rounded-xl p-5"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <p className="text-[14px] font-semibold text-[#171717] truncate">
                            {pallet.name}
                          </p>
                          <ArrowRight className="w-3.5 h-3.5 text-[#ccc] group-hover:text-[#171717] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                        <p className="text-[11px] text-[#888]">
                          {retailer?.name ?? '—'}
                          {season ? ` · ${season.name}` : ''}
                        </p>
                        <div className="flex items-center gap-3 mt-3 text-[11px] text-[#666]">
                          <span className="capitalize">{pallet.palletType}</span>
                          <span>·</span>
                          <span>
                            {quantity} {pallet.palletType} pallet
                            {quantity === 1 ? '' : 's'}
                          </span>
                          <span>·</span>
                          <span>{pallet.assortment.length} SKUs</span>
                          <span>·</span>
                          <span>{cases * quantity} cases</span>
                          <CommentCountBadge count={pallet.comments?.length} />
                        </div>
                        {confirmBy && pallet.status !== 'built' && (
                          <div className="mt-3">
                            <DeadlineChip confirmByMs={confirmBy} size="sm" />
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
