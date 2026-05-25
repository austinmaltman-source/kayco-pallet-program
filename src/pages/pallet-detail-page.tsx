import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, CalendarDays, Copy, Package, PenLine, Store, Trash2 } from 'lucide-react'
import { AssortmentTable } from '../components/Assortment/assortment-table'
import { CommentsThread } from '../components/Comments/comments-thread'
import { StatusPill, STATUS_LABELS_BY_ROLE, getStatusLabel } from '../components/Status/status-pill'
import { DeadlineChip } from '../components/Deadline/deadline-chip'
import { computeConfirmByDate } from '../lib/deadline'
import type { PalletStatus } from '../types'
import { useCatalogStore } from '../stores/catalog-store'
import { useDisplayStore } from '../stores/display-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useRoleStore } from '../stores/role-store'
import { compareSeasonsByHolidayDate, useSeasonStore } from '../stores/season-store'
import { useRoleHref } from '../lib/role-href'
import { useSmartBack } from '../lib/use-smart-back'
import { useConfirm } from '../components/ConfirmDialog'

function fmtMoney(v: number) {
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: v >= 1000 ? 0 : 2,
  })
}

function formatDateInputValue(timestamp?: number) {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day, 12).getTime()
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes
  label: string
  value: string
}) {
  return (
    <div className="bg-white shadow-card rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 text-[#777]">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[18px] font-semibold text-[#171717] mt-3">{value}</p>
    </div>
  )
}

export function PalletDetailPage() {
  const { retailerId, palletId } = useParams()
  const navigate = useNavigate()
  const roleHref = useRoleHref()
  const smartBack = useSmartBack()
  const role = useRoleStore((state) => state.role)
  const isSalesman = role === 'salesman'
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [statusError, setStatusError] = useState<string | null>(null)
  const pallet = useDisplayStore((state) =>
    palletId ? state.getProject(palletId) : undefined
  )
  const currentProjectId = useDisplayStore((state) => state.currentProject?.id)
  const selectProject = useDisplayStore((state) => state.selectProject)
  const setPalletType = useDisplayStore((state) => state.setPalletType)
  const updateName = useDisplayStore((state) => state.updateName)
  const updateSeasonId = useDisplayStore((state) => state.updateSeasonId)
  const updateBuildLocation = useDisplayStore((state) => state.updateBuildLocation)
  const updateLaborCost = useDisplayStore((state) => state.updateLaborCost)
  const updateQuantity = useDisplayStore((state) => state.updateQuantity)
  const updateStatus = useDisplayStore((state) => state.updateStatus)
  const deleteProject = useDisplayStore((state) => state.deleteProject)
  const duplicateProject = useDisplayStore((state) => state.duplicateProject)
  const updateShipByDate = useDisplayStore((state) => state.updateShipByDate)
  const retailer = useRetailerStore((state) =>
    retailerId ? state.getRetailer(retailerId) : undefined
  )
  const seasons = useSeasonStore((state) => state.seasons)
  const createSeason = useSeasonStore((state) => state.createSeason)
  const products = useCatalogStore((state) => state.products)

  useEffect(() => {
    if (palletId && currentProjectId !== palletId) {
      selectProject(palletId)
    }
  }, [palletId, currentProjectId, selectProject])

  const isManager = role === 'manager'

  const financials = useMemo(() => {
    if (!pallet || !retailer) return null
    const qty = pallet.quantity ?? 1
    const priceByProduct = new Map<string, number>()
    for (const item of retailer.authorizedItems) {
      if (typeof item.casePrice === 'number') {
        priceByProduct.set(item.productId, item.casePrice)
      }
    }
    const costByProduct = new Map<string, number>()
    for (const product of products) {
      if (typeof product.caseCost === 'number') {
        costByProduct.set(product.id, product.caseCost)
      }
    }
    let revenue = 0
    let materialCost = 0
    let totalCases = 0
    let pricedCases = 0
    let costedCases = 0
    for (const entry of pallet.assortment) {
      if (entry.cases <= 0) continue
      const cases = entry.cases * qty
      totalCases += cases
      const price = priceByProduct.get(entry.productId)
      const cost = costByProduct.get(entry.productId)
      if (typeof price === 'number') {
        revenue += price * cases
        pricedCases += cases
      }
      if (typeof cost === 'number') {
        materialCost += cost * cases
        costedCases += cases
      }
    }
    const labor = typeof pallet.laborCost === 'number' ? pallet.laborCost * qty : 0
    const cost = materialCost + labor
    const marginDollars = revenue - cost
    const marginPct = revenue > 0 ? (marginDollars / revenue) * 100 : null
    return {
      revenue,
      cost,
      materialCost,
      labor,
      marginDollars,
      marginPct,
      avgPrice: pricedCases > 0 ? revenue / pricedCases : null,
      avgCost: costedCases > 0 ? materialCost / costedCases : null,
      totalCases,
    }
  }, [pallet, retailer, products])

  if (!pallet || !retailerId || !retailer) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Boxes className="w-10 h-10 text-[#ccc] mb-3" />
        <h3 className="text-[15px] font-semibold text-[#333]">Pallet not found</h3>
        <button
          onClick={() => navigate(roleHref('/retailers'))}
          className="mt-3 px-4 py-1.5 text-[13px] font-medium text-[#0a72ef] hover:bg-[#0a72ef]/5 rounded-md transition-colors"
        >
          Back to Retailers
        </button>
      </div>
    )
  }

  return (
    <div className="px-10 py-10 max-w-[1300px]">
      <button
        onClick={() => smartBack(roleHref(`/retailers/${retailerId}`))}
        className="flex items-center gap-1.5 text-[#777] hover:text-[#171717] text-[12px] font-medium mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#999]">Pallet</p>
          <input
            value={pallet.name}
            onChange={(e) => updateName(e.target.value)}
            className="text-[28px] font-semibold tracking-display text-[#171717] mt-1 bg-transparent border-none outline-none focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md px-1 -mx-1 w-full"
          />
          <div className="flex flex-wrap items-center gap-2 mt-3 text-[12px] text-[#666]">
            <StatusPill status={pallet.status} role={role} />
            {(() => {
              const season = pallet.seasonId
                ? seasons.find((s) => s.id === pallet.seasonId)
                : undefined
              if (!season?.holidayDate || pallet.status === 'built') return null
              return <DeadlineChip confirmByMs={computeConfirmByDate(season.holidayDate)} />
            })()}
            {pallet.seasonId && (
              <span className="px-2 py-1 rounded-md bg-[#f5f5f5] font-medium">
                {seasons.find((s) => s.id === pallet.seasonId)?.name ?? 'Season'}
              </span>
            )}
            <span className="px-2 py-1 rounded-md bg-[#f5f5f5] font-medium capitalize">
              {pallet.palletType} pallet
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              const newName = window.prompt(
                'Name for the duplicate pallet:',
                `${pallet.name} (copy)`,
              )
              if (!newName || !newName.trim()) return
              const seasonOptions = seasons.filter((s) => !s.archived)
              let nextSeasonId: string | null = pallet.seasonId
              if (seasonOptions.length > 0) {
                const list = seasonOptions
                  .map((s, i) => `${i + 1}. ${s.name}`)
                  .join('\n')
                const choice = window.prompt(
                  `Pick a season for the copy (or leave blank to keep "${
                    seasons.find((s) => s.id === pallet.seasonId)?.name ?? 'unassigned'
                  }"):\n\n${list}\n\nEnter a number or leave blank.`,
                )
                if (choice && choice.trim() !== '') {
                  const idx = parseInt(choice, 10) - 1
                  if (!isNaN(idx) && idx >= 0 && idx < seasonOptions.length) {
                    nextSeasonId = seasonOptions[idx].id
                  }
                }
              }
              const clone = duplicateProject(pallet.id, {
                name: newName.trim(),
                seasonId: nextSeasonId,
              })
              if (clone) {
                navigate(roleHref(`/retailers/${clone.retailerId}/pallets/${clone.id}`))
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-[#555] text-[13px] font-medium hover:bg-[#fafafa] transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Delete pallet "${pallet.name}"?`,
                description: 'This pallet and its assortment will be removed. This cannot be undone.',
                confirmLabel: 'Delete pallet',
                destructive: true,
              })
              if (!ok) return
              deleteProject(pallet.id)
              navigate(roleHref(`/retailers/${retailerId}`))
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-[#c0392b] text-[13px] font-medium hover:bg-[#c0392b]/5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <Link
            to={roleHref(`/retailers/${retailerId}/pallets/${pallet.id}/editor`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            Open Editor
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Stat icon={Store} label="Retailer" value={retailer.name} />
        <Stat icon={Package} label="Products" value={String(pallet.placements.length)} />
        <Stat
          icon={CalendarDays}
          label="Updated"
          value={new Date(pallet.updatedAt).toLocaleDateString('en-US')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white shadow-card rounded-xl p-6">
          <h3 className="text-[15px] font-semibold text-[#171717]">Pallet Summary</h3>
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="rounded-lg bg-[#fafafa] px-4 py-4 col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-[#999] mb-2">Status</p>
              {isSalesman ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[14px] font-semibold text-[#171717]">
                      {getStatusLabel(pallet.status, 'salesman')}
                    </p>
                    {pallet.status === 'in_build' && (
                      <p className="text-[11px] text-[#888] mt-1">
                        The builder has started — you can no longer pull this back.
                      </p>
                    )}
                  </div>
                  {pallet.status === 'draft' && (
                    <button
                      onClick={() => {
                        if (!pallet.shipByDate) {
                          setStatusError(
                            'Set a Ship By date before pushing this pallet to the builder.',
                          )
                          return
                        }
                        setStatusError(null)
                        updateStatus('ready')
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#171717] text-white text-[12px] font-medium hover:bg-[#333] transition-colors"
                    >
                      Approve &amp; push to build
                    </button>
                  )}
                  {pallet.status === 'ready' && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Pull this pallet back?',
                          description:
                            'It will return to In Progress and disappear from the builder’s queue until you push it again.',
                          confirmLabel: 'Pull back',
                        })
                        if (!ok) return
                        setStatusError(null)
                        updateStatus('draft')
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[#171717] shadow-border hover:bg-[#fafafa] transition-colors"
                    >
                      Pull back to In Progress
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={pallet.status}
                  onChange={(e) => {
                    const next = e.target.value as PalletStatus
                    if (next !== 'draft' && !pallet.shipByDate) {
                      setStatusError(
                        'Set a Ship By date before moving this pallet out of Draft.',
                      )
                      return
                    }
                    setStatusError(null)
                    updateStatus(next)
                  }}
                  className="w-full text-[14px] font-semibold text-[#171717] bg-transparent border-none outline-none cursor-pointer focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md -ml-1 pl-1"
                >
                  {(['draft', 'ready', 'in_build', 'built'] as PalletStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {role ? STATUS_LABELS_BY_ROLE[role][s] : s}
                    </option>
                  ))}
                </select>
              )}
              {statusError && (
                <p className="text-[11px] text-red-600 mt-2">{statusError}</p>
              )}
            </div>
            <div className="rounded-lg bg-[#fafafa] px-4 py-4">
              <p className="text-[10px] uppercase tracking-wider text-[#999] mb-2">Structure</p>
              <select
                value={pallet.palletType}
                onChange={(e) => setPalletType(e.target.value as 'full' | 'half')}
                className="w-full text-[14px] font-semibold text-[#171717] bg-transparent border-none outline-none cursor-pointer focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md capitalize -ml-1 pl-1"
              >
                <option value="full">Full Pallet</option>
                <option value="half">Half Pallet</option>
              </select>
            </div>
            <div className="rounded-lg bg-[#fafafa] px-4 py-4">
              <p className="text-[10px] uppercase tracking-wider text-[#999] mb-2">Season</p>
              <select
                value={pallet.seasonId ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (!isSalesman && value === '__new__') {
                    const name = window.prompt('Name for the new season:')
                    if (!name || !name.trim()) return
                    const created = createSeason(name)
                    updateSeasonId(created.id)
                    return
                  }
                  updateSeasonId(value === '' ? null : value)
                }}
                className="w-full text-[14px] font-semibold text-[#171717] bg-transparent border-none outline-none cursor-pointer focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md -ml-1 pl-1"
              >
                {!isSalesman && <option value="">Unassigned</option>}
                {seasons
                  .filter((season) => {
                    if (isSalesman) return !season.archived
                    return !season.archived || season.id === pallet.seasonId
                  })
                  .slice()
                  .sort(compareSeasonsByHolidayDate)
                  .map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                      {season.archived ? ' (archived)' : ''}
                    </option>
                  ))}
                {!isSalesman && <option value="__new__">+ Create new season…</option>}
              </select>
            </div>
            <div className="rounded-lg bg-[#fafafa] px-4 py-4 col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-[#999] mb-2">
                Pallets requested
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={pallet.quantity ?? 1}
                onChange={(event) => {
                  const val = event.target.value.replace(/\D/g, '')
                  const num = parseInt(val, 10)
                  updateQuantity(isNaN(num) ? 1 : num)
                }}
                className="w-full text-[14px] font-semibold text-[#171717] bg-transparent border-none outline-none focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md tabular-nums -ml-1 pl-1"
              />
              <p className="text-[11px] text-[#888] mt-1">
                How many identical pallets to build. Cases per item multiply by this for the total order.
              </p>
            </div>
            {!isSalesman && (
              <>
                <div className="rounded-lg bg-[#fafafa] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-wider text-[#999] mb-2">Build location</p>
                  <select
                    value={pallet.buildLocation ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      updateBuildLocation(value === '' ? null : (value as 'hook' | 'goshen' | 'third-party'))
                    }}
                    className="w-full text-[14px] font-semibold text-[#171717] bg-transparent border-none outline-none cursor-pointer focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md -ml-1 pl-1"
                  >
                    <option value="">Unassigned</option>
                    <option value="hook">Hook</option>
                    <option value="goshen">Goshen</option>
                    <option value="third-party">3rd Party Location</option>
                  </select>
                </div>
                <div className="rounded-lg bg-[#fafafa] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-wider text-[#999] mb-2">Labor cost</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[14px] font-semibold text-[#999]">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pallet.laborCost ?? ''}
                      onChange={(event) => {
                        const val = event.target.value.replace(/[^0-9.]/g, '')
                        if (val === '') {
                          updateLaborCost(null)
                          return
                        }
                        const num = parseFloat(val)
                        updateLaborCost(isNaN(num) ? null : num)
                      }}
                      placeholder="75"
                      className="flex-1 text-[14px] font-semibold text-[#171717] bg-transparent border-none outline-none focus:ring-2 focus:ring-[#0a72ef]/30 rounded-md -ml-1 pl-1"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 pt-6" style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.06)' }}>
            <h4 className="text-[13px] font-semibold text-[#171717]">Placed products</h4>
            {pallet.placements.length === 0 ? (
              <p className="text-[12px] text-[#888] mt-3">
                No products placed yet. Open the editor to start building the pallet.
              </p>
            ) : (
              <div className="grid gap-3 mt-4">
                {pallet.placements.map((placement) => {
                  const product = products.find((p) => p.id === placement.sourceProductId)
                  const upc = product?.upc
                  const kayco = product?.kaycoItemNumber
                  return (
                  <div
                    key={placement.id}
                    className="rounded-lg bg-[#fafafa] px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[#171717]">
                        {placement.label}
                      </p>
                      <p className="text-[11px] text-[#888] mt-1 font-mono">
                        {upc || kayco
                          ? [upc && `UPC ${upc}`, kayco && `Kayco #${kayco}`]
                              .filter(Boolean)
                              .join(' · ')
                          : '— no UPC / Kayco # set'}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-[#666]">
                      Slot {placement.slotId}
                    </span>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label className="text-[12px] font-medium text-[#555]">
          Ship By
          {pallet.status === 'draft' && (
            <span className="text-[11px] text-[#888] ml-1">
              (required before moving out of Draft)
            </span>
          )}
        </label>
        <input
          type="date"
          value={formatDateInputValue(pallet.shipByDate)}
          onChange={(event) => {
            const next = event.target.value
              ? parseDateInputValue(event.target.value)
              : undefined
            updateShipByDate(next)
            if (next && statusError) setStatusError(null)
          }}
          className="px-3 py-1.5 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none w-full sm:w-auto"
        />
      </div>

      {isManager && financials && (
        <div className="mt-6 bg-white shadow-card rounded-xl">
          <div className="px-5 py-4 border-b border-[#f0f0f0]">
            <h3 className="text-[15px] font-semibold text-[#171717]">Financials</h3>
            <p className="text-[11px] text-[#888] mt-1">
              Totals for this pallet × {pallet.quantity ?? 1} requested.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Revenue', value: fmtMoney(financials.revenue), tone: 'neutral' as const },
              { label: 'Cost', value: fmtMoney(financials.cost), tone: 'neutral' as const },
              {
                label: 'Margin',
                value: fmtMoney(financials.marginDollars),
                tone:
                  financials.marginDollars < 0 ? ('negative' as const) : ('neutral' as const),
              },
              {
                label: 'Margin %',
                value:
                  financials.marginPct === null
                    ? '—'
                    : `${financials.marginPct.toFixed(1)}%`,
                tone:
                  financials.marginPct === null
                    ? ('neutral' as const)
                    : financials.marginPct < 0
                      ? ('negative' as const)
                      : ('neutral' as const),
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="px-5 py-4"
                style={
                  i > 0 ? { boxShadow: '-1px 0 0 0 rgba(0,0,0,0.04)' } : undefined
                }
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#bbb]">
                  {stat.label}
                </p>
                <p
                  className={`text-[20px] font-semibold tabular-nums mt-1 ${
                    stat.tone === 'negative' ? 'text-red-600' : 'text-[#171717]'
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-2 lg:grid-cols-4"
            style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.04) inset' }}
          >
            {[
              {
                label: 'Avg case price',
                value: financials.avgPrice === null ? '—' : fmtMoney(financials.avgPrice),
              },
              {
                label: 'Avg case cost',
                value: financials.avgCost === null ? '—' : fmtMoney(financials.avgCost),
              },
              { label: 'Labor', value: fmtMoney(financials.labor) },
              { label: 'Cases', value: financials.totalCases.toLocaleString() },
            ].map((row, i) => (
              <div
                key={row.label}
                className="px-5 py-3 bg-[#fafafa]"
                style={
                  i > 0 ? { boxShadow: '-1px 0 0 0 rgba(0,0,0,0.04)' } : undefined
                }
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#bbb]">
                  {row.label}
                </p>
                <p className="text-[13px] font-semibold text-[#171717] tabular-nums mt-1">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <AssortmentTable project={pallet} retailer={retailer} />
      </div>

      <div className="mt-6">
        <CommentsThread palletId={pallet.id} />
      </div>
      {confirmDialog}
    </div>
  )
}
