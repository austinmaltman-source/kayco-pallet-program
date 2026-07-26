import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Box, Download, LayoutGrid, MoreHorizontal, Plus, Upload } from 'lucide-react'
import { ProgramMatrix } from '../components/Assortment/program-matrix'
import { ProgramItemPicker } from '../components/Assortment/program-item-picker'
import { useCatalogStore } from '../stores/catalog-store'
import { useDisplayStore } from '../stores/display-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useSeasonStore } from '../stores/season-store'
import { useRoleHref } from '../lib/role-href'
import { useSmartBack } from '../lib/use-smart-back'
import { useRoleStore } from '../stores/role-store'
import { useConfirm } from '../components/ConfirmDialog'
import { parseCsv } from '../lib/csv'
import {
  buildProgramTemplateWorkbook,
  downloadXlsx,
} from '../lib/program-template-xlsx'
import * as XLSX from 'xlsx'
import type { DisplayProject, Holiday, PalletType } from '../types'

type ProgramTab = 'quantities' | 'items' | 'build'
type BuildPalletTab = 'half' | 'full'

function getSelectedIds(pallet: DisplayProject | null): string[] {
  if (!pallet) return []
  if (pallet.selectedProductIds) return pallet.selectedProductIds
  return pallet.assortment.map((entry) => entry.productId)
}

// Accept several common date shapes from CSV / xlsx (m/d/yy, m/d/yyyy,
// yyyy-mm-dd, or an Excel serial number). Returns epoch ms or null.
function parseDateLoose(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Excel serial date (days since 1899-12-30)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (serial > 59 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30)
      return excelEpoch + serial * 24 * 60 * 60 * 1000
    }
  }
  const native = Date.parse(trimmed)
  if (Number.isFinite(native)) return native
  // m/d/yy or m/d/yyyy
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slash) {
    let [, m, d, y] = slash
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
    return Date.UTC(year, parseInt(m, 10) - 1, parseInt(d, 10))
  }
  return null
}


const HOLIDAY_LABELS: Record<Holiday, string> = {
  'rosh-hashanah': 'Rosh Hashanah',
  pesach: 'Pesach',
  sukkos: 'Sukkos',
  none: 'Everyday',
}

