import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { casesToSleeves, formatCasesExact, sleevesToCases } from '../../lib/subunits'
import { formatQty } from '../../lib/number-format'
import { Minus, Plus, Search, X } from 'lucide-react'
import type { DisplayProject, Product, Retailer } from '../../types'
import { getUnitsPerCase } from '../../lib/assortment-utils'

interface ProgramMatrixProps {
  halfPallet: DisplayProject | null
  fullPallet: DisplayProject | null
  retailer: Retailer
  products: Product[]
  readOnly?: boolean
  onCellChange?: (palletId: string, productId: string, cases: number) => void
  onQuantityChange?: (palletId: string, quantity: number) => void
  onGoToItems?: () => void
}

interface MatrixRow {
  productId: string
  productName: string
  upc: string
  kaycoItemNumber: string
  brand: string
  unitsPerCase: number | null
  sleevesPerCase: number | null
  onHalf: boolean
  onFull: boolean
  halfCases: number
  fullCases: number
}

function casesToDraft(cases: number) {
  // Display-only: trim float artifacts (1 sleeve of 12 = 0.0833... -> 0.08).
  return cases > 0 ? String(Math.round(cases * 100) / 100) : ''
}

function getSelectedSet(pallet: DisplayProject | null): Set<string> {
  if (!pallet) return new Set()
  if (pallet.selectedProductIds) return new Set(pallet.selectedProductIds)
  return new Set(pallet.assortment.map((entry) => entry.productId))
}

function CellInput({
  cases,
  onCommit,
  disabled,
  tone,
  sleevesPerCase,
}: {
  cases: number
  onCommit: (value: number) => void
  disabled?: boolean
  tone: 'half' | 'full'
  // When set, the input works in WHOLE SLEEVES (stored as fractional cases).
  sleevesPerCase?: number | null
}) {
  const sleeveMode = typeof sleevesPerCase === 'number' && sleevesPerCase > 1
  const toDraft = (value: number) =>
    sleeveMode
      ? value > 0
        ? String(casesToSleeves(value, sleevesPerCase))
        : ''
      : casesToDraft(value)
  const [draft, setDraft] = useState(() => toDraft(cases))

  useEffect(() => {
    const parsed = parseFloat(draft)
    const current = isNaN(parsed)
      ? 0
      : sleeveMode
        ? sleevesToCases(parsed, sleevesPerCase)
        : parsed
    if (current !== cases) setDraft(toDraft(cases))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (sleeveMode) {
      const val = event.target.value.replace(/\D/g, '')
      setDraft(val)
      const sleeves = parseInt(val, 10)
      onCommit(isNaN(sleeves) ? 0 : sleevesToCases(sleeves, sleevesPerCase))
      return
    }
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
    setDraft(toDraft(cases))
  }

  const filled = cases > 0
  const wrapperRing =
    tone === 'half'
      ? filled
        ? 'ring-emerald-300 bg-emerald-50/60'
        : 'ring-[#e8e8e8] bg-white'
      : filled
        ? 'ring-blue-300 bg-blue-50/60'
        : 'ring-[#e8e8e8] bg-white'
  const stepperColor =
    tone === 'half'
      ? 'text-emerald-700 hover:bg-emerald-100/70'
      : 'text-blue-700 hover:bg-blue-100/70'

  function step(delta: number) {
    if (sleeveMode) {
      const sleeves = Math.max(0, casesToSleeves(cases, sleevesPerCase) + delta)
      onCommit(sleevesToCases(sleeves, sleevesPerCase))
      return
    }
    onCommit(Math.max(0, cases + delta))
  }

  return (
    <div
      className={`inline-flex items-stretch h-9 rounded-lg ring-1 transition focus-within:ring-2 focus-within:ring-[#0a72ef]/40 ${wrapperRing}`}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || cases <= 0}
        aria-label="Decrease"
        className={`w-7 flex items-center justify-center rounded-l-lg ${stepperColor} disabled:text-[#ddd] disabled:hover:bg-transparent`}
      >
        <Minus className="w-3 h-3" strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="0"
        className="w-[44px] bg-transparent text-[13px] font-medium text-center tabular-nums focus:outline-none disabled:text-[#bbb] placeholder:text-[#ccc]"
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled}
        aria-label="Increase"
        className={`w-7 flex items-center justify-center rounded-r-lg ${stepperColor} disabled:text-[#ddd] disabled:hover:bg-transparent`}
      >
        <Plus className="w-3 h-3" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function UnitToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: 'case' | 'sleeve'
  onChange: (mode: 'case' | 'sleeve') => void
  disabled?: boolean
}) {
  const base = 'px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors'
  return (
    <span className="inline-flex rounded-md ring-1 ring-[#e0e0e0] overflow-hidden select-none">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('case')}
        title="Enter quantities in whole cases"
        className={`${base} ${mode === 'case' ? 'bg-[#171717] text-white' : 'bg-white text-[#999] hover:text-[#555]'}`}
      >
        cs
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('sleeve')}
        title="Enter quantities in sleeves / inner packs"
        className={`${base} ${mode === 'sleeve' ? 'bg-[#171717] text-white' : 'bg-white text-[#999] hover:text-[#555]'}`}
      >
        slv
      </button>
    </span>
  )
}

