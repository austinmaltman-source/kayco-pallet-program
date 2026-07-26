import { useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, ArrowRight, CheckCircle2, Trash2, Upload } from 'lucide-react'
import { useDisplayStore } from '../stores/display-store'
import { compareSeasonsByHolidayDate, useSeasonStore } from '../stores/season-store'
import { useCatalogStore } from '../stores/catalog-store'
import { useInventoryStore } from '../stores/inventory-store'
import { buildCsv, downloadCsv } from '../lib/csv'
import { remainingPalletsToBuild } from '../lib/build-progress'
import type { InventoryLocation } from '../types'

const LOCATION_LABEL: Record<InventoryLocation, string> = {
  hook: 'Hook',
  goshen: 'Goshen',
}

function parseCsv(text: string): { kaycoItemNumber: string; cases: number }[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const itemIdx = header.findIndex(
    (h) => h === 'item' || h === 'item #' || h === 'item_number' || h === 'kayco' || h === 'kayco #' || h === 'sku',
  )
  const casesIdx = header.findIndex(
    (h) => h === 'cases' || h === 'qty' || h === 'quantity' || h === 'on_hand' || h === 'onhand',
  )
  if (itemIdx === -1 || casesIdx === -1) {
    throw new Error('CSV must have a column for item number and a column for cases')
  }
  const result: { kaycoItemNumber: string; cases: number }[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    const item = cols[itemIdx]
    const cases = parseInt(cols[casesIdx], 10)
    if (item && !isNaN(cases)) {
      result.push({ kaycoItemNumber: item, cases })
    }
  }
  return result
}

