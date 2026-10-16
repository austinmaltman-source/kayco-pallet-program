import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Box,
  Boxes,
  ChevronDown,
  Copy,
  Flag,
  Grid3x3,
  Minus,
  Package,
  Plus,
  Redo2,
  RotateCw,
  Search,
  Shuffle,
  Trash2,
  Undo2,
  Wand2,
  X,
} from 'lucide-react'
import type { PlacedProduct, Product, TrayFace } from '../../types'
import { useBuilder } from './use-builder'
import { BuilderScene, type CameraView, type DragTarget } from './builder-scene'
import {
  addCases,
  blocksOf,
  commitMove,
  cycleArrangement,
  duplicateCase,
  nudgeCase,
  previewMove,
  removeCases,
  ridersOf,
  rotateCase,
  totalsOf,
  autoArrange,
  heavyAboveLight,
} from '../../lib/builder/builder-model'
import {
  type Block,
  type Invalid,
  DEFAULT_SNAP,
  cubbyAt,
  faceAt,
  shelfUsage,
  validateBlock,
} from '../../lib/builder/placement-engine'
import { type AddMode, caseSpecFor, unitsForMode, unitsPerCaseOf } from '../../lib/builder/case-spec'
import { PALLET_WEIGHT_LIMIT } from '../../lib/constants'
import { useAppSettingsStore } from '../../stores/app-settings-store'

const INVALID_WORDS: Record<Invalid, string> = {
  'off-shelf': 'Off the shelf',
  overlap: 'Overlaps another case',
  'too-tall': 'Too tall for this shelf',
  unsupported: 'Not enough support underneath',
  'no-shelf': 'No shelf here',
}

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })

const inches = (n: number) => `${fmt(n, n % 1 === 0 ? 0 : 1)}"`

function ProductThumb({ url, color, size = 44 }: { url?: string; color?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className="shrink-0 rounded-lg bg-white shadow-ring overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" className="w-full h-full object-contain p-0.5" onError={() => setFailed(true)} />
      ) : (
        <Package className="w-1/2 h-1/2" style={{ color: color ?? '#94a3b8' }} />
      )}
    </div>
  )
}

type Notice = { tone: 'info' | 'warn'; text: string } | null

