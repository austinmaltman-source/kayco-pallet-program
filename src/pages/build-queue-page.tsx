import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  HardHat,
  Hammer,
  MapPin,
  Plus,
} from 'lucide-react'
import { useDisplayStore } from '../stores/display-store'
import { compareSeasonsByHolidayDate, useSeasonStore } from '../stores/season-store'
import { useCatalogStore } from '../stores/catalog-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useAppSettingsStore } from '../stores/app-settings-store'
import { useRoleHref } from '../lib/role-href'
import { useRoleStore } from '../stores/role-store'
import { StatusPill } from '../components/Status/status-pill'
import { DeadlineChip } from '../components/Deadline/deadline-chip'
import { computeConfirmByDate } from '../lib/deadline'
import { buildRollupData } from '../lib/program-rollup'
import { buildCsv, downloadCsv } from '../lib/csv'
import type { BuildLocation, DisplayProject } from '../types'

const COLUMNS: { key: BuildLocation | 'unassigned'; label: string }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'goshen', label: 'Goshen' },
  { key: 'third-party', label: '3rd Party' },
  { key: 'unassigned', label: 'Unassigned' },
]

function locationOf(pallet: DisplayProject): BuildLocation | 'unassigned' {
  return pallet.buildLocation ?? 'unassigned'
}

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function BuildQueuePage() {
  const projects = useDisplayStore((state) => state.projects)
  const setBuildLocationFor = useDisplayStore((state) => state.setBuildLocationFor)
  const appendBuildLog = useDisplayStore((state) => state.appendBuildLog)
  const seasons = useSeasonStore((state) => state.seasons)
  const products = useCatalogStore((state) => state.products)
  const retailers = useRetailerStore((state) => state.retailers)
  const settings = useAppSettingsStore((state) => state.settings)
  const updateSettings = useAppSettingsStore((state) => state.updateSettings)
  const roleHref = useRoleHref()
  const role = useRoleStore((state) => state.role)

  const [seasonId, setSeasonId] = useState<string>('')
  const [pullListLocation, setPullListLocation] = useState<BuildLocation | 'all'>('all')
  const [logEntry, setLogEntry] = useState<{
    palletId: string
    date: string
    built: string
    note: string
  } | null>(null)

  const retailerById = useMemo(
    () => new Map(retailers.map((r) => [r.id, r])),
    [retailers],
  )
  const seasonById = useMemo(
    () => new Map(seasons.map((s) => [s.id, s])),
    [seasons],
  )

  const filteredPallets = useMemo(() => {
    if (!seasonId) return []
    return projects.filter(
      (p) => p.seasonId === seasonId && p.status !== 'draft',
    )
  }, [projects, seasonId])

  const palletsByColumn = useMemo(() => {
    const groups: Record<BuildLocation | 'unassigned', DisplayProject[]> = {
      hook: [],
      goshen: [],
      'third-party': [],
      unassigned: [],
    }
    for (const pallet of filteredPallets) {
      groups[locationOf(pallet)].push(pallet)
    }
    return groups
  }, [filteredPallets])

  const pullListPallets = useMemo(() => {
    if (pullListLocation === 'all') return filteredPallets
    return filteredPallets.filter((p) => p.buildLocation === pullListLocation)
  }, [filteredPallets, pullListLocation])

  const pullListRows = useMemo(
    () => buildRollupData(pullListPallets, products),
    [pullListPallets, products],
  )

  const selectableSeasons = seasons
    .filter((s) => !s.archived)
    .slice()
    .sort(compareSeasonsByHolidayDate)

  const handleExportPullList = () => {
    const seasonLabel = seasons.find((s) => s.id === seasonId)?.name ?? 'Season'
    const locationLabel = pullListLocation === 'all' ? 'all' : pullListLocation
    const headers = ['Item #', 'Description', 'Brand', 'Buyer', 'Cases']
    const rows = pullListRows.map((row) => [
      row.kaycoItemNumber || '',
      row.productName,
      row.brand,
      row.buyer,
      row.totalCases,
    ])
    downloadCsv(
      `pull-list-${seasonLabel.replace(/\s+/g, '-').toLowerCase()}-${locationLabel}.csv`,
      buildCsv(headers, rows),
    )
  }

  const totalCases = pullListRows.reduce((sum, r) => sum + r.totalCases, 0)

  return (
    <div className="px-10 py-10 max-w-[1700px]">
      <div className="mb-8 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#999] flex items-center gap-1.5">
            <HardHat className="w-3 h-3" />
            Build queue
          </p>
          <h1 className="text-[28px] font-semibold tracking-display text-[#171717] mt-1">
            What to build, where, when
          </h1>
          <p className="text-[13px] text-[#666] mt-2">
            Pallets ready or in progress, grouped by location. Log daily build counts.
          </p>
        </div>
        <div className="bg-white shadow-card rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="text-[10px] uppercase tracking-wider text-[#999]">Default labor</span>
          {(['Full', 'Half'] as const).map((kind) => {
            const key = kind === 'Full' ? 'defaultLaborCostFull' : 'defaultLaborCostHalf'
            return (
              <div key={kind} className="flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[#999]">{kind}</span>
                <span className="text-[14px] text-[#999]">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={settings[key]}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^0-9.]/g, '')
                    const num = parseFloat(raw)
                    if (!isNaN(num)) updateSettings({ [key]: num })
                  }}
                  className="w-[64px] text-[14px] font-semibold text-[#171717] tabular-nums shadow-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
                />
              </div>
            )
          })}
          <span className="text-[10px] uppercase tracking-wider text-[#999] ml-2">Default corrugate</span>
          {(['Full', 'Half'] as const).map((kind) => {
            const key = kind === 'Full' ? 'defaultCorrugateCostFull' : 'defaultCorrugateCostHalf'
            return (
              <div key={`corr-${kind}`} className="flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[#999]">{kind}</span>
                <span className="text-[14px] text-[#999]">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={settings[key]}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^0-9.]/g, '')
                    const num = parseFloat(raw)
                    if (!isNaN(num)) updateSettings({ [key]: num })
                  }}
                  className="w-[64px] text-[14px] font-semibold text-[#171717] tabular-nums shadow-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white shadow-card rounded-xl p-5 mb-6">
        <p className="text-[11px] uppercase tracking-wider text-[#999] mb-2">Season</p>
        <select
          value={seasonId}
          onChange={(event) => setSeasonId(event.target.value)}
          className="w-full max-w-md text-[14px] font-semibold text-[#171717] px-3 py-2 shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
        >
          <option value="">Select a season…</option>
          {selectableSeasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {seasonId && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
          {/* Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COLUMNS.map((column) => {
              const items = palletsByColumn[column.key]
              return (
                <div
                  key={column.key}
                  className="bg-[#fafafa] rounded-xl p-3 min-h-[400px]"
                >
                  <div className="flex items-center justify-between px-1 mb-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-[#888]" />
                      <p className="text-[11px] font-semibold text-[#171717] uppercase tracking-wider">
                        {column.label}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#888] tabular-nums">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="text-center text-[11px] text-[#bbb] py-8">
                        No pallets
                      </div>
                    ) : (
                      items.map((pallet) => {
                        const retailer = retailerById.get(pallet.retailerId)
                        const season = pallet.seasonId
                          ? seasonById.get(pallet.seasonId)
                          : undefined
                        const cases = pallet.assortment.reduce((s, e) => s + e.cases, 0)
                        const log = pallet.buildLog ?? []
                        const totalBuilt = log.reduce((s, e) => s + e.built, 0)
                        const confirmBy = season?.holidayDate
                          ? computeConfirmByDate(season.holidayDate)
                          : null
                        return (
                          <div
                            key={pallet.id}
                            className="bg-white rounded-lg p-3 shadow-card"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Link
                                to={roleHref(`/retailers/${pallet.retailerId}/pallets/${pallet.id}`)}
                                className="text-[12px] font-semibold text-[#171717] hover:text-[#0a72ef] line-clamp-2 flex-1"
                              >
                                {pallet.name}
                              </Link>
                              <StatusPill status={pallet.status} size="sm" role={role} />
                            </div>
                            <p className="text-[10px] text-[#888]">
                              {retailer?.name ?? '—'} · {pallet.palletType} · {cases} cases
                            </p>
                            {confirmBy && pallet.status !== 'built' && (
                              <div className="mt-2">
                                <DeadlineChip confirmByMs={confirmBy} size="sm" />
                              </div>
                            )}
                            {totalBuilt > 0 && (
                              <p className="text-[10px] text-emerald-700 mt-2 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {totalBuilt} built across {log.length} entries
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <select
                                value={pallet.buildLocation ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setBuildLocationFor(
                                    pallet.id,
                                    value === '' ? null : (value as BuildLocation),
                                  )
                                }}
                                className="flex-1 text-[10px] font-medium text-[#555] shadow-border rounded px-2 py-1 bg-white focus:outline-none cursor-pointer"
                              >
                                <option value="">Unassigned</option>
                                <option value="hook">Hook</option>
                                <option value="goshen">Goshen</option>
                                <option value="third-party">3rd Party</option>
                              </select>
                              <button
                                onClick={() =>
                                  setLogEntry({
                                    palletId: pallet.id,
                                    date: todayStr(),
                                    built: '',
                                    note: '',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[#171717] text-white hover:bg-[#333] transition-colors"
                                title="Log built"
                              >
                                <Hammer className="w-3 h-3" />
                                Log
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pull list */}
          <div className="bg-white shadow-card rounded-xl">
            <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-[15px] font-semibold text-[#171717]">Pull list</h3>
                <p className="text-[11px] text-[#888] mt-1">
                  Cases per item to pull from inventory
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pullListLocation}
                  onChange={(event) => setPullListLocation(event.target.value as BuildLocation | 'all')}
                  className="text-[12px] font-medium shadow-border rounded-md px-2 py-1.5 bg-white focus:outline-none cursor-pointer"
                >
                  <option value="all">All locations</option>
                  <option value="hook">Hook</option>
                  <option value="goshen">Goshen</option>
                  <option value="third-party">3rd Party</option>
                </select>
                <button
                  onClick={handleExportPullList}
                  disabled={pullListRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-border text-[12px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>
            {pullListRows.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-[#888]">No pallets at this location yet.</p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#fafafa]">
                    <tr className="text-[#888] text-left">
                      <th className="py-2 px-4 font-medium uppercase tracking-wider text-[10px]">
                        Item #
                      </th>
                      <th className="py-2 px-4 font-medium uppercase tracking-wider text-[10px]">
                        Description
                      </th>
                      <th className="py-2 px-4 font-medium uppercase tracking-wider text-[10px] text-right">
                        Cases
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pullListRows.map((row) => (
                      <tr key={row.productId} className="border-t border-[#f0f0f0]">
                        <td className="py-2 px-4 font-mono text-[#666] tabular-nums whitespace-nowrap">
                          {row.kaycoItemNumber || '—'}
                        </td>
                        <td className="py-2 px-4 text-[#171717] truncate max-w-[200px]">
                          {row.productName}
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-[#171717] tabular-nums">
                          {row.totalCases}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#171717] bg-white">
                      <td colSpan={2} className="py-2 px-4 font-semibold text-[#171717]">
                        Total
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-[#171717] tabular-nums">
                        {totalCases}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log entry modal */}
      {logEntry && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-elevated w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold text-[#171717]">Log build progress</h3>
            <p className="text-[12px] text-[#888] mt-1">
              {projects.find((p) => p.id === logEntry.palletId)?.name}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#999] mb-1.5">Date</p>
                <input
                  type="date"
                  value={logEntry.date}
                  onChange={(event) => setLogEntry({ ...logEntry, date: event.target.value })}
                  className="w-full px-3 py-2 text-[13px] shadow-border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#999] mb-1.5">Pallets built</p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={logEntry.built}
                  onChange={(event) => {
                    const v = event.target.value.replace(/\D/g, '')
                    setLogEntry({ ...logEntry, built: v })
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 text-[13px] shadow-border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
                />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-[#999] mb-1.5">Note (optional)</p>
              <input
                type="text"
                value={logEntry.note}
                onChange={(event) => setLogEntry({ ...logEntry, note: event.target.value })}
                placeholder="e.g. Crew of 3, halfway done"
                className="w-full px-3 py-2 text-[13px] shadow-border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setLogEntry(null)}
                className="px-4 py-2 rounded-md text-[12px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const built = parseInt(logEntry.built, 10)
                  if (!built || built <= 0) return
                  appendBuildLog(logEntry.palletId, {
                    date: logEntry.date,
                    built,
                    note: logEntry.note.trim() || undefined,
                  })
                  setLogEntry(null)
                }}
                disabled={!logEntry.built || parseInt(logEntry.built, 10) <= 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-medium bg-[#171717] text-white hover:bg-[#333] transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