export function ProgramRollupPage() {
  const { retailerId, season: seasonParam } = useParams()
  const navigate = useNavigate()
  const roleHref = useRoleHref()
  const smartBack = useSmartBack()
  const role = useRoleStore((state) => state.role)
  const retailer = useRetailerStore((state) =>
    retailerId ? state.getRetailer(retailerId) : undefined,
  )
  const allProjects = useDisplayStore((state) => state.projects)
  const pallets = useMemo(
    () =>
      retailerId
        ? allProjects
            .filter((project) => project.retailerId === retailerId)
            .sort((a, b) => b.updatedAt - a.updatedAt)
        : [],
    [allProjects, retailerId],
  )
  const products = useCatalogStore((state) => state.products)
  const seasons = useSeasonStore((state) => state.seasons)
  const updateAssortmentForProject = useDisplayStore(
    (state) => state.updateAssortmentForProject,
  )
  const updateQuantityForProject = useDisplayStore(
    (state) => state.updateQuantityForProject,
  )
  const setSelectedProductIdsForProject = useDisplayStore(
    (state) => state.setSelectedProductIdsForProject,
  )
  const mergeProgramAssortment = useDisplayStore(
    (state) => state.mergeProgramAssortment,
  )
  const updateHolidayDate = useSeasonStore((state) => state.updateHolidayDate)
  const createProject = useDisplayStore((state) => state.createProject)
  const deleteProject = useDisplayStore((state) => state.deleteProject)
  const { confirm, dialog } = useConfirm()
  const [menuOpen, setMenuOpen] = useState(false)
  const [tab, setTab] = useState<ProgramTab>('quantities')
  const [buildPalletTab, setBuildPalletTab] = useState<BuildPalletTab>('half')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const seasonRecord = useMemo(
    () => seasons.find((s) => s.id === seasonParam) ?? null,
    [seasons, seasonParam],
  )

  const seasonPallets = useMemo(() => {
    if (!seasonParam) return []
    if (seasonRecord) {
      return pallets.filter((pallet) => pallet.seasonId === seasonRecord.id)
    }
    return pallets.filter((pallet) => pallet.season === seasonParam)
  }, [pallets, seasonParam, seasonRecord])

  const halfPallet = useMemo(
    () => seasonPallets.find((p) => p.palletType === 'half') ?? null,
    [seasonPallets],
  )
  const fullPallet = useMemo(
    () => seasonPallets.find((p) => p.palletType === 'full') ?? null,
    [seasonPallets],
  )

  const seasonLabel =
    seasonRecord?.name ??
    (seasonParam && seasonParam in HOLIDAY_LABELS
      ? HOLIDAY_LABELS[seasonParam as Holiday]
      : seasonParam ?? 'Program')

  const referencePallet = seasonPallets[0]
  const seasonHoliday: Holiday = (referencePallet?.season ??
    (seasonParam && seasonParam in HOLIDAY_LABELS
      ? (seasonParam as Holiday)
      : 'none')) as Holiday
  const seasonIdForNew: string | null =
    seasonRecord?.id ?? referencePallet?.seasonId ?? null

  const handleAddPallet = (type: PalletType) => {
    const newProject = createProject(
      `${seasonLabel} ${type === 'full' ? 'Full' : 'Half'} — ${retailer.name}`,
      {
        palletType: type,
        season: seasonHoliday,
        retailerId,
        seasonId: seasonIdForNew,
      },
      retailer.defaultTierCount ?? 4,
    )
    // Mirror the picks from the other pallet so the new pallet's case inputs
    // are immediately editable on the Quantities tab.
    const otherPallet = type === 'half' ? fullPallet : halfPallet
    const otherIds = getSelectedIds(otherPallet)
    if (otherIds.length > 0) {
      setSelectedProductIdsForProject(newProject.id, otherIds)
    }
    setMenuOpen(false)
  }

  const handleRemovePallet = async (type: PalletType) => {
    const pallet = type === 'half' ? halfPallet : fullPallet
    if (!pallet) return
    setMenuOpen(false)
    const ok = await confirm({
      title: `Remove the ${type} pallet from this program?`,
      description:
        'The pallet and its assortment are removed. The other pallet stays as-is.',
      confirmLabel: 'Remove pallet',
      destructive: true,
    })
    if (!ok) return
    deleteProject(pallet.id)
  }

  const halfSelectedCount = useMemo(
    () => getSelectedIds(halfPallet).length,
    [halfPallet],
  )
  const fullSelectedCount = useMemo(
    () => getSelectedIds(fullPallet).length,
    [fullPallet],
  )
  const hasAnySelection = halfSelectedCount + fullSelectedCount > 0

  // Land on Quantities if the program already has picks, Items if it's empty.
  useEffect(() => {
    if (seasonPallets.length === 0) return
    setTab(hasAnySelection ? 'quantities' : 'items')
    // Only react when we first land or pallets toggle existence — not on every
    // pick (we don't want to yank the user back to Items after they enter cases).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonPallets.length === 0, halfPallet?.id, fullPallet?.id])

  // Guard AFTER every hook: the retailer store hydrates a tick after first
  // render on a hard page load, and an early return above any hook crashes
  // React with a hook-order error the moment the data arrives.
  if (!retailer || !retailerId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[13px] text-[#888]">Retailer not found</p>
      </div>
    )
  }

  const handleToggleSelected = (
    palletId: string,
    productId: string,
    selected: boolean,
  ) => {
    const pallet =
      halfPallet?.id === palletId
        ? halfPallet
        : fullPallet?.id === palletId
          ? fullPallet
          : null
    if (!pallet) return

    const current = getSelectedIds(pallet)
    if (selected && current.includes(productId)) return
    if (!selected && !current.includes(productId)) return

    const next = selected
      ? [...current, productId]
      : current.filter((id) => id !== productId)
    setSelectedProductIdsForProject(palletId, next)
  }

  const handleQuantityChange = async (palletId: string, quantity: number) => {
    if (quantity >= 1) {
      updateQuantityForProject(palletId, quantity)
      return
    }
    // quantity === 0: offer to remove the pallet from the program entirely.
    const pallet =
      halfPallet?.id === palletId
        ? halfPallet
        : fullPallet?.id === palletId
          ? fullPallet
          : null
    if (!pallet) return
    const typeLabel = pallet.palletType === 'half' ? 'half' : 'full'
    const hasCases = pallet.assortment.some((entry) => entry.cases > 0)
    const ok = await confirm({
      title: `Remove the ${typeLabel} pallet from this program?`,
      description: hasCases
        ? `The ${typeLabel} pallet and all of its case entries will be cleared. The other pallet stays as-is.`
        : `The ${typeLabel} pallet will be removed from this program. The other pallet stays as-is.`,
      confirmLabel: 'Remove pallet',
      destructive: true,
    })
    if (!ok) return
    deleteProject(pallet.id)
  }

  const handleDownloadTemplate = async () => {
    setMenuOpen(false)
    const halfIds = getSelectedIds(halfPallet)
    const fullIds = getSelectedIds(fullPallet)
    const pickedProductIds = Array.from(new Set([...halfIds, ...fullIds]))

    const blob = await buildProgramTemplateWorkbook({
      retailer,
      seasonLabel,
      seasonRecord,
      halfPallet,
      fullPallet,
      products,
      pickedProductIds,
    })

    const safeName = `${retailer.name}-${seasonLabel}`
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    downloadXlsx(`${safeName}-template.xlsx`, blob)
  }

  const handleUploadClick = () => {
    setMenuOpen(false)
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    let rows: string[][]
    const isXlsx = /\.xlsx$/i.test(file.name)
    try {
      if (isXlsx) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: true,
          blankrows: false,
        })
        rows = sheetRows.map((row) =>
          (row as unknown[]).map((cell) =>
            cell === null || cell === undefined ? '' : String(cell),
          ),
        )
      } else {
        const text = await file.text()
        rows = parseCsv(text)
      }
    } catch {
      setImportError('Could not read file.')
      return
    }
    if (rows.length < 2) {
      setImportError('CSV is empty or missing a header row.')
      return
    }

    // The column header row may not be row 0 — there's a metadata block above
    // it. Find the row that has "Kayco" plus a case column.
    let headerRowIdx = -1
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].map((c) => c.trim().toLowerCase())
      const hasKayco = cells.some((c) => c.includes('kayco'))
      const hasCases = cells.some(
        (c) => c.includes('half pallet') || c.includes('full pallet'),
      )
      if (hasKayco && hasCases) {
        headerRowIdx = i
        break
      }
    }
    if (headerRowIdx === -1) {
      setImportError(
        'Could not find column headers. CSV should include "Kayco Item#" and "Half Pallet Cases" / "Full Pallet Cases".',
      )
      return
    }

    const header = rows[headerRowIdx].map((h) => h.trim().toLowerCase())
    const kaycoCol = header.findIndex((h) => h.includes('kayco'))
    const halfCol = header.findIndex((h) => h.includes('half pallet'))
    const fullCol = header.findIndex((h) => h.includes('full pallet'))
    if (kaycoCol === -1) {
      setImportError('CSV must include a "Kayco Item#" column.')
      return
    }
    if (halfPallet && halfCol === -1) {
      setImportError('CSV must include a "Half Pallet Cases" column.')
      return
    }
    if (fullPallet && fullCol === -1) {
      setImportError('CSV must include a "Full Pallet Cases" column.')
      return
    }

    // ─── Read metadata block (Total Pallets row + Due date) ───
    // Look for a row containing "Total Pallets" (case-insensitive). The cells
    // to the right hold: B half qty, C full qty, D due date.
    const metaRowIdx = rows.findIndex((row) =>
      row.some((cell) => cell.trim().toLowerCase() === 'total pallets'),
    )
    if (metaRowIdx >= 0 && metaRowIdx < headerRowIdx) {
      const metaRow = rows[metaRowIdx]
      const parseNum = (raw: string) => {
        const n = parseInt(raw.trim(), 10)
        return Number.isFinite(n) && n >= 1 ? n : null
      }
      if (halfPallet) {
        const next = parseNum(metaRow[1] ?? '')
        if (next !== null && next !== (halfPallet.quantity ?? 1)) {
          updateQuantityForProject(halfPallet.id, next)
        }
      }
      if (fullPallet) {
        const next = parseNum(metaRow[2] ?? '')
        if (next !== null && next !== (fullPallet.quantity ?? 1)) {
          updateQuantityForProject(fullPallet.id, next)
        }
      }
      const dueRaw = (metaRow[3] ?? '').trim()
      if (dueRaw && seasonRecord) {
        const parsed = parseDateLoose(dueRaw)
        if (parsed !== null && parsed !== seasonRecord.holidayDate) {
          updateHolidayDate(seasonRecord.id, parsed)
        }
      }
    }

    const byKayco = new Map<string, typeof products[number]>()
    for (const p of products) {
      if (p.kaycoItemNumber) byKayco.set(String(p.kaycoItemNumber).trim(), p)
    }

    const halfPlan: { productId: string; cases: number }[] = []
    const fullPlan: { productId: string; cases: number }[] = []
    const unmatched: string[] = []
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      const kayco = (row[kaycoCol] ?? '').trim()
      if (!kayco) continue
      const product = byKayco.get(kayco)
      if (!product) {
        unmatched.push(kayco)
        continue
      }
      const halfCases =
        halfPallet && halfCol !== -1
          ? Math.max(0, parseFloat(row[halfCol] ?? '') || 0)
          : 0
      const fullCases =
        fullPallet && fullCol !== -1
          ? Math.max(0, parseFloat(row[fullCol] ?? '') || 0)
          : 0
      if (halfPallet) halfPlan.push({ productId: product.id, cases: halfCases })
      if (fullPallet) fullPlan.push({ productId: product.id, cases: fullCases })
    }

    // Merge semantics: only act on rows that actually have cases. Blank or 0
    // case fields are skipped so existing entries aren't wiped.
    const halfMerge = halfPlan.filter((e) => e.cases > 0)
    const fullMerge = fullPlan.filter((e) => e.cases > 0)

    if (halfMerge.length === 0 && fullMerge.length === 0) {
      setImportError(
        unmatched.length > 0
          ? `No Kayco numbers in the file matched the catalog. Examples: ${unmatched.slice(0, 3).join(', ')}.`
          : 'CSV had no rows with cases to import.',
      )
      return
    }

    const plan: { projectId: string; entries: { productId: string; cases: number }[] }[] = []
    if (halfPallet) plan.push({ projectId: halfPallet.id, entries: halfMerge })
    if (fullPallet) plan.push({ projectId: fullPallet.id, entries: fullMerge })
    mergeProgramAssortment(plan)
    setImportError(
      unmatched.length > 0
        ? `Imported ${halfMerge.length + fullMerge.length} rows. ${unmatched.length} unmatched Kayco numbers were skipped.`
        : null,
    )
    setTab('quantities')
  }

  const isReadOnly = role === 'builder'

  return (
    <div className="px-8 py-6 max-w-[1500px] mx-auto">
      {/* Compact header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => smartBack(roleHref(`/retailers/${retailerId}`))}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] font-medium text-[#777] hover:text-[#171717] hover:bg-[#fafafa] transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <span className="text-[#ddd]">/</span>
          <h1 className="text-[18px] font-semibold tracking-tight text-[#171717] truncate">
            {seasonLabel}
          </h1>
        </div>

        {!isReadOnly && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[#555] shadow-border hover:bg-[#fafafa] transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              Program actions
            </button>
            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 w-[220px] bg-white shadow-elevated rounded-md py-1 z-40">
                  {!halfPallet && (
                    <MenuItem onClick={() => handleAddPallet('half')}>
                      <Plus className="w-3.5 h-3.5" />
                      Add half pallet
                    </MenuItem>
                  )}
                  {!fullPallet && (
                    <MenuItem onClick={() => handleAddPallet('full')}>
                      <Plus className="w-3.5 h-3.5" />
                      Add full pallet
                    </MenuItem>
                  )}
                  {/* Salesmen build the pallets, so they get the detail +
                      3D editor path too - same as every other role. */}
                  {halfPallet && (
                    <MenuItem
                      onClick={() =>
                        navigate(
                          roleHref(
                            `/retailers/${retailerId}/pallets/${halfPallet.id}`,
                          ),
                        )
                      }
                    >
                      Open half pallet detail
                    </MenuItem>
                  )}
                  {fullPallet && (
                    <MenuItem
                      onClick={() =>
                        navigate(
                          roleHref(
                            `/retailers/${retailerId}/pallets/${fullPallet.id}`,
                          ),
                        )
                      }
                    >
                      Open full pallet detail
                    </MenuItem>
                  )}
                  {(halfPallet || fullPallet) && <Divider />}
                  {(halfPallet || fullPallet) && (
                    <>
                      <MenuItem onClick={handleDownloadTemplate}>
                        <Download className="w-3.5 h-3.5" />
                        Download template
                      </MenuItem>
                      <MenuItem onClick={handleUploadClick}>
                        <Upload className="w-3.5 h-3.5" />
                        Upload file
                      </MenuItem>
                      <Divider />
                    </>
                  )}
                  {halfPallet && (
                    <MenuItem
                      destructive
                      onClick={() => handleRemovePallet('half')}
                    >
                      Remove half pallet
                    </MenuItem>
                  )}
                  {fullPallet && (
                    <MenuItem
                      destructive
                      onClick={() => handleRemovePallet('full')}
                    >
                      Remove full pallet
                    </MenuItem>
                  )}
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      {importError && (
        <div className="mb-4 px-3 py-2 rounded-md bg-red-50 text-[12px] text-red-700 flex items-start justify-between gap-3">
          <span>{importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="text-red-600 hover:text-red-800 font-medium text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {seasonPallets.length === 0 ? (
        <div className="bg-white shadow-card rounded-xl py-16 px-8 text-center">
          <p className="text-[15px] font-semibold text-[#171717]">
            No pallets yet
          </p>
          <p className="text-[12px] text-[#888] mt-2 max-w-md mx-auto">
            Choose which pallet types to include in this program.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => handleAddPallet('half')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add half pallet
            </button>
            <button
              onClick={() => handleAddPallet('full')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add full pallet
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-4 p-1 bg-[#f2f2f2] rounded-lg w-fit">
            <TabButton
              active={tab === 'quantities'}
              onClick={() => setTab('quantities')}
              label="Quantities"
              disabled={!hasAnySelection}
            />
            <TabButton
              active={tab === 'items'}
              onClick={() => setTab('items')}
              label="Items"
              count={
                halfPallet && fullPallet
                  ? Math.max(halfSelectedCount, fullSelectedCount)
                  : halfSelectedCount + fullSelectedCount
              }
            />
            <TabButton
              active={tab === 'build'}
              onClick={() => setTab('build')}
              label="Build"
              disabled={!halfPallet && !fullPallet}
            />
          </div>

          {tab === 'items' && (
            <ProgramItemPicker
              halfPallet={halfPallet}
              fullPallet={fullPallet}
              retailer={retailer}
              products={products}
              readOnly={isReadOnly}
              onToggle={handleToggleSelected}
            />
          )}
          {tab === 'quantities' && (
            <ProgramMatrix
              halfPallet={halfPallet}
              fullPallet={fullPallet}
              retailer={retailer}
              products={products}
              readOnly={isReadOnly}
              onCellChange={(palletId, productId, cases) =>
                updateAssortmentForProject(palletId, productId, cases)
              }
              onQuantityChange={handleQuantityChange}
              onGoToItems={() => setTab('items')}
            />
          )}
          {tab === 'build' && (
            <ProgramBuildTab
              halfPallet={halfPallet}
              fullPallet={fullPallet}
              activePalletTab={buildPalletTab}
              onPalletTabChange={setBuildPalletTab}
              roleHref={roleHref}
            />
          )}
        </>
      )}
      {dialog}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
  disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        active
          ? 'bg-white text-[#171717] shadow-sm'
          : 'text-[#777] hover:text-[#171717] disabled:hover:text-[#777] disabled:opacity-40 disabled:cursor-not-allowed'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span
          className={`text-[11px] tabular-nums ${active ? 'text-[#999]' : 'text-[#aaa]'}`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full inline-flex items-center gap-2 px-3 py-2 text-left text-[12px] font-medium transition-colors ${
        destructive
          ? 'text-[#c0392b] hover:bg-red-50'
          : 'text-[#171717] hover:bg-[#fafafa]'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="h-px bg-[#f0f0f0] my-1" />
}

function ProgramBuildTab({
  halfPallet,
  fullPallet,
  activePalletTab,
  onPalletTabChange,
  roleHref,
}: {
  halfPallet: DisplayProject | null
  fullPallet: DisplayProject | null
  activePalletTab: BuildPalletTab
  onPalletTabChange: (next: BuildPalletTab) => void
  roleHref: (path: string) => string
}) {
  // If only one pallet type exists, snap to it.
  const effectiveTab: BuildPalletTab =
    halfPallet && !fullPallet
      ? 'half'
      : fullPallet && !halfPallet
        ? 'full'
        : activePalletTab
  const pallet = effectiveTab === 'half' ? halfPallet : fullPallet

  if (!pallet) {
    return (
      <div className="bg-white shadow-card rounded-xl p-8 text-center">
        <p className="text-[13px] text-[#888]">
          Add a pallet to this program to build it.
        </p>
      </div>
    )
  }

  const bothExist = !!halfPallet && !!fullPallet
  const editorBase = `/retailers/${pallet.retailerId}/pallets/${pallet.id}/editor`

  return (
    <div className="space-y-4">
      {bothExist && (
        <div className="flex items-center gap-1 p-1 bg-[#f2f2f2] rounded-lg w-fit">
          <PalletSubTab
            active={effectiveTab === 'half'}
            onClick={() => onPalletTabChange('half')}
            label="Half"
            quantity={halfPallet?.quantity ?? 1}
          />
          <PalletSubTab
            active={effectiveTab === 'full'}
            onClick={() => onPalletTabChange('full')}
            label="Full"
            quantity={fullPallet?.quantity ?? 1}
          />
        </div>
      )}

      <div className="bg-white shadow-card rounded-xl p-6">
        <p className="text-[10px] uppercase tracking-wider text-[#999] mb-4">
          Build in model
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={roleHref(`${editorBase}?view=2d`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#f5f5f5] text-[#333] text-[13px] font-medium hover:bg-[#eee] transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            2D plan
          </Link>
          <Link
            to={roleHref(`${editorBase}?view=3d`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors"
          >
            <Box className="w-3.5 h-3.5" />
            3D model
          </Link>
        </div>
      </div>
    </div>
  )
}

function PalletSubTab({
  active,
  onClick,
  label,
  quantity,
}: {
  active: boolean
  onClick: () => void
  label: string
  quantity: number
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        active ? 'bg-white text-[#171717] shadow-sm' : 'text-[#777] hover:text-[#171717]'
      }`}
    >
      {label}
      <span
        className={`text-[11px] tabular-nums ${active ? 'text-[#999]' : 'text-[#aaa]'}`}
      >
        x {quantity}
      </span>
    </button>
  )
}