export function TransfersPage() {
  const projects = useDisplayStore((state) => state.projects)
  const seasons = useSeasonStore((state) => state.seasons)
  const products = useCatalogStore((state) => state.products)
  const snapshots = useInventoryStore((state) => state.snapshots)
  const setSnapshot = useInventoryStore((state) => state.setSnapshot)
  const clearSnapshot = useInventoryStore((state) => state.clearSnapshot)

  const [seasonId, setSeasonId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<InventoryLocation, HTMLInputElement | null>>({
    hook: null,
    goshen: null,
  })

  const seasonPallets = useMemo(() => {
    if (!seasonId) return []
    return projects.filter(
      (p) => p.seasonId === seasonId && p.status !== 'draft',
    )
  }, [projects, seasonId])

  // Demand by location, keyed by Kayco item number. Cases on an assortment
  // entry are per-pallet, so multiply by the pallets still left to build:
  // requested quantity minus build-log progress (a half-built run only needs
  // inventory for the remaining pallets).
  const demandByLocation = useMemo(() => {
    const map: Record<InventoryLocation | 'third-party' | 'unassigned', Map<string, number>> = {
      hook: new Map(),
      goshen: new Map(),
      'third-party': new Map(),
      unassigned: new Map(),
    }
    const productById = new Map(products.map((p) => [p.id, p]))
    for (const pallet of seasonPallets) {
      const loc: keyof typeof map = pallet.buildLocation ?? 'unassigned'
      const remaining = remainingPalletsToBuild(pallet)
      if (remaining === 0) continue
      for (const entry of pallet.assortment) {
        if (entry.cases <= 0) continue
        const product = productById.get(entry.productId)
        const key = product?.kaycoItemNumber ?? entry.productId
        map[loc].set(key, (map[loc].get(key) ?? 0) + entry.cases * remaining)
      }
    }
    return map
  }, [seasonPallets, products])

  const inventoryByLocation = useMemo(() => {
    const out: Record<InventoryLocation, Map<string, number>> = {
      hook: new Map(),
      goshen: new Map(),
    }
    for (const loc of ['hook', 'goshen'] as InventoryLocation[]) {
      const snap = snapshots[loc]
      if (!snap) continue
      for (const line of snap.lines) {
        out[loc].set(line.kaycoItemNumber, line.cases)
      }
    }
    return out
  }, [snapshots])

  const productByKayco = useMemo(() => {
    const map = new Map<string, { name: string; brand: string }>()
    for (const product of products) {
      if (product.kaycoItemNumber) {
        map.set(product.kaycoItemNumber, {
          name: product.name,
          brand: product.brand,
        })
      }
    }
    // also fall back to product id for items without Kayco #
    for (const product of products) {
      if (!product.kaycoItemNumber) {
        map.set(product.id, { name: product.name, brand: product.brand })
      }
    }
    return map
  }, [products])

  // Build the full item universe across demand and inventory
  const itemKeys = useMemo(() => {
    const set = new Set<string>()
    for (const map of Object.values(demandByLocation)) {
      for (const key of map.keys()) set.add(key)
    }
    for (const map of Object.values(inventoryByLocation)) {
      for (const key of map.keys()) set.add(key)
    }
    return Array.from(set).sort()
  }, [demandByLocation, inventoryByLocation])

  // Compute transfer plan: for each item, demand at Hook + demand at Goshen vs inventory
  // - If a location has shortfall and the other has surplus, suggest transfer
  // - Anything left short = needs vendor order
  const plan = useMemo(() => {
    const rows = itemKeys.map((key) => {
      const product = productByKayco.get(key)
      const hookDemand = demandByLocation.hook.get(key) ?? 0
      const goshenDemand = demandByLocation.goshen.get(key) ?? 0
      const tpDemand = demandByLocation['third-party'].get(key) ?? 0
      const unDemand = demandByLocation.unassigned.get(key) ?? 0
      const hookOnHand = inventoryByLocation.hook.get(key) ?? 0
      const goshenOnHand = inventoryByLocation.goshen.get(key) ?? 0

      const hookGap = hookDemand - hookOnHand
      const goshenGap = goshenDemand - goshenOnHand

      let hookToGoshen = 0
      let goshenToHook = 0
      let vendorNeeded = 0

      if (hookGap > 0 && goshenGap < 0) {
        const goshenSurplus = -goshenGap
        goshenToHook = Math.min(hookGap, goshenSurplus)
      }
      if (goshenGap > 0 && hookGap < 0) {
        const hookSurplus = -hookGap
        hookToGoshen = Math.min(goshenGap, hookSurplus)
      }
      const remainingHookShort = Math.max(0, hookGap - goshenToHook)
      const remainingGoshenShort = Math.max(0, goshenGap - hookToGoshen)
      vendorNeeded = remainingHookShort + remainingGoshenShort + tpDemand

      const hasAnyDemand = hookDemand + goshenDemand + tpDemand + unDemand > 0
      const hasMovement = hookToGoshen + goshenToHook + vendorNeeded !== 0
      return {
        key,
        name: product?.name ?? key,
        brand: product?.brand ?? '',
        hookDemand,
        goshenDemand,
        tpDemand,
        unDemand,
        hookOnHand,
        goshenOnHand,
        hookToGoshen,
        goshenToHook,
        vendorNeeded,
        hasAnyDemand,
        hasMovement,
      }
    })
    return rows.filter((r) => r.hasAnyDemand || r.hasMovement)
  }, [itemKeys, demandByLocation, inventoryByLocation, productByKayco])

  const handleUpload = async (location: InventoryLocation, file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const lines = parseCsv(text)
      if (lines.length === 0) {
        setError(`No valid rows found in ${file.name}`)
        return
      }
      setSnapshot({ location, lines, uploadedAt: Date.now() })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleExportPlan = () => {
    const seasonLabel = seasons.find((s) => s.id === seasonId)?.name ?? 'Season'
    const headers = [
      'Item #',
      'Description',
      'Hook demand',
      'Hook on-hand',
      'Goshen demand',
      'Goshen on-hand',
      '3rd party demand',
      'Goshen → Hook',
      'Hook → Goshen',
      'Vendor needed',
    ]
    const rows = plan.map((row) => [
      row.key,
      row.name,
      row.hookDemand,
      row.hookOnHand,
      row.goshenDemand,
      row.goshenOnHand,
      row.tpDemand,
      row.goshenToHook,
      row.hookToGoshen,
      row.vendorNeeded,
    ])
    downloadCsv(
      `transfer-plan-${seasonLabel.replace(/\s+/g, '-').toLowerCase()}.csv`,
      buildCsv(headers, rows),
    )
  }

  const selectableSeasons = seasons
    .filter((s) => !s.archived)
    .slice()
    .sort(compareSeasonsByHolidayDate)

  return (
    <div className="px-10 py-10 max-w-[1500px]">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-wider text-[#999] flex items-center gap-1.5">
          <ArrowLeftRight className="w-3 h-3" />
          Transfers
        </p>
        <h1 className="text-[28px] font-semibold tracking-display text-[#171717] mt-1">
          Inventory & transfer plan
        </h1>
        <p className="text-[13px] text-[#666] mt-2">
          Upload current on-hand at Hook and Goshen. We'll match it against pallet build demand
          per location and recommend transfers.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Snapshot upload tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {(['hook', 'goshen'] as InventoryLocation[]).map((location) => {
          const snap = snapshots[location]
          return (
            <div key={location} className="bg-white shadow-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[15px] font-semibold text-[#171717]">
                  {LOCATION_LABEL[location]}
                </h3>
                {snap && (
                  <button
                    onClick={() => clearSnapshot(location)}
                    className="text-[11px] text-[#c0392b] hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {snap ? (
                <div>
                  <p className="text-[12px] text-[#666]">
                    {snap.lines.length} items · uploaded{' '}
                    {new Date(snap.uploadedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-[11px] text-[#888] mt-1">
                    Total cases:{' '}
                    {snap.lines.reduce((s, l) => s + l.cases, 0).toLocaleString()}
                  </p>
                  <button
                    onClick={() => fileRefs.current[location]?.click()}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md shadow-border text-[12px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Replace snapshot
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRefs.current[location]?.click()}
                  className="w-full text-[13px] text-[#0a72ef] inline-flex items-center justify-center gap-2 py-6 border border-dashed border-[#ddd] rounded-lg hover:border-[#0a72ef]/40 hover:bg-[#0a72ef]/5 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV (item, cases)
                </button>
              )}
              <input
                ref={(el) => {
                  fileRefs.current[location] = el
                }}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleUpload(location, file)
                  event.target.value = ''
                }}
              />
            </div>
          )
        })}
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
        <div className="bg-white shadow-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#171717]">Transfer plan</h3>
              <p className="text-[11px] text-[#888] mt-1">
                Computed from pallet build location and on-hand snapshots. Demand counts
                only pallets still left to build (requested quantity minus build-log progress).
              </p>
            </div>
            <button
              onClick={handleExportPlan}
              disabled={plan.length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md shadow-border text-[12px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>

          {plan.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] text-[#888]">
                No demand for this season yet, or no items in inventory.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[#888] text-left bg-[#fafafa]">
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wider text-[10px]">
                      Item #
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wider text-[10px]">
                      Description
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wider text-[10px] text-right">
                      Hook need / on-hand
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wider text-[10px] text-right">
                      Goshen need / on-hand
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wider text-[10px] text-right">
                      Recommended move
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wider text-[10px] text-right">
                      Vendor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((row) => {
                    const move =
                      row.goshenToHook > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#0a72ef] font-medium">
                          {row.goshenToHook} Goshen <ArrowRight className="w-3 h-3" /> Hook
                        </span>
                      ) : row.hookToGoshen > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#0a72ef] font-medium">
                          {row.hookToGoshen} Hook <ArrowRight className="w-3 h-3" /> Goshen
                        </span>
                      ) : (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> none
                        </span>
                      )
                    return (
                      <tr key={row.key} className="border-t border-[#f0f0f0]">
                        <td className="py-2 px-4 font-mono text-[#666] tabular-nums whitespace-nowrap">
                          {row.key}
                        </td>
                        <td className="py-2 px-4 text-[#171717] truncate max-w-[280px]">
                          {row.name}
                          {row.brand && (
                            <span className="ml-2 text-[10px] text-[#999] capitalize font-normal">
                              {row.brand}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums text-[#666]">
                          <span
                            className={
                              row.hookDemand > row.hookOnHand
                                ? 'font-semibold text-red-600'
                                : ''
                            }
                          >
                            {row.hookDemand}
                          </span>{' '}
                          / {row.hookOnHand}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums text-[#666]">
                          <span
                            className={
                              row.goshenDemand > row.goshenOnHand
                                ? 'font-semibold text-red-600'
                                : ''
                            }
                          >
                            {row.goshenDemand}
                          </span>{' '}
                          / {row.goshenOnHand}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">{move}</td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.vendorNeeded > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {row.vendorNeeded}
                            </span>
                          ) : (
                            <span className="text-[#bbb]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
