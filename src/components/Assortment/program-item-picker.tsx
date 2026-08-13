import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, Search, X } from 'lucide-react'
import type { DisplayProject, Product, Retailer } from '../../types'
import { useRetailerItemSales } from '../../hooks/useRetailerItemSales'
import {
  formatSalesCases,
  formatSalesDate,
  formatSalesDollars,
  normalizeKaycoItemNumber,
  type ItemCustomerSales,
} from '../../lib/kayco-sales'
import { KaycoAccountsModal } from '../Retailers/kayco-accounts-panel'
import { useWindowedItemSales } from '../../hooks/useWindowedItemSales'
import { windowLabel, type SalesWindow } from '../../lib/sales-window'

type SortColumn =
  | 'name'
  | 'brand'
  | 'upc'
  | 'kayco'
  | 'retailer'
  | 'pack'
  | 'cases'
  | 'netSales'
  | 'lastOrder'

interface SortState {
  column: SortColumn
  dir: 'asc' | 'desc'
}

// Numeric-ish columns read highest-first on the first click; text columns A-Z.
const DEFAULT_DIR: Record<SortColumn, 'asc' | 'desc'> = {
  name: 'asc',
  brand: 'asc',
  upc: 'asc',
  kayco: 'asc',
  retailer: 'asc',
  pack: 'desc',
  cases: 'desc',
  netSales: 'desc',
  lastOrder: 'desc',
}

interface ProgramItemPickerProps {
  halfPallet: DisplayProject | null
  fullPallet: DisplayProject | null
  retailer: Retailer
  products: Product[]
  readOnly?: boolean
  onToggle: (palletId: string, productId: string, selected: boolean) => void
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = 'left',
  wide,
  title,
}: {
  label: string
  column: SortColumn
  sort: SortState | null
  onSort: (column: SortColumn) => void
  align?: 'left' | 'right'
  wide?: boolean
  title?: string
}) {
  const active = sort?.column === column
  const Arrow = active && sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      aria-sort={
        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
      }
      className="p-0 bg-white border-b border-[#f0f0f0]"
    >
      <button
        onClick={() => onSort(column)}
        title={title ?? `Sort by ${label.toLowerCase()}`}
        className={`w-full flex items-center gap-1 ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${wide ? 'px-6' : 'px-3'} py-3 text-[10px] font-medium uppercase tracking-wider transition-colors ${
          active ? 'text-[#171717]' : 'text-[#999] hover:text-[#555]'
        }`}
      >
        {align === 'right' && active && <Arrow className="w-3 h-3 shrink-0" />}
        <span className="whitespace-nowrap">{label}</span>
        {align === 'left' && active && <Arrow className="w-3 h-3 shrink-0" />}
      </button>
    </th>
  )
}

function getSelectedSet(pallet: DisplayProject | null): Set<string> {
  if (!pallet) return new Set()
  if (pallet.selectedProductIds) return new Set(pallet.selectedProductIds)
  return new Set(pallet.assortment.map((entry) => entry.productId))
}

