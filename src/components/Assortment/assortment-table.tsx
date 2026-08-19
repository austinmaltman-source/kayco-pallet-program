import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Package, Plus } from 'lucide-react'
import { RequestItemModal } from './request-item-modal'
import { useCatalogStore } from '../../stores/catalog-store'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { useRoleStore } from '../../stores/role-store'
import { canRoleDo } from '../../lib/role-routes'
import {
  buildAssortmentRows,
  computeAssortmentTotals,
  getPalletQuantity,
} from '../../lib/assortment-utils'
import type { AuthorizedItem, DisplayProject, Retailer } from '../../types'

interface AssortmentTableProps {
  project: DisplayProject
  retailer: Retailer
}

export function AssortmentTable({ project, retailer }: AssortmentTableProps) {
  const [search, setSearch] = useState('')
  const products = useCatalogStore((state) => state.products)
  const updateAssortment = useDisplayStore((state) => state.updateAssortment)
  const populateFromAssortment = useDisplayStore((state) => state.populateFromAssortment)
  const updateAuthorizedItemCasePrice = useRetailerStore(
    (state) => state.updateAuthorizedItemCasePrice,
  )
  const addAuthorizedItem = useRetailerStore((state) => state.addAuthorizedItem)
  const role = useRoleStore((state) => state.role)
  const canAuthorize = canRoleDo(role, 'authorizeItems')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'authorized' | 'pending'>('authorized')

  // Auto-populate the pallet when the assortment changes - but ONLY while
  // the pallet has no layout yet. Repopulating over a hand-laid layout
  // silently destroyed the builder's work.
  const prevAssortmentRef = useRef(JSON.stringify(project.assortment))
  useEffect(() => {
    const current = JSON.stringify(project.assortment)
    if (current !== prevAssortmentRef.current) {
      prevAssortmentRef.current = current
      if ((project.placements?.length ?? 0) === 0) populateFromAssortment()
    }
  }, [project.assortment, project.placements, populateFromAssortment])

  const rows = useMemo(
    () => buildAssortmentRows(retailer, project, products),
    [products, project, retailer],
  )

  const authorizedCount = useMemo(
    () => rows.filter((row) => row.status === 'authorized').length,
    [rows],
  )
  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === 'pending').length,
    [rows],
  )

  const tabbedRows = useMemo(
    () => rows.filter((row) => row.status === activeTab),
    [rows, activeTab],
  )

  const filteredRows = useMemo(() => {
    if (!search) return tabbedRows

    const query = search.toLowerCase()
    return tabbedRows.filter(
      (row) =>
        row.productName.toLowerCase().includes(query) ||
        row.sku.toLowerCase().includes(query) ||
        (row.upc ?? '').toLowerCase().includes(query) ||
        (row.kaycoItemNumber ?? '').toLowerCase().includes(query),
    )
  }, [tabbedRows, search])

  const authorizedIds = useMemo(
    () => new Set(retailer.authorizedItems.map((item) => item.productId)),
    [retailer.authorizedItems],
  )

  const catalogMatches = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return products
      .filter((product) => !authorizedIds.has(product.id))
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          (product.upc ?? '').toLowerCase().includes(query) ||
          (product.kaycoItemNumber ?? '').toLowerCase().includes(query) ||
          (product.brand ?? '').toLowerCase().includes(query)
        )
      })
      .slice(0, 20)
  }, [products, authorizedIds, search])

  const handleAuthorizeFromCatalog = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const item: AuthorizedItem = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      brand: product.brand,
      status: canAuthorize ? 'authorized' : 'pending',
      authorizedDate: new Date().toISOString().slice(0, 10),
    }
    addAuthorizedItem(retailer.id, item)
  }

  const totals = useMemo(
    () => computeAssortmentTotals(project.assortment, products, retailer),
    [products, project.assortment, retailer],
  )
  const palletQuantity = getPalletQuantity(project)

  return (
    <div className="bg-white shadow-card rounded-xl overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#171717]">Assortment</h3>
          <p className="text-[12px] text-[#888] mt-1">
            {totals.totalSKUs} SKUs · {totals.totalCases} cases · {totals.totalUnits} units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, Kayco #, UPC, brand…"
            className="w-full sm:w-[260px] px-3 py-1.5 text-[12px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
          />
          <button
            onClick={() => setShowRequestModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-border text-[12px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Request item
          </button>
        </div>
      </div>
      {showRequestModal && (
        <RequestItemModal retailer={retailer} onClose={() => setShowRequestModal(false)} />
      )}

      <div className="px-6 -mb-px flex items-center gap-1">
        {([
          ['authorized', 'Authorized', authorizedCount],
          ['pending', 'Requested', pendingCount],
        ] as const).map(([key, label, count]) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-[#888] hover:text-[#171717]'
              }`}
            >
              {label}
              <span
                className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold tabular-nums ${
                  isActive ? 'bg-[#171717] text-white' : 'bg-[#f3f3f3] text-[#666]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-t border-[#f0f0f0]">
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-6 py-3">
                Product
              </th>
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                UPC
              </th>
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                Kayco #
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                Pack
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                Case Price
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                Cases
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                Revenue
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-4 py-3">
                Total Cases
              </th>
              <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-6 py-3">
                Total Units
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && catalogMatches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center">
                  <Package className="w-6 h-6 text-[#ccc] mx-auto mb-2" />
                  <p className="text-[12px] text-[#888]">
                    {search
                      ? 'No matches in the catalog. Try a different keyword, Kayco #, or UPC.'
                      : activeTab === 'pending'
                        ? 'No pending requests. Search above to request items from the catalog.'
                        : 'No authorized products yet. Search above or click Request item to add from the catalog.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                return (
                <tr
                  key={row.productId}
                  className="border-t border-[#f5f5f5] hover:bg-[#fafafa] transition-colors"
                >
                  <td className="px-6 py-3">
                    <p className="text-[13px] font-medium text-[#171717]">
                      {row.productName}
                    </p>
                    <p className="text-[11px] text-[#999]">{row.brand}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#666] font-mono">{row.upc || '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-[#666] font-mono">
                    {row.kaycoItemNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#666] text-right tabular-nums">
                    {row.unitsPerCase ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[12px] text-[#999]">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.casePrice ?? ''}
                        onChange={(event) => {
                          const val = event.target.value.replace(/[^0-9.]/g, '')
                          if (val === '') {
                            updateAuthorizedItemCasePrice(retailer.id, row.productId, null)
                            return
                          }
                          const num = parseFloat(val)
                          updateAuthorizedItemCasePrice(
                            retailer.id,
                            row.productId,
                            isNaN(num) ? null : num,
                          )
                        }}
                        placeholder="0.00"
                        className="w-[64px] h-7 px-2 text-[12px] text-right tabular-nums shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0">
                      <button
                        onClick={() => updateAssortment(row.productId, Math.max(0, row.cases - 1))}
                        className="flex items-center justify-center w-7 h-7 rounded-l-md border border-[#e5e5e5] bg-[#fafafa] hover:bg-[#f0f0f0] text-[#666] transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <CasesInput
                        cases={row.cases}
                        onCommit={(next) => updateAssortment(row.productId, next)}
                      />
                      <button
                        onClick={() => updateAssortment(row.productId, row.cases + 1)}
                        className="flex items-center justify-center w-7 h-7 rounded-r-md border border-[#e5e5e5] bg-[#fafafa] hover:bg-[#f0f0f0] text-[#666] transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-[#171717] text-right tabular-nums">
                    {row.totalRevenue !== null
                      ? `$${row.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-[#171717] text-right tabular-nums">
                    {row.cases > 0 ? row.cases * palletQuantity : '—'}
                  </td>
                  <td className="px-6 py-3 text-[13px] font-medium text-[#171717] text-right tabular-nums">
                    {row.totalUnits != null ? row.totalUnits * palletQuantity : '—'}
                  </td>
                </tr>
                )
              })
            )}

            {catalogMatches.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 pt-5 pb-2 text-[10px] uppercase tracking-wider text-[#999]"
                  >
                    From catalog · {canAuthorize ? 'click to authorize' : 'click to request'}
                  </td>
                </tr>
                {catalogMatches.map((product) => {
                  const brandLabel =
                    product.brandCode ??
                    (product.brand && product.brand !== 'other'
                      ? product.brand
                      : '')
                  return (
                  <tr
                    key={product.id}
                    className="border-t border-[#f5f5f5] hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="text-[13px] font-medium text-[#171717]">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-[#999]">
                        {brandLabel || product.buyer || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666] font-mono">
                      {product.upc || '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666] font-mono">
                      {product.kaycoItemNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666] text-right tabular-nums">
                      {product.unitsPerCase ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#bbb] text-right">—</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleAuthorizeFromCatalog(product.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium bg-[#171717] text-white hover:bg-[#333] transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        {canAuthorize ? 'Add' : 'Request'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#bbb] text-right">—</td>
                    <td className="px-4 py-3 text-[12px] text-[#bbb] text-right">—</td>
                    <td className="px-6 py-3 text-[12px] text-[#bbb] text-right">—</td>
                  </tr>
                  )
                })}
              </>
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#e5e5e5] bg-[#fafafa]">
                <td
                  className="px-6 py-3 text-[12px] font-semibold text-[#171717]"
                  colSpan={5}
                >
                  Per pallet
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                  {totals.totalCases}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                  {totals.totalRevenue > 0
                    ? `$${totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                  {totals.totalCases * palletQuantity}
                </td>
                <td className="px-6 py-3 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                  {totals.totalUnits * palletQuantity}
                </td>
              </tr>
              {palletQuantity > 1 && (
                <tr className="border-t border-[#e5e5e5] bg-[#171717] text-white">
                  <td className="px-6 py-3 text-[12px] font-semibold" colSpan={5}>
                    × {palletQuantity} pallets — order total
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-right tabular-nums">
                    {totals.totalCases * palletQuantity}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-right tabular-nums">
                    {totals.totalRevenue > 0
                      ? `$${(totals.totalRevenue * palletQuantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-right tabular-nums">
                    {totals.totalCases * palletQuantity}
                  </td>
                  <td className="px-6 py-3 text-[13px] font-semibold text-right tabular-nums">
                    {totals.totalUnits * palletQuantity}
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function casesToDraft(cases: number) {
  return cases > 0 ? String(cases) : ''
}

function CasesInput({
  cases,
  onCommit,
}: {
  cases: number
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState(() => casesToDraft(cases))

  // Re-sync the draft when the underlying value changes via something other
  // than the user typing in this field (e.g. the +/- buttons). Compare by
  // parsed value so intermediate strings like "0." don't get clobbered.
  useEffect(() => {
    const parsed = parseFloat(draft)
    const current = isNaN(parsed) ? 0 : parsed
    if (current !== cases) setDraft(casesToDraft(cases))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    let val = event.target.value.replace(/[^\d.]/g, '')
    const firstDot = val.indexOf('.')
    if (firstDot !== -1) {
      val =
        val.slice(0, firstDot + 1) +
        val.slice(firstDot + 1).replace(/\./g, '')
    }
    setDraft(val)
    const num = parseFloat(val)
    onCommit(isNaN(num) ? 0 : num)
  }

  function handleBlur() {
    setDraft(casesToDraft(cases))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0"
      className="w-[52px] h-7 px-1 text-[13px] text-center tabular-nums border-y border-[#e5e5e5] bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:border-transparent"
    />
  )
}