function QuantityInput({
  value,
  onCommit,
  disabled,
}: {
  value: number
  onCommit: (next: number) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(() => String(value))

  useEffect(() => {
    const parsed = parseInt(draft, 10)
    if ((isNaN(parsed) ? 0 : parsed) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const val = e.target.value.replace(/\D/g, '')
        setDraft(val)
        const num = parseInt(val, 10)
        if (!isNaN(num) && num >= 0) onCommit(num)
      }}
      onBlur={() => setDraft(String(value))}
      disabled={disabled}
      className="w-[52px] h-7 px-2 text-[12px] font-semibold text-center tabular-nums rounded-md bg-white ring-1 ring-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/40 disabled:bg-[#fafafa] disabled:text-[#999]"
    />
  )
}

export function ProgramMatrix({
  halfPallet,
  fullPallet,
  retailer,
  products,
  readOnly,
  onCellChange,
  onQuantityChange,
  onGoToItems,
}: ProgramMatrixProps) {
  const [search, setSearch] = useState('')
  // Per-row entry unit for sleeve/inner-pack items. Defaults from the data:
  // a row already holding fractional cases was entered in sleeves.
  const [unitModes, setUnitModes] = useState<Record<string, 'case' | 'sleeve'>>({})
  const rowUnitMode = (
    productId: string,
    halfCases: number,
    fullCases: number,
  ): 'case' | 'sleeve' =>
    unitModes[productId] ??
    (!Number.isInteger(halfCases) || !Number.isInteger(fullCases)
      ? 'sleeve'
      : 'case')

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const halfSelected = useMemo(() => getSelectedSet(halfPallet), [halfPallet])
  const fullSelected = useMemo(() => getSelectedSet(fullPallet), [fullPallet])

  const allRowIds = useMemo(() => {
    const ids = new Set<string>()
    halfSelected.forEach((id) => ids.add(id))
    fullSelected.forEach((id) => ids.add(id))
    return ids
  }, [halfSelected, fullSelected])

  const rows: MatrixRow[] = useMemo(() => {
    return Array.from(allRowIds)
      .map<MatrixRow>((id) => {
        const product = productMap.get(id)
        const halfCases =
          halfPallet?.assortment.find((entry) => entry.productId === id)?.cases ?? 0
        const fullCases =
          fullPallet?.assortment.find((entry) => entry.productId === id)?.cases ?? 0
        return {
          productId: id,
          productName: product?.name ?? id,
          upc: product?.upc ?? '',
          kaycoItemNumber: product?.kaycoItemNumber ?? '',
          brand: product?.brandCode || product?.brand || '',
          unitsPerCase: product ? getUnitsPerCase(product) : null,
          sleevesPerCase: product?.sleevesPerCase ?? null,
          onHalf: halfSelected.has(id),
          onFull: fullSelected.has(id),
          halfCases,
          fullCases,
        }
      })
      .sort(
        (left, right) =>
          left.brand.localeCompare(right.brand) ||
          left.productName.localeCompare(right.productName),
      )
  }, [allRowIds, halfPallet, fullPallet, productMap, halfSelected, fullSelected])

  const halfQty = halfPallet?.quantity ?? 1
  const fullQty = fullPallet?.quantity ?? 1

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(
      (row) =>
        row.productName.toLowerCase().includes(query) ||
        row.kaycoItemNumber.toLowerCase().includes(query) ||
        row.upc.toLowerCase().includes(query) ||
        row.brand.toLowerCase().includes(query),
    )
  }, [rows, search])

  const totals = useMemo(() => {
    let halfCases = 0
    let fullCases = 0
    let totalCases = 0
    let totalUnits = 0
    for (const row of rows) {
      const h = row.halfCases * halfQty
      const f = row.fullCases * fullQty
      halfCases += h
      fullCases += f
      totalCases += h + f
      if (row.unitsPerCase) totalUnits += (h + f) * row.unitsPerCase
    }
    return { halfCases, fullCases, totalCases, totalUnits }
  }, [rows, halfQty, fullQty])

  const canBulkDecrement = useMemo(
    () => rows.some((row) => row.halfCases > 0 || row.fullCases > 0),
    [rows],
  )
  const canBulkIncrement = useMemo(
    () =>
      rows.some(
        (row) =>
          (row.onHalf && row.halfCases === 0) ||
          (row.onFull && row.fullCases === 0),
      ),
    [rows],
  )

  function bulkAdjust(delta: number) {
    for (const row of rows) {
      if (row.onHalf && halfPallet) {
        // + only fills empty cells; − decrements existing cases.
        const shouldTouch = delta > 0 ? row.halfCases === 0 : row.halfCases > 0
        if (shouldTouch) {
          const next = Math.max(0, row.halfCases + delta)
          if (next !== row.halfCases) {
            onCellChange?.(halfPallet.id, row.productId, next)
          }
        }
      }
      if (row.onFull && fullPallet) {
        const shouldTouch = delta > 0 ? row.fullCases === 0 : row.fullCases > 0
        if (shouldTouch) {
          const next = Math.max(0, row.fullCases + delta)
          if (next !== row.fullCases) {
            onCellChange?.(fullPallet.id, row.productId, next)
          }
        }
      }
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white shadow-card rounded-xl py-16 px-8 text-center">
        <p className="text-[15px] font-semibold text-[#171717]">
          No items picked yet
        </p>
        <p className="text-[12px] text-[#888] mt-2 max-w-md mx-auto">
          Choose which items go on this program in the Items tab, then come
          back here to enter case counts.
        </p>
        {onGoToItems && (
          <button
            onClick={onGoToItems}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors"
          >
            Pick items
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-[480px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} picked items…`}
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
        <div className="ml-auto flex items-center gap-4 text-[11px] text-[#888]">
          {!readOnly && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[11px] text-[#888]">Adjust all</span>
              <button
                type="button"
                onClick={() => bulkAdjust(-1)}
                disabled={!canBulkDecrement}
                aria-label="Subtract 1 case from every item"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md ring-1 ring-[#e5e5e5] text-[#555] hover:bg-[#fafafa] hover:text-[#171717] disabled:text-[#ddd] disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-3 h-3" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => bulkAdjust(1)}
                disabled={!canBulkIncrement}
                aria-label="Set 1 case on every empty item"
                title="Set 1 case on every item that has no cases yet"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md ring-1 ring-[#e5e5e5] text-[#555] hover:bg-[#fafafa] hover:text-[#171717] disabled:text-[#ddd] disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </span>
          )}
          {halfPallet && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Half × <QuantityInput
                value={halfQty}
                disabled={readOnly}
                onCommit={(next) => onQuantityChange?.(halfPallet.id, next)}
              />
            </span>
          )}
          {fullPallet && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Full × <QuantityInput
                value={fullQty}
                disabled={readOnly}
                onCommit={(next) => onQuantityChange?.(fullPallet.id, next)}
              />
            </span>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white shadow-card rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="bg-white">
                <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-6 py-3 sticky left-0 bg-white z-10 border-b border-[#f0f0f0]">
                  Product
                </th>
                <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-3 py-3 border-b border-[#f0f0f0]">
                  Kayco #
                </th>
                <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-3 py-3 border-b border-[#f0f0f0]">
                  Pack
                </th>
                {halfPallet && (
                  <th className="text-right text-[10px] font-medium uppercase tracking-wider text-emerald-700 px-3 py-3 border-b border-[#f0f0f0]">
                    Half cases
                  </th>
                )}
                {fullPallet && (
                  <th className="text-right text-[10px] font-medium uppercase tracking-wider text-blue-700 px-3 py-3 border-b border-[#f0f0f0]">
                    Full cases
                  </th>
                )}
                <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-3 py-3 border-b border-[#f0f0f0]">
                  Cases
                </th>
                <th className="text-right text-[10px] font-medium uppercase tracking-wider text-[#bbb] px-6 py-3 border-b border-[#f0f0f0]">
                  Units
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + (halfPallet ? 1 : 0) + (fullPallet ? 1 : 0)}
                    className="px-6 py-10 text-center text-[12px] text-[#888]"
                  >
                    No items match your search.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const orderCases =
                    (row.onHalf ? row.halfCases * halfQty : 0) +
                    (row.onFull ? row.fullCases * fullQty : 0)
                  const orderUnits = row.unitsPerCase
                    ? orderCases * row.unitsPerCase
                    : null
                  return (
                    <tr
                      key={row.productId}
                      className="hover:bg-[#fafafa] transition-colors"
                      style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.04)' }}
                    >
                      <td className="px-6 py-2 sticky left-0 bg-white z-10">
                        <p className="text-[13px] font-medium text-[#171717]">
                          {row.productName}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[#888] font-mono">
                        {row.kaycoItemNumber || '—'}
                      </td>
                      <td
                        className="px-3 py-2 text-[11px] text-[#888] text-right tabular-nums whitespace-nowrap"
                        title={
                          row.sleevesPerCase
                            ? `${row.sleevesPerCase} sleeves / inner packs per case`
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {row.unitsPerCase ?? '—'}
                          {row.sleevesPerCase ? (
                            <UnitToggle
                              disabled={readOnly}
                              mode={rowUnitMode(row.productId, row.halfCases, row.fullCases)}
                              onChange={(mode) =>
                                setUnitModes((prev) => ({ ...prev, [row.productId]: mode }))
                              }
                            />
                          ) : null}
                        </span>
                      </td>
                      {halfPallet && (
                        <td className="px-3 py-2 text-right">
                          {row.onHalf ? (
                            <CellInput
                              key={rowUnitMode(row.productId, row.halfCases, row.fullCases)}
                              tone="half"
                              sleevesPerCase={
                                rowUnitMode(row.productId, row.halfCases, row.fullCases) === 'sleeve'
                                  ? row.sleevesPerCase
                                  : undefined
                              }
                              cases={row.halfCases}
                              disabled={readOnly}
                              onCommit={(value) =>
                                onCellChange?.(halfPallet.id, row.productId, value)
                              }
                            />
                          ) : (
                            <span className="text-[#ddd]">—</span>
                          )}
                        </td>
                      )}
                      {fullPallet && (
                        <td className="px-3 py-2 text-right">
                          {row.onFull ? (
                            <CellInput
                              key={rowUnitMode(row.productId, row.halfCases, row.fullCases)}
                              tone="full"
                              sleevesPerCase={
                                rowUnitMode(row.productId, row.halfCases, row.fullCases) === 'sleeve'
                                  ? row.sleevesPerCase
                                  : undefined
                              }
                              cases={row.fullCases}
                              disabled={readOnly}
                              onCommit={(value) =>
                                onCellChange?.(fullPallet.id, row.productId, value)
                              }
                            />
                          ) : (
                            <span className="text-[#ddd]">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                        {orderCases ? (row.sleevesPerCase ? formatCasesExact(orderCases) : formatQty(orderCases)) : '—'}
                      </td>
                      <td className="px-6 py-2 text-[13px] font-medium text-[#171717] text-right tabular-nums">
                        {orderUnits != null ? (row.sleevesPerCase ? formatCasesExact(orderUnits) : formatQty(orderUnits)) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[#fafafa]" style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.06)' }}>
                <td
                  className="px-6 py-3 text-[12px] font-semibold text-[#171717] sticky left-0 bg-[#fafafa] z-10"
                  colSpan={3}
                >
                  Totals
                </td>
                {halfPallet && (
                  <td className="px-3 py-3 text-[13px] font-semibold text-emerald-800 text-right tabular-nums">
                    {totals.halfCases ? formatQty(totals.halfCases) : '—'}
                  </td>
                )}
                {fullPallet && (
                  <td className="px-3 py-3 text-[13px] font-semibold text-blue-800 text-right tabular-nums">
                    {totals.fullCases ? formatQty(totals.fullCases) : '—'}
                  </td>
                )}
                <td className="px-3 py-3 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                  {totals.totalCases ? formatQty(totals.totalCases) : '—'}
                </td>
                <td className="px-6 py-3 text-[13px] font-semibold text-[#171717] text-right tabular-nums">
                  {totals.totalUnits ? formatQty(totals.totalUnits) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