export function PalletBuilder() {
  const {
    project,
    retailer,
    catalog,
    ctx,
    surfaces,
    palletDims,
    maxDisplayHeight,
    commit,
    changeGeometry,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBuilder()
  const show3DHeaderSetting = useAppSettingsStore((s) => s.settings.show3DHeader)
  const [showHeaderSign, setShowHeaderSign] = useState(true)
  const show3DHeader = show3DHeaderSetting && showHeaderSign

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<CameraView>('3d')
  const [viewToken, setViewToken] = useState(0)
  const [cartons, setCartons] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [gap, setGap] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [mobileTab, setMobileTab] = useState<'items' | 'summary'>('items')
  const [targetTier, setTargetTier] = useState<number | 'auto'>('auto')
  const [targetFace, setTargetFace] = useState<TrayFace>('front')
  const [targetCubby, setTargetCubby] = useState<number | 'auto'>('auto')
  const [addMode, setAddMode] = useState<AddMode>('case')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const placements = useMemo(() => project?.placements ?? [], [project?.placements])
  const blockList = useMemo(() => blocksOf(placements, surfaces), [placements, surfaces])
  const blocks = useMemo(() => new Map(blockList.map((b) => [b.id, b])), [blockList])
  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog])

  const say = useCallback((tone: 'info' | 'warn', text: string) => {
    setNotice({ tone, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 3800)
  }, [])

  // Clear a selection that no longer exists (undo, delete).
  useEffect(() => {
    if (selectedId && !placements.some((p) => p.id === selectedId)) setSelectedId(null)
  }, [placements, selectedId])

  const snapOptions = useMemo(() => ({ ...DEFAULT_SNAP, gap }), [gap])
  const prefs = useMemo(
    () => ({
      tier: targetTier === 'auto' ? undefined : targetTier,
      face: targetFace,
      gap,
      cubby: targetCubby === 'auto' ? undefined : targetCubby,
    }),
    [targetTier, targetFace, gap, targetCubby],
  )

  // count = cases (case mode), half cases (half mode) or units (units mode).
  const handleAdd = useCallback(
    (product: Product, count = 1, mode: AddMode = 'case') => {
      const current = project?.placements ?? []
      const upc = unitsPerCaseOf(product)
      const blockUnits = unitsForMode(product, mode, count)
      const blocksWanted = mode === 'units' ? 1 : count
      const result = addCases(current, product, blocksWanted, ctx, { ...prefs, unitsPerBlock: blockUnits })
      if (result.added === 0) {
        const spec = caseSpecFor(product, null, blockUnits)
        say(
          'warn',
          `No room for ${blockUnits} unit${blockUnits === 1 ? '' : 's'} of ${product.name} (${inches(spec.case.width)} wide x ${inches(spec.case.depth)} deep x ${inches(spec.case.height)} tall)${
            spec.case.height > Math.max(...surfaces.map((s) => s.clearance)) ? ', taller than every shelf' : ''
          }`,
        )
        return
      }
      commit(result.placements)
      setSelectedId(result.addedIds[result.addedIds.length - 1] ?? null)
      const units = result.added * blockUnits
      const cases = units / upc
      const casesText = `${fmt(cases, cases % 1 ? 1 : 0)} cs`
      if (result.added < result.requested) {
        say('warn', `Placed ${fmt(units)} units (${casesText}). The rest don't fit.`)
      } else {
        say('info', `Added ${fmt(units)} unit${units === 1 ? '' : 's'} (${casesText})`)
      }
    },
    [project?.placements, ctx, prefs, commit, say, surfaces],
  )

  const removeLastOf = useCallback(
    (productId: string) => {
      const mine = placements.filter((p) => p.sourceProductId === productId)
      if (!mine.length) return
      // Top-most first so stacks come down from the top.
      const last = [...mine].sort((a, b) => (b.position?.[1] ?? 0) - (a.position?.[1] ?? 0))[0]
      commit(removeCases(placements, [last.id], ctx))
    },
    [placements, ctx, commit],
  )

  // ---- drag --------------------------------------------------------------
  const onDragStart = useCallback(
    (id: string) => {
      const riders = ridersOf(id, blockList)
      return new Set([id, ...riders])
    },
    [blockList],
  )
  const lastPreview = useRef<{ id: string; block: Block } | null>(null)
  const onDragMove = useCallback(
    (id: string, target: DragTarget) => {
      const preview = previewMove(placements, id, target, ctx, snapOptions)
      if (preview) lastPreview.current = { id, block: preview.block }
      return preview
    },
    [placements, ctx, snapOptions],
  )
  const onDragEnd = useCallback(
    (id: string, ok: boolean) => {
      const preview = lastPreview.current
      lastPreview.current = null
      if (!ok || !preview || preview.id !== id) return
      const before = blocks.get(id)
      if (before && Math.abs(before.x - preview.block.x) < 0.01 && Math.abs(before.z - preview.block.z) < 0.01 && before.tier === preview.block.tier && Math.abs(before.y - preview.block.y) < 0.01) return
      const next = commitMove(placements, id, preview.block, ctx)
      commit(next)
      if (heavyAboveLight(next, ctx, catalog).has(id)) {
        say('warn', 'Heads up: this is heavier than what sits below it. Heavy goes on the bottom.')
      }
    },
    [blocks, placements, ctx, commit, catalog, say],
  )

  // ---- selection actions -------------------------------------------------
  const selected = selectedId ? placements.find((p) => p.id === selectedId) ?? null : null
  const selectedBlock = selectedId ? blocks.get(selectedId) ?? null : null
  const doRotate = useCallback(() => {
    if (!selectedId) return
    const r = rotateCase(placements, selectedId, ctx)
    if (r.ok) commit(r.placements)
    else say('warn', "No room to turn it here. Drag it somewhere wider first.")
  }, [selectedId, placements, ctx, commit, say])
  const doDelete = useCallback(() => {
    if (!selectedId) return
    commit(removeCases(placements, [selectedId], ctx))
    setSelectedId(null)
  }, [selectedId, placements, ctx, commit])
  const doDuplicate = useCallback(() => {
    if (!selectedId) return
    const r = duplicateCase(placements, selectedId, ctx, catalog)
    if (r.newId) {
      commit(r.placements)
      setSelectedId(r.newId)
    } else say('warn', 'No free spot for another case of this item.')
  }, [selectedId, placements, ctx, catalog, commit, say])
  const doArrange = useCallback(() => {
    if (!selectedId) return
    const r = cycleArrangement(placements, selectedId, ctx, catalog)
    if (r.ok && 'layout' in r && r.layout) {
      commit(r.placements)
      say('info', `Units arranged ${r.layout.cols} across x ${r.layout.rows} deep${r.layout.layers > 1 ? ` x ${r.layout.layers} high` : ''}`)
    } else say('warn', 'No other arrangement of these units fits here.')
  }, [selectedId, placements, ctx, catalog, commit, say])

  const doAutoArrange = useCallback(() => {
    const r = autoArrange(placements, ctx, catalog, gap)
    commit(r.placements)
    setSelectedId(null)
    say(
      r.dropped.length ? 'warn' : 'info',
      r.dropped.length
        ? `Arranged heaviest on the bottom. ${r.dropped.length} case${r.dropped.length === 1 ? '' : 's'} didn't fit and came off.`
        : 'Arranged: heaviest items on the bottom shelves, each item kept together.',
    )
  }, [placements, ctx, catalog, gap, commit, say])

  const doFillFace = useCallback(() => {
    if (!selectedId) return
    const p = placements.find((x) => x.id === selectedId)
    const b = blocks.get(selectedId)
    const product = p?.sourceProductId ? productById.get(p.sourceProductId) : undefined
    const s = b ? surfaces.find((x) => x.tier === b.tier) : undefined
    if (!p || !b || !product || !s) return
    const face = faceAt(b.x, b.z, s)
    const cubby = cubbyAt(b.x, s)
    const r = addCases(placements, product, 60, ctx, {
      onlyTier: b.tier,
      onlyFace: face,
      noStack: true,
      gap,
      ...(cubby != null ? { onlyCubby: cubby } : {}),
    })
    if (!r.added) {
      say('warn', 'That spot is already full.')
      return
    }
    commit(r.placements)
    say('info', `Filled it: +${r.added} case${r.added === 1 ? '' : 's'} (${fmt(r.added * caseSpecFor(product).unitsPerCase)} units)`)
  }, [selectedId, placements, blocks, productById, surfaces, ctx, gap, commit, say])

  // ---- keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (!selectedId) return
      if (e.key === 'r' || e.key === 'R') doRotate()
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        doDelete()
      } else if (e.key === 'd' || e.key === 'D') doDuplicate()
      else if (e.key === 'Escape') setSelectedId(null)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 2 : 0.5
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const r = nudgeCase(placements, selectedId, dx, dz, ctx)
        if (r.ok) commit(r.placements)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, placements, ctx, commit, undo, redo, doRotate, doDelete, doDuplicate])

  // ---- stats -------------------------------------------------------------
  const totals = useMemo(() => totalsOf(placements, catalog, palletDims.height), [placements, catalog, palletDims.height])
  const usage = useMemo(() => shelfUsage(surfaces, blockList), [surfaces, blockList])
  const problems = useMemo(() => {
    const out: { id: string; why: Invalid }[] = []
    for (const b of blockList) {
      const why = validateBlock(b, surfaces, blockList)
      if (why) out.push({ id: b.id, why })
    }
    return out
  }, [blockList, surfaces])
  const heavyIds = useMemo(() => heavyAboveLight(placements, ctx, catalog), [placements, ctx, catalog])
  const totalArea = surfaces.reduce((s, x) => s + x.area, 0)
  const usedArea = usage.reduce((s, x) => s + x.usedArea, 0)
  const overWeight = totals.weight > PALLET_WEIGHT_LIMIT
  const overHeight = totals.height > maxDisplayHeight + 0.01
  const unplaced = placements.length - blockList.length

  if (!project) return null
  const isHalf = project.palletType === 'half'

  const geometry = (next: { palletType?: 'full' | 'half'; tierCount?: number }) => {
    const dropped = changeGeometry(next)
    if (dropped.length) say('warn', `${dropped.length} case${dropped.length === 1 ? '' : 's'} no longer fit and were taken off.`)
    setViewToken((t) => t + 1)
  }

  const summary = (
    <SummaryPanel
      isHalf={isHalf}
      tierCount={project.tierCount}
      palletDims={palletDims}
      maxDisplayHeight={maxDisplayHeight}
      totals={totals}
      usage={usage}
      fill={totalArea > 0 ? usedArea / totalArea : 0}
      overWeight={overWeight}
      overHeight={overHeight}
      problems={problems.length}
      heavy={heavyIds.size}
      onAutoArrange={doAutoArrange}
      unplaced={unplaced}
      placements={placements}
      productById={productById}
      assortment={project.assortment ?? []}
      onGeometry={geometry}
      onAdd={handleAdd}
      onRemoveLast={removeLastOf}
      onSelectProduct={(productId) => {
        const first = placements.find((p) => p.sourceProductId === productId)
        if (first) setSelectedId(first.id)
      }}
    />
  )

  const items = (
    <ProductPanel
      catalog={catalog}
      retailerItemIds={retailer?.authorizedItems?.map((a) => a.productId) ?? []}
      assortment={project.assortment ?? []}
      placedByProduct={totals.byProduct}
      onAdd={handleAdd}
      surfaces={surfaces.length}
      isHalf={isHalf}
      targetTier={targetTier}
      setTargetTier={setTargetTier}
      targetFace={targetFace}
      setTargetFace={setTargetFace}
      targetCubby={targetCubby}
      setTargetCubby={setTargetCubby}
      addMode={addMode}
      setAddMode={setAddMode}
    />
  )

  return (
    <div className="flex h-full w-full flex-col md:flex-row bg-[#f6f7f9] text-[#171717] overflow-hidden">
      {/* Left: products (desktop) */}
      <aside className="hidden md:flex w-[300px] lg:w-[320px] shrink-0 flex-col border-r border-black/[0.06] bg-white">
        {items}
      </aside>

      {/* Centre: 3D */}
      <section className="relative flex-1 min-w-0 min-h-[52vh] md:min-h-0">
        <BuilderScene
          palletType={project.palletType}
          tierCount={project.tierCount}
          palletDims={palletDims}
          maxDisplayHeight={maxDisplayHeight}
          lipColor={project.lipColor}
          branding={project.branding}
          holiday={project.holiday}
          showHeader={show3DHeader}
          surfaces={surfaces}
          placements={placements}
          blocks={blocks}
          selectedId={selectedId}
          view={view}
          viewToken={viewToken}
          cartons={cartons}
          showGrid={showGrid}
          onSelect={setSelectedId}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />

        {/* Toolbar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2 md:p-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-card backdrop-blur">
            <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </ToolButton>
            <button
              onClick={doAutoArrange}
              disabled={placements.length === 0}
              title="Re-place everything: heaviest items on the bottom shelves, each item kept together"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-[#2563eb] hover:bg-[#e8efff] disabled:opacity-30"
            >
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">Auto-arrange</span>
            </button>
            <div className="mx-1 h-5 w-px bg-black/10" />
            <div className="flex rounded-lg bg-[#f1f3f6] p-0.5">
              {(['full', 'half'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => t !== project.palletType && geometry({ palletType: t })}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    project.palletType === t ? 'bg-[#171717] text-white' : 'text-[#666] hover:text-[#171717]'
                  }`}
                >
                  {t === 'full' ? 'Full' : 'Half'}
                </button>
              ))}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-card backdrop-blur">
            {(
              [
                ['3d', '3D'],
                ['front', 'Front'],
                ['top', 'Top'],
                ...(isHalf ? [] : [['right', 'Side'], ['back', 'Back']]),
              ] as [CameraView, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => {
                  setView(v)
                  setViewToken((t) => t + 1)
                }}
                className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
                  view === v ? 'bg-[#171717] text-white' : 'text-[#666] hover:bg-[#f1f3f6] hover:text-[#171717]'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="mx-1 h-5 w-px bg-black/10" />
            <ToolButton label={cartons ? 'Show units' : 'Show cartons'} onClick={() => setCartons((c) => !c)} active={cartons}>
              {cartons ? <Box className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
            </ToolButton>
            <ToolButton label="Shelf grid" onClick={() => setShowGrid((g) => !g)} active={showGrid}>
              <Grid3x3 className="h-4 w-4" />
            </ToolButton>
            {show3DHeaderSetting && (
              <ToolButton label={showHeaderSign ? 'Hide header sign' : 'Show header sign'} onClick={() => setShowHeaderSign((v) => !v)} active={showHeaderSign}>
                <Flag className="h-4 w-4" />
              </ToolButton>
            )}
            <label className="hidden lg:flex items-center gap-1 pl-1 pr-1.5 text-[11px] text-[#666]" title="Space kept between neighbouring cases">
              Gap
              <select
                value={gap}
                onChange={(e) => setGap(Number(e.target.value))}
                className="rounded-md bg-[#f1f3f6] px-1 py-0.5 text-[11px] font-medium text-[#171717] outline-none"
              >
                {[0, 0.25, 0.5, 1].map((g) => (
                  <option key={g} value={g}>
                    {g === 0 ? 'Flush' : `${g}"`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Empty state */}
        {placements.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-28 md:top-16 flex justify-center px-4">
            <div className="rounded-xl bg-white/95 px-4 py-3 text-center shadow-card">
              <p className="text-[13px] font-semibold">Add an item to start building</p>
              <p className="mt-0.5 text-[12px] text-[#666]">
                Add by the case, half case or unit. Units go on the shelf face-out; drag them anywhere, drop on top to stack.
              </p>
            </div>
          </div>
        )}

        {/* Notice */}
        {notice && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 md:bottom-28 flex justify-center px-4">
            <div
              className={`rounded-full px-4 py-2 text-[12px] font-medium shadow-elevated ${
                notice.tone === 'warn' ? 'bg-[#fff7ed] text-[#9a3412]' : 'bg-[#171717] text-white'
              }`}
            >
              {notice.text}
            </div>
          </div>
        )}

        {/* Selected case */}
        {selected && selectedBlock && (
          <SelectedCard
            placement={selected}
            block={selectedBlock}
            surfaceY={surfaces.find((s) => s.tier === selectedBlock.tier)?.y ?? 0}
            face={(() => {
              const s = surfaces.find((x) => x.tier === selectedBlock.tier)
              return s ? faceAt(selectedBlock.x, selectedBlock.z, s) : 'front'
            })()}
            problem={problems.find((p) => p.id === selected.id)?.why ?? null}
            heavy={heavyIds.has(selected.id)}
            upcFor={(() => {
              const prod = selected.sourceProductId ? productById.get(selected.sourceProductId) : undefined
              return prod ? unitsPerCaseOf(prod) : undefined
            })()}
            cubby={(() => {
              const s = surfaces.find((x) => x.tier === selectedBlock.tier)
              return s ? cubbyAt(selectedBlock.x, s) : null
            })()}
            onFill={doFillFace}
            onRotate={doRotate}
            onArrange={doArrange}
            onDuplicate={doDuplicate}
            onDelete={doDelete}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* Hint */}
        {!selected && <div className="pointer-events-none absolute bottom-2 left-3 hidden md:block text-[11px] text-[#8a8f98]">
          Drag to move · drop on top to stack · R rotate · D duplicate · Del remove · arrows nudge ½"
        </div>}
      </section>

      {/* Right: summary (desktop) */}
      <aside className="hidden md:flex w-[300px] lg:w-[320px] shrink-0 flex-col border-l border-black/[0.06] bg-white">
        {summary}
      </aside>

      {/* Mobile: tabs under the canvas */}
      <div className="md:hidden flex min-h-0 flex-1 flex-col border-t border-black/[0.06] bg-white">
        <div className="flex gap-1 p-2">
          {(
            [
              ['items', 'Add items'],
              ['summary', `Summary · ${fmt(totals.cases)} cs`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMobileTab(k)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold ${
                mobileTab === k ? 'bg-[#171717] text-white' : 'bg-[#f1f3f6] text-[#555]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden flex flex-col">{mobileTab === 'items' ? items : summary}</div>
      </div>
    </div>
  )
}

function ToolButton({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
        active ? 'bg-[#e8efff] text-[#2563eb]' : 'text-[#444] hover:bg-[#f1f3f6]'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------

function ProductPanel({
  catalog,
  retailerItemIds,
  assortment,
  placedByProduct,
  onAdd,
  surfaces,
  isHalf,
  targetTier,
  setTargetTier,
  targetFace,
  setTargetFace,
  targetCubby,
  setTargetCubby,
  addMode,
  setAddMode,
}: {
  catalog: Product[]
  retailerItemIds: string[]
  assortment: { productId: string; cases: number }[]
  placedByProduct: Map<string, { cases: number; units: number }>
  onAdd: (p: Product, count?: number, mode?: AddMode) => void
  surfaces: number
  isHalf: boolean
  targetTier: number | 'auto'
  setTargetTier: (t: number | 'auto') => void
  targetFace: TrayFace
  setTargetFace: (f: TrayFace) => void
  targetCubby: number | 'auto'
  setTargetCubby: (c: number | 'auto') => void
  addMode: AddMode
  setAddMode: (m: AddMode) => void
}) {
  const [query, setQuery] = useState('')
  const programIds = useMemo(
    () => new Set([...assortment.map((a) => a.productId), ...retailerItemIds]),
    [assortment, retailerItemIds],
  )
  const [scope, setScope] = useState<'program' | 'all'>(programIds.size ? 'program' : 'all')
  const [qty, setQty] = useState<Record<string, number>>({})

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const words = q.split(/\s+/).filter(Boolean)
    const base = scope === 'program' && programIds.size ? catalog.filter((p) => programIds.has(p.id)) : catalog
    const filtered = words.length
      ? base.filter((p) => {
          const hay = `${p.name} ${p.sku} ${p.kaycoItemNumber ?? ''} ${p.upc ?? ''} ${p.brand ?? ''}`.toLowerCase()
          return words.every((w) => hay.includes(w))
        })
      : base
    const planned = new Map(assortment.map((a) => [a.productId, a.cases]))
    return [...filtered]
      .sort((a, b) => (planned.get(b.id) ?? 0) - (planned.get(a.id) ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 80)
  }, [catalog, query, scope, programIds, assortment])
  const planned = useMemo(() => new Map(assortment.map((a) => [a.productId, a.cases])), [assortment])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-black/[0.06] p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight-sm">Add items</h2>
          <div className="flex rounded-lg bg-[#f1f3f6] p-0.5 text-[11px] font-medium">
            <button
              onClick={() => setScope('program')}
              disabled={!programIds.size}
              className={`rounded-md px-2 py-0.5 disabled:opacity-40 ${scope === 'program' ? 'bg-white shadow-border text-[#171717]' : 'text-[#666]'}`}
            >
              Program
            </button>
            <button
              onClick={() => setScope('all')}
              className={`rounded-md px-2 py-0.5 ${scope === 'all' ? 'bg-white shadow-border text-[#171717]' : 'text-[#666]'}`}
            >
              All items
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#999]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, Kayco #, UPC, brand"
            className="w-full rounded-lg bg-[#f1f3f6] py-2 pl-8 pr-8 text-[13px] outline-none focus:bg-white focus:shadow-border"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999]" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#666]">
          <span className="w-[46px]">Add by</span>
          <div className="flex flex-1 rounded-lg bg-[#f1f3f6] p-0.5 font-medium">
            {(
              [
                ['case', 'Case'],
                ['half', '½ case'],
                ['units', 'Units'],
              ] as [AddMode, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setAddMode(k)}
                className={`flex-1 rounded-md px-2 py-1 ${addMode === k ? 'bg-white text-[#171717] shadow-border' : 'text-[#666]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#666]">
          <span className="w-[46px]">Place on</span>
          <div className="relative">
            <select
              value={targetTier}
              onChange={(e) => setTargetTier(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
              className="appearance-none rounded-md bg-[#f1f3f6] py-1 pl-2 pr-6 font-medium text-[#171717] outline-none"
            >
              <option value="auto">First free shelf</option>
              {Array.from({ length: surfaces }, (_, i) => i + 1).map((t) => (
                <option key={t} value={t}>
                  Shelf {t}
                  {t === 1 ? ' (bottom)' : t === surfaces ? ' (top)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2" />
          </div>
          {isHalf && (
            <div className="relative">
              <select
                value={targetCubby}
                onChange={(e) => setTargetCubby(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                className="appearance-none rounded-md bg-[#f1f3f6] py-1 pl-2 pr-6 font-medium text-[#171717] outline-none"
              >
                <option value="auto">Any cubby</option>
                {[0, 1, 2, 3, 4].map((c) => (
                  <option key={c} value={c}>
                    Cubby {c + 1}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2" />
            </div>
          )}
          {!isHalf && (
            <div className="relative">
              <select
                value={targetFace}
                onChange={(e) => setTargetFace(e.target.value as TrayFace)}
                className="appearance-none rounded-md bg-[#f1f3f6] py-1 pl-2 pr-6 font-medium capitalize text-[#171717] outline-none"
              >
                {(['front', 'right', 'back', 'left'] as TrayFace[]).map((f) => (
                  <option key={f} value={f}>
                    {f} side
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2" />
            </div>
          )}
        </div>
      </div>

      <ul className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && (
          <li className="p-6 text-center text-[12px] text-[#888]">
            {catalog.length === 0 ? 'Loading the Kayco catalog…' : 'No items match.'}
          </li>
        )}
        {list.map((p) => {
          const spec = caseSpecFor(p)
          const placed = placedByProduct.get(p.id)
          const plan = planned.get(p.id)
          const n = qty[`${addMode}:${p.id}`] ?? (addMode === 'units' ? Math.max(1, Math.ceil(spec.unitsPerCase / 4)) : 1)
          const setN = (v: number) => setQty((q) => ({ ...q, [`${addMode}:${p.id}`]: v }))
          const addLabel =
            addMode === 'units'
              ? `Add ${n} unit${n === 1 ? '' : 's'}`
              : addMode === 'half'
                ? `Add ${n === 1 ? '½ case' : `${n} × ½ case`}`
                : `Add ${n === 1 ? 'case' : `${n} cases`}`
          return (
            <li key={p.id} className="group flex gap-2.5 border-b border-black/[0.04] px-3 py-2.5 hover:bg-[#fafbfc]">
              <ProductThumb url={p.imageUrl} color={p.brandColor} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[12px] font-medium leading-snug">{p.name}</p>
                <p className="mt-0.5 text-[11px] text-[#777] tabular-nums">
                  #{p.kaycoItemNumber ?? p.sku} · <b className="font-semibold text-[#333]">{spec.unitsPerCase}/case</b> · unit{' '}
                  {inches(spec.unit.width)}w × {inches(spec.unit.depth)}d × {inches(spec.unit.height)}h
                  {spec.estimatedUnit && <span title="No unit dimensions in the item master; using a placeholder size"> (size missing)</span>}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="flex items-center rounded-md bg-[#f1f3f6]">
                    <button
                      className="px-1.5 py-1 text-[#555]"
                      onClick={() => setN(Math.max(1, n - 1))}
                      aria-label="Fewer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-[12px] font-semibold tabular-nums">{n}</span>
                    <button
                      className="px-1.5 py-1 text-[#555]"
                      onClick={() => setN(Math.min(addMode === 'units' ? 999 : 99, n + 1))}
                      aria-label="More"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => onAdd(p, n, addMode)}
                    className="inline-flex items-center gap-1 rounded-md bg-[#171717] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#333]"
                  >
                    <Plus className="h-3 w-3" /> {addLabel}
                  </button>
                  {(placed || plan) && (
                    <span
                      className={`ml-auto text-[11px] tabular-nums ${
                        plan && placed && Math.round(placed.cases) >= plan ? 'text-[#15803d]' : 'text-[#777]'
                      }`}
                    >
                      {fmt(placed?.cases ?? 0, (placed?.cases ?? 0) % 1 ? 1 : 0)}
                      {plan ? `/${plan}` : ''} cs
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 ${warn ? 'bg-[#fef2f2]' : 'bg-[#f6f7f9]'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">{label}</p>
      <p className={`mt-0.5 text-[18px] font-semibold leading-tight tabular-nums tracking-tight-sm ${warn ? 'text-[#b91c1c]' : ''}`}>{value}</p>
      {sub && <p className={`text-[11px] tabular-nums ${warn ? 'text-[#b91c1c]' : 'text-[#888]'}`}>{sub}</p>}
    </div>
  )
}

function SummaryPanel({
  isHalf,
  tierCount,
  palletDims,
  maxDisplayHeight,
  totals,
  usage,
  fill,
  overWeight,
  overHeight,
  problems,
  heavy,
  onAutoArrange,
  unplaced,
  placements,
  productById,
  assortment,
  onGeometry,
  onAdd,
  onRemoveLast,
  onSelectProduct,
}: {
  isHalf: boolean
  tierCount: number
  palletDims: { width: number; depth: number; height: number }
  maxDisplayHeight: number
  totals: ReturnType<typeof totalsOf>
  usage: ReturnType<typeof shelfUsage>
  fill: number
  overWeight: boolean
  overHeight: boolean
  problems: number
  heavy: number
  onAutoArrange: () => void
  unplaced: number
  placements: PlacedProduct[]
  productById: Map<string, Product>
  assortment: { productId: string; cases: number }[]
  onGeometry: (next: { palletType?: 'full' | 'half'; tierCount?: number }) => void
  onAdd: (p: Product, count?: number, mode?: AddMode) => void
  onRemoveLast: (productId: string) => void
  onSelectProduct: (productId: string) => void
}) {
  const rows = useMemo(() => {
    const ids = new Set<string>()
    placements.forEach((p) => p.sourceProductId && ids.add(p.sourceProductId))
    assortment.forEach((a) => a.cases > 0 && ids.add(a.productId))
    const planned = new Map(assortment.map((a) => [a.productId, a.cases]))
    return [...ids]
      .map((id) => ({
        id,
        product: productById.get(id),
        placed: totals.byProduct.get(id) ?? { cases: 0, units: 0 },
        planned: planned.get(id) ?? 0,
      }))
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? ''))
  }, [placements, assortment, productById, totals.byProduct])
  const short = rows.filter((r) => r.planned > 0 && r.placed.cases < r.planned - 0.01)

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-3 border-b border-black/[0.06] p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight-sm">Pallet</h2>
          <span className="text-[11px] text-[#888] tabular-nums">
            {isHalf ? `Half · ${palletDims.width}" x ${palletDims.depth / 2}"` : `Full · ${palletDims.width}" x ${palletDims.depth}"`}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[#f6f7f9] px-2.5 py-2">
          <span className="text-[12px] text-[#555]">Shelves</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onGeometry({ tierCount: tierCount - 1 })}
              disabled={tierCount <= 2}
              className="rounded-md bg-white p-1 shadow-border disabled:opacity-30"
              aria-label="Fewer shelves"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-[13px] font-semibold tabular-nums">{tierCount}</span>
            <button
              onClick={() => onGeometry({ tierCount: tierCount + 1 })}
              disabled={tierCount >= 6}
              className="rounded-md bg-white p-1 shadow-border disabled:opacity-30"
              aria-label="More shelves"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cases" value={fmt(totals.cases, totals.cases % 1 ? 1 : 0)} />
          <Stat label="Units" value={fmt(totals.units)} />
          <Stat
            label="Height"
            value={inches(Math.round(totals.height * 10) / 10)}
            sub={`max ${maxDisplayHeight}"`}
            warn={overHeight}
          />
          <Stat
            label="Weight"
            value={`${fmt(totals.weight)} lb`}
            sub={`limit ${fmt(PALLET_WEIGHT_LIMIT)} lb`}
            warn={overWeight}
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wide text-[#888]">Shelf space used</span>
            <span className="font-semibold tabular-nums">{fmt(fill * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eceef2]">
            <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${Math.min(100, fill * 100)}%` }} />
          </div>
        </div>

        {heavy > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-[#fff7ed] p-2.5 text-[12px] text-[#9a3412]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="flex-1">
              {heavy} heavy case{heavy === 1 ? ' sits' : 's sit'} above lighter ones.{' '}
              <button onClick={onAutoArrange} className="font-semibold underline">
                Auto-arrange
              </button>
            </p>
          </div>
        )}
        {(problems > 0 || overWeight || overHeight || unplaced > 0) && (
          <div className="space-y-1 rounded-xl bg-[#fef2f2] p-2.5 text-[12px] text-[#991b1b]">
            {problems > 0 && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {problems} case{problems === 1 ? '' : 's'} off the shelf, overlapping or too tall. Select to fix.
              </p>
            )}
            {overHeight && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Taller than this retailer's {maxDisplayHeight}" limit.
              </p>
            )}
            {overWeight && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Over the {fmt(PALLET_WEIGHT_LIMIT)} lb pallet limit.
              </p>
            )}
            {unplaced > 0 && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {unplaced} older placement{unplaced === 1 ? '' : 's'} without a 3D position (see 2D view).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-b border-black/[0.06] p-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">By shelf</h3>
        <ul className="space-y-1.5">
          {[...usage].reverse().map((u) => (
            <li key={u.tier} className="text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  Shelf {u.tier}
                  <span className="ml-1 font-normal text-[#999]">{inches(Math.round(u.clearance * 10) / 10)} clear</span>
                </span>
                <span className="tabular-nums text-[#666]">
                  {fmt(u.fill * 100)}%{u.stackLevels > 1 ? ` · ${u.stackLevels} high` : ''}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#eceef2]">
                <div
                  className={`h-full rounded-full ${u.tallest > u.clearance + 0.01 ? 'bg-[#dc2626]' : 'bg-[#60a5fa]'}`}
                  style={{ width: `${Math.min(100, u.fill * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">On this pallet</h3>
          {short.length > 0 && (
            <button
              onClick={() =>
                short.forEach((r) => r.product && onAdd(r.product, Math.ceil(r.planned - r.placed.cases)))
              }
              className="rounded-md bg-[#e8efff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]"
            >
              Place program ({short.length})
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-[12px] text-[#888]">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const upc = r.product ? caseSpecFor(r.product).unitsPerCase : 0
              const done = r.planned > 0 && r.placed.cases >= r.planned - 0.01
              return (
                <li key={r.id} className="flex items-center gap-2">
                  <button onClick={() => onSelectProduct(r.id)} className="shrink-0">
                    <ProductThumb url={r.product?.imageUrl} color={r.product?.brandColor} size={36} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{r.product?.name ?? r.id}</p>
                    <p className="text-[11px] tabular-nums text-[#777]">
                      <span className={done ? 'font-semibold text-[#15803d]' : r.planned ? 'font-semibold text-[#b45309]' : ''}>
                        {fmt(r.placed.cases, r.placed.cases % 1 ? 1 : 0)}
                        {r.planned ? ` of ${r.planned}` : ''} cs
                      </span>{' '}
                      × {upc} = {fmt(r.placed.units)} units
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onRemoveLast(r.id)}
                      disabled={r.placed.cases <= 0}
                      className="rounded-md p-1 text-[#555] hover:bg-[#f1f3f6] disabled:opacity-30"
                      aria-label="Remove a case"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => r.product && onAdd(r.product, 1)}
                      disabled={!r.product}
                      className="rounded-md p-1 text-[#555] hover:bg-[#f1f3f6] disabled:opacity-30"
                      aria-label="Add a case"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function SelectedCard({
  placement,
  block,
  surfaceY,
  face,
  problem,
  heavy,
  upcFor,
  cubby,
  onFill,
  onRotate,
  onArrange,
  onDuplicate,
  onDelete,
  onClose,
}: {
  placement: PlacedProduct
  block: Block
  surfaceY: number
  face: TrayFace
  problem: Invalid | null
  heavy: boolean
  upcFor?: number
  cubby: number | null
  onFill: () => void
  onRotate: () => void
  onArrange: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const layout = placement.caseConfig?.layout
  const units = layout ? layout.cols * layout.rows * layout.layers : 1
  const upc = upcFor ?? 0
  const stacked = block.y > surfaceY + 0.01
  return (
    <div className="absolute inset-x-2 bottom-2 md:inset-x-auto md:left-1/2 md:bottom-8 md:w-[520px] md:-translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-white/97 p-2.5 shadow-elevated backdrop-blur">
        <ProductThumb url={placement.imageUrl} color={placement.color} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold">{placement.label}</p>
          <p className="text-[11px] tabular-nums text-[#666]">
            {units} unit{units === 1 ? '' : 's'}
            {upc ? ` (${units === upc ? '1 case' : units * 2 === upc || units === Math.ceil(upc / 2) ? '½ case' : `${fmt(units / upc, 2)} cs`})` : ''}
            {layout ? ` · ${layout.cols} across × ${layout.rows} deep${layout.layers > 1 ? ` × ${layout.layers} high` : ''}` : ''}
          </p>
          <p className={`text-[11px] ${problem ? 'font-semibold text-[#b91c1c]' : heavy ? 'font-semibold text-[#b45309]' : 'text-[#888]'}`}>
            {problem
              ? INVALID_WORDS[problem]
              : heavy
                ? 'Heavier than what is below it'
                : `Shelf ${block.tier} · ${cubby != null ? `cubby ${cubby + 1}` : `${face} side`}${stacked ? ' · stacked' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onFill}
            title={cubby != null ? 'Fill the rest of this cubby with this item' : 'Fill the rest of this shelf side with this item'}
            className="mr-1 inline-flex h-9 items-center rounded-lg bg-[#171717] px-2.5 text-[12px] font-semibold text-white hover:bg-[#333]"
          >
            Fill
          </button>
          <CardButton label="Rotate 90° (R)" onClick={onRotate}>
            <RotateCw className="h-4 w-4" />
          </CardButton>
          <CardButton label="Change unit arrangement" onClick={onArrange}>
            <Shuffle className="h-4 w-4" />
          </CardButton>
          <CardButton label="Duplicate (D)" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </CardButton>
          <CardButton label="Remove (Del)" onClick={onDelete} danger>
            <Trash2 className="h-4 w-4" />
          </CardButton>
          <CardButton label="Done" onClick={onClose}>
            <X className="h-4 w-4" />
          </CardButton>
        </div>
      </div>
    </div>
  )
}

function CardButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
        danger ? 'text-[#b91c1c] hover:bg-[#fef2f2]' : 'text-[#333] hover:bg-[#f1f3f6]'
      }`}
    >
      {children}
    </button>
  )
}