export function ProgramItemPicker({
  halfPallet,
  fullPallet,
  retailer,
  products,
  readOnly,
  onToggle,
}: ProgramItemPickerProps) {
  const [search, setSearch] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [sort, setSort] = useState<SortState | null>(null)
  const [accountsModalOpen, setAccountsModalOpen] = useState(false)
  const [salesWindow, setSalesWindow] = useState<SalesWindow>({ kind: 'all' })

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev?.column === column
        ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { column, dir: DEFAULT_DIR[column] },
    )
  }

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  )

  const halfSelected = useMemo(() => getSelectedSet(halfPallet), [halfPallet])
  const fullSelected = useMemo(() => getSelectedSet(fullPallet), [fullPallet])

  const authorizedMap = useMemo(
    () => new Map(retailer.authorizedItems.map((item) => [item.productId, item])),
    [retailer.authorizedItems],
  )

  const rows = useMemo(() => {
    const ids = new Set<string>()
    for (const item of retailer.authorizedItems) {
      if (item.status === 'authorized') ids.add(item.productId)
    }
    halfSelected.forEach((id) => ids.add(id))
    fullSelected.forEach((id) => ids.add(id))

    return Array.from(ids)
      .map((id) => {
        const product = productMap.get(id)
        const auth = authorizedMap.get(id)
        return {
          id,
          name: product?.name ?? id,
          upc: product?.upc ?? '',
          kaycoItemNumber: product?.kaycoItemNumber ?? '',
          retailerItemNumber: auth?.sku ?? '',
          unitsPerCase: product?.unitsPerCase ?? null,
          brand: product?.brandCode || product?.brand || '',
        }
      })
      .sort(
        (a, b) =>
          a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
      )
  }, [retailer.authorizedItems, productMap, authorizedMap, halfSelected, fullSelected])

  // Customer-scoped sales: one summary per item, restricted to the Kayco
  // accounts linked to this retailer.
  const linkedAccountIds = useMemo(
    () => (retailer.kaycoAccounts ?? []).map((account) => account.id),
    [retailer.kaycoAccounts],
  )
  const accountPatterns = useMemo(
    () => retailer.kaycoAccountPatterns ?? [],
    [retailer.kaycoAccountPatterns],
  )
  const linkCount = linkedAccountIds.length + accountPatterns.length
  const salesEnabled = linkCount > 0
  const itemNumbers = useMemo(
    () => rows.map((row) => row.kaycoItemNumber).filter(Boolean),
    [rows],
  )
  const {
    sales,
    loading: salesLoading,
    error: salesError,
  } = useRetailerItemSales(linkedAccountIds, accountPatterns, itemNumbers)

  // Windowed (rolling 12 / YTD / custom) figures come from the synced monthly
  // history; "All time" uses the live per-item totals above. Last order stays
  // all-time either way.
  const { windowed, windowReady, windowLoading } = useWindowedItemSales(
    linkedAccountIds,
    accountPatterns,
    salesEnabled ? salesWindow : { kind: 'all' },
  )
  const windowActive = salesWindow.kind !== 'all' && windowReady
  // Effective figures for display + sorting.
  const figuresFor = (kaycoItemNumber: string) => {
    const key = normalizeKaycoItemNumber(kaycoItemNumber)
    if (!key) return undefined
    if (windowActive) {
      const w = windowed?.get(key)
      return { cases: w?.cases ?? 0, netSales: w?.netSales ?? 0 }
    }
    const s = sales.get(key)
    return s ? { cases: s.cases, netSales: s.netSales } : undefined
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const onHalf = halfSelected.has(row.id)
      const onFull = fullSelected.has(row.id)
      if (selectedOnly && !onHalf && !onFull) return false
      if (!query) return true
      return (
        row.name.toLowerCase().includes(query) ||
        row.kaycoItemNumber.toLowerCase().includes(query) ||
        row.retailerItemNumber.toLowerCase().includes(query) ||
        row.upc.toLowerCase().includes(query) ||
        row.brand.toLowerCase().includes(query)
      )
    })
  }, [rows, search, selectedOnly, halfSelected, fullSelected])

  const visibleRows = useMemo(() => {
    if (!sort) return filteredRows
    const salesFor = (row: { kaycoItemNumber: string }): ItemCustomerSales | undefined =>
      sales.get(normalizeKaycoItemNumber(row.kaycoItemNumber))
    type Row = (typeof filteredRows)[number]
    // Missing values sort last regardless of direction.
    const MISSING = Symbol('missing')
    const valueFor = (row: Row): string | number | typeof MISSING => {
      switch (sort.column) {
        case 'name':
          return row.name.toLowerCase()
        case 'brand':
          return row.brand.toLowerCase() || MISSING
        case 'upc':
          return row.upc || MISSING
        case 'kayco':
          return row.kaycoItemNumber || MISSING
        case 'retailer':
          return row.retailerItemNumber || MISSING
        case 'pack':
          return row.unitsPerCase ?? MISSING
        case 'cases':
          return figuresFor(row.kaycoItemNumber)?.cases ?? MISSING
        case 'netSales':
          return figuresFor(row.kaycoItemNumber)?.netSales ?? MISSING
        case 'lastOrder':
          return salesFor(row)?.lastOrder ?? MISSING
      }
    }
    const flip = sort.dir === 'asc' ? 1 : -1
    return [...filteredRows].sort((a, b) => {
      const av = valueFor(a)
      const bv = valueFor(b)
      if (av === MISSING && bv === MISSING) return 0
      if (av === MISSING) return 1
      if (bv === MISSING) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * flip
      return String(av).localeCompare(String(bv)) * flip
    })
    // figuresFor is stable per render inputs below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, sort, sales, windowed, windowActive])

  const halfCount = halfSelected.size
  const fullCount = fullSelected.size

  return (
    <div className="space-y-3">
      {/* Filter bar: labeled Search + Range (walmart-dashboard style). */}
      <div className="bg-white shadow-card rounded-xl px-5 py-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex-1 min-w-[260px] max-w-[520px]">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#999] mb-1.5">
            Search
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${rows.length} items - name, Kayco #, UPC, brand…`}
              className="w-full pl-9 pr-9 h-9 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none placeholder:text-[#aaa]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#666]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {salesEnabled && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#999] mb-1.5">
              Range
            </p>
            <div className="flex items-center gap-1.5">
              <select
                value={salesWindow.kind}
                onChange={(e) => {
                  const kind = e.target.value as SalesWindow['kind']
                  if (kind === 'custom') {
                    const now = new Date()
                    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                    setSalesWindow({ kind: 'custom', from: `${now.getFullYear()}-01`, to: current })
                  } else {
                    setSalesWindow({ kind } as SalesWindow)
                  }
                }}
                title="Period for the Cases sold / Net sales columns"
                className="h-9 px-2 text-[13px] text-[#171717] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30"
              >
                <option value="all">All time</option>
                <option value="r12">Rolling 12 months</option>
                <option value="ytd">Year to date</option>
                <option value="custom">Custom…</option>
              </select>
              {salesWindow.kind === 'custom' && (
                <>
                  <input
                    type="month"
                    value={salesWindow.from}
                    onChange={(e) =>
                      setSalesWindow({ ...salesWindow, from: e.target.value })
                    }
                    className="h-9 px-1.5 text-[12px] shadow-border rounded-md bg-white text-[#555]"
                  />
                  <span className="text-[11px] text-[#999]">to</span>
                  <input
                    type="month"
                    value={salesWindow.to}
                    onChange={(e) =>
                      setSalesWindow({ ...salesWindow, to: e.target.value })
                    }
                    className="h-9 px-1.5 text-[12px] shadow-border rounded-md bg-white text-[#555]"
                  />
                </>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 h-9">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-[#555] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(e) => setSelectedOnly(e.target.checked)}
              className="accent-[#171717]"
            />
            Selected only
          </label>
          <button
            onClick={() => setAccountsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-[#555] shadow-border hover:bg-[#fafafa] transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Sales accounts
            {salesEnabled && (
              <span className="text-[#999] tabular-nums">({linkCount})</span>
            )}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3 h-9 text-[11px] text-[#666] tabular-nums">
          {halfPallet && (
            <span>
              Half: <span className="font-semibold text-emerald-700">{halfCount}</span>
            </span>
          )}
          {fullPallet && (
            <span>
              Full: <span className="font-semibold text-blue-700">{fullCount}</span>
            </span>
          )}
        </div>
      </div>

      {salesEnabled && salesWindow.kind !== 'all' && !windowReady && (
        <p className="text-[12px] text-amber-700">
          Sales history hasn't finished syncing yet - showing all-time figures.
        </p>
      )}

      {!salesEnabled && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#f5f7fa] text-[12px] text-[#555]">
          <BarChart3 className="w-3.5 h-3.5 text-[#999] shrink-0" />
          <span>
            Link {retailer.name} to its Kayco sales account(s) to see what this
            customer already buys.
          </span>
          <button
            onClick={() => setAccountsModalOpen(true)}
            className="ml-auto shrink-0 text-[12px] font-medium text-[#0a72ef] hover:underline"
          >
            Link accounts
          </button>
        </div>
      )}
      {salesError && (
        <p className="text-[12px] text-amber-700">{salesError}</p>
      )}

      <div className="bg-white shadow-card rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <SortHeader label="Product" column="name" sort={sort} onSort={toggleSort} wide />
                <SortHeader label="Brand" column="brand" sort={sort} onSort={toggleSort} />
                <SortHeader label="UPC" column="upc" sort={sort} onSort={toggleSort} />
                <SortHeader label="Kayco #" column="kayco" sort={sort} onSort={toggleSort} />
                <SortHeader label="Retailer #" column="retailer" sort={sort} onSort={toggleSort} />
                <SortHeader label="Pack" column="pack" sort={sort} onSort={toggleSort} align="right" />
                {salesEnabled && (
                  <>
                    <SortHeader
                      label="Cases sold"
                      column="cases"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      title={`Cases shipped to ${retailer.name}'s linked Kayco accounts - click to sort`}
                    />
                    <SortHeader
                      label="Net sales"
                      column="netSales"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      title={`Net sales to ${retailer.name}'s linked Kayco accounts - click to sort`}
                    />
                    <SortHeader
                      label="Last order"
                      column="lastOrder"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                    />
                  </>
                )}
                {halfPallet && (
                  <th className="text-center text-[10px] font-medium uppercase tracking-wider text-emerald-700 px-3 py-3 bg-white border-b border-[#f0f0f0] w-[90px]">
                    Half
                  </th>
                )}
                {fullPallet && (
                  <th className="text-center text-[10px] font-medium uppercase tracking-wider text-blue-700 px-3 py-3 bg-white border-b border-[#f0f0f0] w-[90px]">
                    Full
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      6 +
                      (salesEnabled ? 3 : 0) +
                      (halfPallet ? 1 : 0) +
                      (fullPallet ? 1 : 0)
                    }
                    className="px-6 py-12 text-center text-[12px] text-[#888]"
                  >
                    {rows.length === 0
                      ? `No authorized items for ${retailer.name} yet.`
                      : 'No items match your search.'}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const onHalf = halfSelected.has(row.id)
                  const onFull = fullSelected.has(row.id)
                  const itemSales = salesEnabled
                    ? sales.get(normalizeKaycoItemNumber(row.kaycoItemNumber))
                    : undefined
                  const salesPending =
                    salesEnabled &&
                    !itemSales &&
                    salesLoading &&
                    Boolean(row.kaycoItemNumber)
                  const figures = salesEnabled
                    ? figuresFor(row.kaycoItemNumber)
                    : undefined
                  const figuresPending = windowActive
                    ? windowLoading
                    : salesPending
                  const bothOn =
                    (!halfPallet || onHalf) && (!fullPallet || onFull)
                  const rowSelected = onHalf || onFull
                  const toggleBoth = () => {
                    if (readOnly) return
                    // Clicking the row fills in both pallets unless they're
                    // already both selected, in which case it clears them.
                    const target = !bothOn
                    if (halfPallet && onHalf !== target) {
                      onToggle(halfPallet.id, row.id, target)
                    }
                    if (fullPallet && onFull !== target) {
                      onToggle(fullPallet.id, row.id, target)
                    }
                  }
                  return (
                    <tr
                      key={row.id}
                      onClick={toggleBoth}
                      className={`group transition-colors ${
                        readOnly ? '' : 'cursor-pointer'
                      } ${rowSelected ? 'bg-[#fafafa]' : 'hover:bg-[#fafafa]'}`}
                      style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.04)' }}
                    >
                      <td className="px-6 py-2.5">
                        <p className="text-[13px] text-[#171717]">{row.name}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#777] capitalize">
                        {row.brand || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#888] font-mono">
                        {row.upc || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#888] font-mono">
                        {row.kaycoItemNumber || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#888] font-mono">
                        {row.retailerItemNumber || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#888] text-right tabular-nums">
                        {row.unitsPerCase ?? '—'}
                      </td>
                      {salesEnabled && (
                        <>
                          <td className="px-3 py-2.5 text-[11px] text-[#171717] text-right tabular-nums font-medium">
                            {figuresPending ? (
                              <span className="text-[#ccc]">…</span>
                            ) : (
                              formatSalesCases(figures?.cases ?? 0)
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#666] text-right tabular-nums">
                            {figuresPending ? (
                              <span className="text-[#ccc]">…</span>
                            ) : (
                              formatSalesDollars(figures?.netSales ?? 0)
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#888] text-right tabular-nums whitespace-nowrap">
                            {salesPending ? (
                              <span className="text-[#ccc]">…</span>
                            ) : (
                              formatSalesDate(itemSales?.lastOrder ?? null)
                            )}
                          </td>
                        </>
                      )}
                      {halfPallet && (
                        <td
                          className="px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PickerCheck
                            checked={onHalf}
                            tone="half"
                            disabled={readOnly}
                            onChange={(next) => onToggle(halfPallet.id, row.id, next)}
                          />
                        </td>
                      )}
                      {fullPallet && (
                        <td
                          className="px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PickerCheck
                            checked={onFull}
                            tone="full"
                            disabled={readOnly}
                            onChange={(next) => onToggle(fullPallet.id, row.id, next)}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <KaycoAccountsModal
        retailer={retailer}
        open={accountsModalOpen}
        onClose={() => setAccountsModalOpen(false)}
      />
    </div>
  )
}

function PickerCheck({
  checked,
  tone,
  disabled,
  onChange,
}: {
  checked: boolean
  tone: 'half' | 'full'
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  const accent = tone === 'half' ? 'accent-emerald-600' : 'accent-blue-600'
  return (
    <label className="inline-flex items-center justify-center cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-4 h-4 ${accent}`}
      />
    </label>
  )
}
