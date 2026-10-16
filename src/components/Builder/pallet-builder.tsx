import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Columns3,
  Copy,
  ImageIcon,
  LayoutGrid,
  Minus,
  Package,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import type { PlacedProduct, Product } from '../../types'
import { useBuilder } from './use-builder'
import { BuilderScene, type CameraView, type DragTarget } from './builder-scene'
import {
  addCases,
  autoArrange,
  blocksOf,
  commitMove,
  duplicateCase,
  fillSlot,
  heavyAboveLight,
  moveToTopTray,
  nudgeCase,
  orientationOf,
  previewMove,
  removeCases,
  ridersOf,
  rotateCase,
  setBlockUnits,
  setOrientation,
  totalsOf,
} from '../../lib/builder/builder-model'
import { type Block, DEFAULT_SNAP, cubbyAt, faceAt, shelfUsage, validateBlock } from '../../lib/builder/placement-engine'
import { type AddMode, caseSpecFor, isSquishable, unitsForMode, unitsPerCaseOf } from '../../lib/builder/case-spec'
import { dividersFor, evenDividers, halfInner, MIN_CUBBY } from '../../lib/builder/display-spec'
import { PALLET_WEIGHT_LIMIT } from '../../lib/constants'
import { useAppSettingsStore } from '../../stores/app-settings-store'
import { ART_SLOTS, type ArtDisplay, type ArtSlot, artUrl, fileToArtDataUrl, useArtStore } from '../../stores/art-store'

// Pallet builder v3 - a planogram tool: the display is the hero, products
// are dragged from the list straight onto a shelf or cubby, and a click on a
// placed item opens one small card with everything you can do to it.

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
const casesText = (n: number) => `${fmt(n, n % 1 ? 1 : 0)} cs`
const unitsIn = (p: PlacedProduct) =>
  p.caseConfig ? p.caseConfig.layout.cols * p.caseConfig.layout.rows * p.caseConfig.layout.layers : 1

const KAYCO = '#0b3a7e'

function Thumb({ url, size = 44 }: { url?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.06]"
      style={{ width: size, height: size }}
    >
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain p-0.5" onError={() => setFailed(true)} />
      ) : (
        <Package className="h-1/2 w-1/2 text-[#9aa3af]" />
      )}
    </div>
  )
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: React.ReactNode; title?: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-lg bg-[#eef0f3] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-colors ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-[12px]'} ${
            value === o.value ? 'bg-white text-[#111] shadow-sm' : 'text-[#5f6672] hover:text-[#111]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function IconBtn({ title, onClick, disabled, children, active }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors disabled:opacity-35 ${
        active ? 'bg-[#e8eefb] text-[#0b3a7e]' : 'text-[#3d4450] hover:bg-[#f1f3f6]'
      }`}
    >
      {children}
    </button>
  )
}

type Notice = { tone: 'info' | 'warn'; text: string } | null

export interface PalletBuilderProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  onOpenPlan?: () => void
}

export function PalletBuilder({ title, subtitle, onBack, onOpenPlan }: PalletBuilderProps = {}) {
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
    setDividers,
    setSquish,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBuilder()
  const show3DHeader = useAppSettingsStore((s) => s.settings.show3DHeader)
  const customArt = useArtStore((s) => s.custom)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<CameraView>('3d')
  const [viewToken, setViewToken] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [addMode, setAddMode] = useState<AddMode>('case')
  const [unitCount, setUnitCount] = useState(6)
  const [panel, setPanel] = useState<null | 'art' | 'dividers'>(null)
  const [mobileTab, setMobileTab] = useState<'items' | 'summary'>('items')
  const [dropHint, setDropHint] = useState(false)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickRef = useRef<((x: number, y: number) => DragTarget | null) | null>(null)

  const placements = useMemo(() => project?.placements ?? [], [project?.placements])
  const blockList = useMemo(() => blocksOf(placements, surfaces), [placements, surfaces])
  const blocks = useMemo(() => new Map(blockList.map((b) => [b.id, b])), [blockList])
  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog])
  const isHalf = project?.palletType === 'half'
  const artDisplay: ArtDisplay = isHalf ? 'half' : 'full'
  const art = useMemo(
    () => ({
      header: artUrl(customArt, artDisplay, 'header'),
      side: artUrl(customArt, artDisplay, 'side'),
      lip: artUrl(customArt, artDisplay, 'lip'),
    }),
    [customArt, artDisplay],
  )

  const say = useCallback((tone: 'info' | 'warn', text: string) => {
    setNotice({ tone, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 3600)
  }, [])

  useEffect(() => {
    if (selectedId && !placements.some((p) => p.id === selectedId)) setSelectedId(null)
  }, [placements, selectedId])

  // ---- adding --------------------------------------------------------------
  const handleAdd = useCallback(
    (product: Product, where?: { tier: number; x: number; z: number }) => {
      const current = project?.placements ?? []
      const upc = unitsPerCaseOf(product)
      const blockUnits = unitsForMode(product, addMode, unitCount)
      let prefs: Parameters<typeof addCases>[4] = { unitsPerBlock: blockUnits }
      if (where) {
        const s = surfaces.find((x) => x.tier === where.tier)
        if (s) {
          prefs = {
            ...prefs,
            tier: s.tier,
            face: faceAt(where.x, where.z, s),
            cubby: cubbyAt(where.x, s) ?? undefined,
          }
        }
      }
      const result = addCases(current, product, 1, ctx, prefs)
      if (result.added === 0) {
        const spec = caseSpecFor(product, null, blockUnits)
        say('warn', `No room left for ${blockUnits} × ${product.name} (${fmt(spec.case.width, 1)}" wide). Try another shelf or move a divider.`)
        return
      }
      commit(result.placements)
      setSelectedId(result.addedIds[result.addedIds.length - 1] ?? null)
      const landed = blocksOf(result.placements, surfaces).find((b) => b.id === result.addedIds[0])
      const shelf = landed ? surfaces.find((s) => s.tier === landed.tier) : null
      const shelfName = shelf ? (shelf.isTop ? 'top tray' : `shelf ${shelf.tier}`) : ''
      say('info', `Added ${blockUnits} unit${blockUnits === 1 ? '' : 's'} (${casesText(blockUnits / upc)}) to the ${shelfName}`)
    },
    [project?.placements, addMode, unitCount, surfaces, ctx, commit, say],
  )

  // HTML drag from the product list onto the 3D display.
  const onCanvasDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('text/x-kayco-product')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!dropHint) setDropHint(true)
  }
  const onCanvasDrop = (e: React.DragEvent) => {
    setDropHint(false)
    const id = e.dataTransfer.getData('text/x-kayco-product')
    const product = id ? productById.get(id) : undefined
    if (!product) return
    e.preventDefault()
    const target = pickRef.current?.(e.clientX, e.clientY) ?? null
    handleAdd(product, target ?? undefined)
  }

  // ---- moving ----------------------------------------------------------------
  const onDragStart = useCallback((id: string) => new Set([id, ...ridersOf(id, blockList)]), [blockList])
  const lastPreview = useRef<{ id: string; block: Block } | null>(null)
  const onDragMove = useCallback(
    (id: string, target: DragTarget) => {
      const preview = previewMove(placements, id, target, ctx, DEFAULT_SNAP)
      if (preview) lastPreview.current = { id, block: preview.block }
      return preview
    },
    [placements, ctx],
  )
  const onDragEnd = useCallback(
    (id: string, ok: boolean) => {
      const preview = lastPreview.current
      lastPreview.current = null
      if (!ok || !preview || preview.id !== id) return
      const before = blocks.get(id)
      if (
        before &&
        Math.abs(before.x - preview.block.x) < 0.01 &&
        Math.abs(before.z - preview.block.z) < 0.01 &&
        before.tier === preview.block.tier &&
        Math.abs(before.y - preview.block.y) < 0.01
      )
        return
      const next = commitMove(placements, id, preview.block, ctx)
      commit(next)
      if (heavyAboveLight(next, ctx, catalog).has(id)) say('warn', 'Heavier than what sits below it. Heavy goes on the bottom.')
    },
    [blocks, placements, ctx, commit, catalog, say],
  )

  // ---- selected item actions ---------------------------------------------------
  const selected = selectedId ? placements.find((p) => p.id === selectedId) ?? null : null
  const selectedBlock = selectedId ? blocks.get(selectedId) ?? null : null
  const selectedProduct = selected?.sourceProductId ? productById.get(selected.sourceProductId) : undefined
  const doRotate = useCallback(() => {
    if (!selectedId) return
    const r = rotateCase(placements, selectedId, ctx)
    if (r.ok) commit(r.placements)
    else say('warn', 'No room to turn it here. Drag it somewhere wider first.')
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
    } else say('warn', 'No free spot for another one.')
  }, [selectedId, placements, ctx, catalog, commit, say])
  const doUnits = useCallback(
    (n: number) => {
      if (!selectedId) return
      const r = setBlockUnits(placements, selectedId, n, ctx, catalog)
      if (r.ok) {
        commit(r.placements)
        setSelectedId(r.newId)
      } else say('warn', `${n} units don't fit there.`)
    },
    [selectedId, placements, ctx, catalog, commit, say],
  )
  const doFill = useCallback(() => {
    if (!selectedId) return
    const r = fillSlot(placements, selectedId, ctx, catalog)
    if (r.ok) {
      commit(r.placements)
      setSelectedId(r.newId)
      say('info', `Filled the space: ${r.units} units`)
    } else say('warn', 'Already fills the space.')
  }, [selectedId, placements, ctx, catalog, commit, say])
  const doOrient = useCallback(
    (to: 'upright' | 'sideways' | 'top') => {
      if (!selectedId) return
      if (to === 'top') {
        const r = moveToTopTray(placements, selectedId, ctx, catalog)
        if (r.ok) {
          commit(r.placements)
          setSelectedId(r.newId)
        } else say('warn', 'The top tray is full.')
        return
      }
      const r = setOrientation(placements, selectedId, to, ctx)
      if (r.ok) commit(r.placements)
      else say('warn', `No room to turn it ${to} here. Drag it somewhere wider first.`)
    },
    [selectedId, placements, ctx, catalog, commit, say],
  )
  const doAutoArrange = useCallback(() => {
    const r = autoArrange(placements, ctx, catalog)
    commit(r.placements)
    setSelectedId(null)
    say(r.dropped.length ? 'warn' : 'info', r.dropped.length ? `Arranged heavy to light. ${r.dropped.length} block(s) didn't fit.` : 'Arranged: heaviest on the bottom, long items on the top tray.')
  }, [placements, ctx, catalog, commit, say])

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

  // ---- stats --------------------------------------------------------------------
  const totals = useMemo(() => totalsOf(placements, catalog, palletDims.height), [placements, catalog, palletDims.height])
  const usage = useMemo(() => shelfUsage(surfaces, blockList), [surfaces, blockList])
  const problems = useMemo(() => blockList.filter((b) => validateBlock(b, surfaces, blockList)).length, [blockList, surfaces])
  const heavyIds = useMemo(() => heavyAboveLight(placements, ctx, catalog), [placements, ctx, catalog])
  const overWeight = totals.weight > PALLET_WEIGHT_LIMIT
  const overHeight = totals.height > maxDisplayHeight + 0.01
  const totalArea = surfaces.reduce((s, x) => s + x.area, 0)
  const usedArea = usage.reduce((s, x) => s + x.usedArea, 0)
  const fill = totalArea ? Math.min(1, usedArea / totalArea) : 0

  if (!project) return null

  const productList = (
    <ProductList
      catalog={catalog}
      programIds={[...(project.assortment ?? []).map((a) => a.productId), ...(retailer?.authorizedItems?.map((a) => a.productId) ?? [])]}
      placed={totals.byProduct}
      addMode={addMode}
      setAddMode={setAddMode}
      unitCount={unitCount}
      setUnitCount={setUnitCount}
      onAdd={(p) => handleAdd(p)}
    />
  )
  const summary = (
    <Summary
      totals={totals}
      usage={usage}
      surfaces={surfaces}
      fill={fill}
      maxDisplayHeight={maxDisplayHeight}
      overWeight={overWeight}
      overHeight={overHeight}
      heavy={heavyIds.size}
      problems={problems}
      placements={placements}
      productById={productById}
      onSelect={(id) => setSelectedId(id)}
      onAutoArrange={doAutoArrange}
    />
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#f4f5f7] text-[#111]">
      {/* ---- top bar ---- */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-2 md:gap-3 md:px-4">
        {onBack && (
          <IconBtn title="Back" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </IconBtn>
        )}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white sm:flex" style={{ background: KAYCO }}>
            K
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight">{(title ?? project.name).replace(/^Half 48×40$/, 'Half 48×20')}</p>
            <p className="hidden truncate text-[11px] leading-tight text-[#8a919c] sm:block">{subtitle ?? 'Saved automatically'}</p>
          </div>
        </div>
        <div className="mx-auto hidden items-center gap-2 md:flex">
          <Seg
            value={project.palletType}
            options={[
              { value: 'full', label: 'Full pallet' },
              { value: 'half', label: 'Half pallet' },
            ]}
            onChange={(t) => {
              const dropped = changeGeometry({ palletType: t })
              setSelectedId(null)
              if (dropped.length) say('warn', `${dropped.length} block(s) didn't fit the ${t} pallet and came off.`)
            }}
          />
          <div className="flex items-center rounded-lg bg-[#eef0f3] p-0.5 text-[12px]">
            <button className="rounded-md p-1 text-[#5f6672] hover:bg-white" title="Fewer shelves" onClick={() => changeGeometry({ tierCount: project.tierCount - 1 })}>
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 font-medium tabular-nums">{project.tierCount} levels</span>
            <button className="rounded-md p-1 text-[#5f6672] hover:bg-white" title="More shelves" onClick={() => changeGeometry({ tierCount: project.tierCount + 1 })}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </IconBtn>
          <span className="mx-1 hidden h-5 w-px bg-black/10 md:block" />
          {isHalf && (
            <IconBtn title="Move cubby dividers" onClick={() => setPanel(panel === 'dividers' ? null : 'dividers')} active={panel === 'dividers'}>
              <Columns3 className="h-4 w-4" />
              <span className="hidden lg:inline">Dividers</span>
            </IconBtn>
          )}
          <IconBtn title="Display artwork" onClick={() => setPanel(panel === 'art' ? null : 'art')} active={panel === 'art'}>
            <ImageIcon className="h-4 w-4" />
            <span className="hidden lg:inline">Artwork</span>
          </IconBtn>
          {onOpenPlan && (
            <IconBtn title="2D plan" onClick={onOpenPlan}>
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden lg:inline">2D plan</span>
            </IconBtn>
          )}
          <button
            onClick={doAutoArrange}
            disabled={!placements.length}
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: KAYCO }}
            title="Heaviest on the bottom, long items on the top tray"
            aria-label="Auto-arrange"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Auto-arrange</span>
          </button>
        </div>
        {panel === 'art' && <ArtPanel display={artDisplay} onClose={() => setPanel(null)} />}
        {panel === 'dividers' && isHalf && (
          <DividerPanel
            levels={surfaces.filter((s) => !s.isTop).map((s) => s.tier)}
            dividers={project.cubbyDividers}
            onChange={(levels, xs) => {
              const dropped = setDividers(levels, xs)
              if (dropped.length) say('warn', `${dropped.length} block(s) no longer fit and came off. Undo to bring them back.`)
            }}
            onClose={() => setPanel(null)}
          />
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* ---- products ---- */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-r border-black/[0.06] bg-white md:flex">{productList}</aside>

        {/* ---- the display ---- */}
        <main
          className="relative h-[52vh] shrink-0 md:h-auto md:min-h-0 md:flex-1"
          onDragOver={onCanvasDragOver}
          onDragLeave={() => setDropHint(false)}
          onDrop={onCanvasDrop}
        >
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
            cartons={false}
            showGrid={false}
            onSelect={setSelectedId}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            dividers={project.cubbyDividers}
            art={art}
            pickRef={pickRef}
          />

          {dropHint && (
            <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-[#0b3a7e]/40 bg-[#0b3a7e]/[0.03]" />
          )}

          {notice && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <div
                className={`flex max-w-[520px] items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium shadow-lg ${
                  notice.tone === 'warn' ? 'bg-[#fff7e6] text-[#8a5a00]' : 'bg-[#111] text-white'
                }`}
              >
                {notice.tone === 'warn' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                {notice.text}
              </div>
            </div>
          )}

          {/* camera */}
          <div className="absolute bottom-3 left-3">
            <Seg
              size="sm"
              value={view}
              options={[
                { value: '3d' as CameraView, label: '3D' },
                { value: 'front' as CameraView, label: 'Front' },
                { value: 'top' as CameraView, label: 'Top' },
              ]}
              onChange={(v) => {
                setView(v)
                setViewToken((t) => t + 1)
              }}
            />
          </div>

          {!placements.length && !dropHint && (
            <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
              <p className="rounded-full bg-white/90 px-4 py-2 text-center text-[12.5px] text-[#5f6672] shadow-sm">
                <span className="hidden md:inline">Drag a product onto a shelf, or press + to add a case</span>
                <span className="md:hidden">Tap + on a product to add a case</span>
              </p>
            </div>
          )}

          {selected && selectedProduct && (
            <SelectedCard
              placement={selected}
              product={selectedProduct}
              orientation={selectedBlock && surfaces.find((s) => s.tier === selectedBlock.tier)?.isTop ? 'top' : orientationOf(selectedBlock)}
              squish={isSquishable(selectedProduct)}
              onUnits={doUnits}
              onOrient={doOrient}
              onSquish={(on) => {
                const dropped = setSquish(selectedProduct.id, on)
                say('info', on ? `${selectedProduct.name}: squishable on. Packs about 20% tighter.` : `${selectedProduct.name}: rigid.`)
                if (dropped.length) say('warn', `${dropped.length} block(s) no longer fit and came off.`)
              }}
              onDuplicate={doDuplicate}
              onFill={doFill}
              onDelete={doDelete}
              onClose={() => setSelectedId(null)}
            />
          )}
        </main>

        {/* ---- summary (desktop) ---- */}
        <aside className="hidden w-[272px] shrink-0 flex-col overflow-y-auto border-l border-black/[0.06] bg-white lg:flex">{summary}</aside>

        {/* ---- phone: items / summary sheet ---- */}
        <section className="flex min-h-0 flex-1 flex-col border-t border-black/[0.06] bg-white md:hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <Seg
              value={mobileTab}
              options={[
                { value: 'items' as const, label: 'Products' },
                { value: 'summary' as const, label: `Summary · ${casesText(totals.cases)}` },
              ]}
              onChange={(v) => setMobileTab(v as 'items' | 'summary')}
            />
            <div className="ml-auto">
              <Seg
                size="sm"
                value={project.palletType}
                options={[
                  { value: 'full', label: 'Full' },
                  { value: 'half', label: 'Half' },
                ]}
                onChange={(t) => {
                  changeGeometry({ palletType: t })
                  setSelectedId(null)
                }}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{mobileTab === 'items' ? productList : summary}</div>
        </section>
      </div>
    </div>
  )
}

// ---- product list -----------------------------------------------------------------

function ProductList({
  catalog,
  programIds,
  placed,
  addMode,
  setAddMode,
  unitCount,
  setUnitCount,
  onAdd,
}: {
  catalog: Product[]
  programIds: string[]
  placed: Map<string, { cases: number; units: number }>
  addMode: AddMode
  setAddMode: (m: AddMode) => void
  unitCount: number
  setUnitCount: (n: number) => void
  onAdd: (p: Product) => void
}) {
  const [query, setQuery] = useState('')
  const program = useMemo(() => new Set(programIds), [programIds])
  const [scope, setScope] = useState<'program' | 'all'>(program.size ? 'program' : 'all')
  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const base = scope === 'program' && program.size ? catalog.filter((p) => program.has(p.id)) : catalog
    const filtered = words.length
      ? base.filter((p) => {
          const hay = `${p.name} ${p.sku} ${p.kaycoItemNumber ?? ''} ${p.upc ?? ''} ${p.brand ?? ''}`.toLowerCase()
          return words.every((w) => hay.includes(w))
        })
      : base
    return [...filtered].sort((a, b) => (placed.get(b.id)?.units ?? 0) - (placed.get(a.id)?.units ?? 0) || a.name.localeCompare(b.name)).slice(0, 60)
  }, [catalog, query, scope, program, placed])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3af]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="h-10 w-full rounded-xl bg-[#f1f3f6] pl-9 pr-8 text-[13.5px] outline-none placeholder:text-[#9aa3af] focus:bg-white focus:ring-2 focus:ring-[#0b3a7e]/20"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#9aa3af] hover:text-[#111]" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Seg
            size="sm"
            value={addMode}
            options={[
              { value: 'case' as AddMode, label: 'Case', title: 'Add a whole case' },
              { value: 'half' as AddMode, label: '½ case', title: 'Add half a case' },
              { value: 'units' as AddMode, label: 'Units', title: 'Add loose units' },
            ]}
            onChange={setAddMode}
          />
          {addMode === 'units' ? (
            <div className="flex items-center rounded-lg bg-[#eef0f3] p-0.5">
              <button className="rounded-md p-1 hover:bg-white" onClick={() => setUnitCount(Math.max(1, unitCount - 1))} aria-label="Fewer units">
                <Minus className="h-3 w-3" />
              </button>
              <input
                value={unitCount}
                onChange={(e) => setUnitCount(Math.max(1, Math.min(999, parseInt(e.target.value || '1', 10) || 1)))}
                className="w-8 bg-transparent text-center text-[12px] font-medium tabular-nums outline-none"
                aria-label="Units to add"
              />
              <button className="rounded-md p-1 hover:bg-white" onClick={() => setUnitCount(unitCount + 1)} aria-label="More units">
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : (
            program.size > 0 && (
              <button onClick={() => setScope(scope === 'program' ? 'all' : 'program')} className="text-[11.5px] font-medium text-[#0b3a7e] hover:underline">
                {scope === 'program' ? 'Show all items' : 'Program items'}
              </button>
            )
          )}
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {list.map((p) => {
          const here = placed.get(p.id)
          const upc = unitsPerCaseOf(p)
          return (
            <li
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/x-kayco-product', p.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className="group flex cursor-grab items-center gap-2.5 rounded-xl p-1.5 pr-2 hover:bg-[#f4f6f9] active:cursor-grabbing"
              title="Drag onto a shelf"
            >
              <Thumb url={p.imageUrl} size={48} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">{p.name}</p>
                <p className="mt-0.5 text-[11px] text-[#8a919c]">
                  {upc}/case
                  {here ? <span className="ml-1.5 font-semibold text-[#0b3a7e]">· {casesText(here.cases)} on pallet</span> : null}
                </p>
              </div>
              <button
                data-add-case
                onClick={() => onAdd(p)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2fa] text-[#0b3a7e] transition-colors hover:bg-[#0b3a7e] hover:text-white"
                aria-label={`Add ${p.name}`}
                title={addMode === 'case' ? 'Add a case' : addMode === 'half' ? 'Add half a case' : `Add ${unitCount} units`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          )
        })}
        {!list.length && <li className="px-3 py-8 text-center text-[12.5px] text-[#8a919c]">No products match “{query}”.</li>}
      </ul>
    </div>
  )
}

// ---- summary ------------------------------------------------------------------------

function Summary({
  totals,
  usage,
  surfaces,
  fill,
  maxDisplayHeight,
  overWeight,
  overHeight,
  heavy,
  problems,
  placements,
  productById,
  onSelect,
  onAutoArrange,
}: {
  totals: ReturnType<typeof totalsOf>
  usage: ReturnType<typeof shelfUsage>
  surfaces: { tier: number; isTop: boolean }[]
  fill: number
  maxDisplayHeight: number
  overWeight: boolean
  overHeight: boolean
  heavy: number
  problems: number
  placements: PlacedProduct[]
  productById: Map<string, Product>
  onSelect: (id: string) => void
  onAutoArrange: () => void
}) {
  const items = useMemo(() => {
    const rows = new Map<string, { product?: Product; label: string; units: number; firstId: string }>()
    for (const p of placements) {
      const key = p.sourceProductId ?? p.id
      const r = rows.get(key) ?? { product: p.sourceProductId ? productById.get(p.sourceProductId) : undefined, label: p.label ?? 'Item', units: 0, firstId: p.id }
      r.units += unitsIn(p)
      rows.set(key, r)
    }
    return [...rows.values()]
  }, [placements, productById])
  const stat = (label: string, value: string, warn?: boolean) => (
    <div className={`rounded-xl px-3 py-2.5 ${warn ? 'bg-[#fff4e5]' : 'bg-[#f4f6f9]'}`}>
      <p className="text-[11px] font-medium text-[#8a919c]">{label}</p>
      <p className={`text-[17px] font-semibold tabular-nums ${warn ? 'text-[#a35a00]' : ''}`}>{value}</p>
    </div>
  )
  const shelves = [...usage].sort((a, b) => b.tier - a.tier)
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2">
        {stat('Cases', fmt(totals.cases, totals.cases % 1 ? 1 : 0))}
        {stat('Units', fmt(totals.units))}
        {stat('Weight', `${fmt(totals.weight)} lb`, overWeight)}
        {stat('Height', `${fmt(totals.height, 0)}" / ${maxDisplayHeight}"`, overHeight)}
      </div>

      {(heavy > 0 || problems > 0 || overWeight || overHeight) && (
        <div className="space-y-1.5 rounded-xl bg-[#fff7e6] p-3 text-[12px] text-[#7a4b00]">
          {heavy > 0 && (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {heavy} heavy item{heavy === 1 ? '' : 's'} above lighter ones.{' '}
              <button className="font-semibold underline" onClick={onAutoArrange}>
                Fix
              </button>
            </p>
          )}
          {problems > 0 && <p className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problems} item(s) need a better spot</p>}
          {overWeight && <p className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Over the {PALLET_WEIGHT_LIMIT} lb limit</p>}
          {overHeight && <p className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Taller than {maxDisplayHeight}"</p>}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[12px] font-semibold">Shelves</h3>
          <span className="text-[11px] text-[#8a919c]">{Math.round(fill * 100)}% full</span>
        </div>
        <div className="space-y-1.5">
          {shelves.map((u) => {
            const s = surfaces.find((x) => x.tier === u.tier)
            return (
              <div key={u.tier} className="flex items-center gap-2 text-[11.5px]">
                <span className="w-14 shrink-0 text-[#5f6672]">{s?.isTop ? 'Top tray' : `Shelf ${u.tier}`}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f3]">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(u.fill * 100)}%`, background: u.fill > 0.98 ? '#16a34a' : KAYCO }} />
                </div>
                <span className="w-8 text-right tabular-nums text-[#8a919c]">{Math.round(u.fill * 100)}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {items.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[12px] font-semibold">On the pallet</h3>
          <ul className="space-y-0.5">
            {items.map((r) => {
              const upc = r.product ? unitsPerCaseOf(r.product) : 1
              return (
                <li key={r.firstId}>
                  <button onClick={() => onSelect(r.firstId)} className="flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-[#f4f6f9]">
                    <Thumb url={r.product?.imageUrl} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{r.label}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[#8a919c]">
                      {casesText(r.units / upc)} · {r.units}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---- selected item card ------------------------------------------------------------------

function SelectedCard({
  placement,
  product,
  orientation,
  squish,
  onUnits,
  onOrient,
  onSquish,
  onDuplicate,
  onFill,
  onDelete,
  onClose,
}: {
  placement: PlacedProduct
  product: Product
  orientation: 'upright' | 'sideways' | 'top'
  squish: boolean
  onUnits: (n: number) => void
  onOrient: (o: 'upright' | 'sideways' | 'top') => void
  onSquish: (on: boolean) => void
  onDuplicate: () => void
  onFill: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const units = unitsIn(placement)
  const upc = unitsPerCaseOf(product)
  return (
    <div className="absolute inset-x-2 bottom-12 z-10 mx-auto max-w-[460px] rounded-2xl bg-white p-3 shadow-[0_10px_40px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.05] md:bottom-4">
      <div className="flex items-start gap-3">
        <Thumb url={product.imageUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{product.name}</p>
          <p className="text-[11.5px] text-[#8a919c]">
            {units} unit{units === 1 ? '' : 's'} · {casesText(units / upc)} · {upc}/case
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[#9aa3af] hover:bg-[#f1f3f6] hover:text-[#111]" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg bg-[#eef0f3] p-0.5">
          <button className="rounded-md p-1.5 hover:bg-white" onClick={() => onUnits(units - 1)} disabled={units <= 1} aria-label="One less unit">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[2.5rem] text-center text-[12.5px] font-semibold tabular-nums">{units}</span>
          <button className="rounded-md p-1.5 hover:bg-white" onClick={() => onUnits(units + 1)} aria-label="One more unit">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button onClick={() => onUnits(upc)} className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${units === upc ? 'bg-[#e8eefb] text-[#0b3a7e]' : 'bg-[#f4f6f9] text-[#3d4450] hover:bg-[#eef0f3]'}`}>
          Case
        </button>
        <button onClick={() => onUnits(Math.ceil(upc / 2))} className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${units === Math.ceil(upc / 2) ? 'bg-[#e8eefb] text-[#0b3a7e]' : 'bg-[#f4f6f9] text-[#3d4450] hover:bg-[#eef0f3]'}`}>
          ½ case
        </button>
        <button onClick={onFill} className="rounded-lg bg-[#f4f6f9] px-2.5 py-1.5 text-[12px] font-medium text-[#3d4450] hover:bg-[#eef0f3]" title="As many units as fit in this cubby / slot">
          Fill space
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Seg
          size="sm"
          value={orientation}
          options={[
            { value: 'upright' as const, label: 'Upright', title: 'Face out' },
            { value: 'sideways' as const, label: 'Sideways', title: 'Turned so the end faces out' },
            { value: 'top' as const, label: 'Top tray', title: 'Move to the top tray' },
          ]}
          onChange={onOrient}
        />
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-[#3d4450]" title="Soft goods (chips, bags) squeeze together about 20%">
          <input type="checkbox" checked={squish} onChange={(e) => onSquish(e.target.checked)} className="h-3.5 w-3.5 accent-[#0b3a7e]" />
          Squishable
        </label>
      </div>
      <div className="mt-2.5 flex items-center gap-1 border-t border-black/[0.05] pt-2">
        <button onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-[#3d4450] hover:bg-[#f1f3f6]">
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <span className="ml-auto hidden text-[11px] text-[#9aa3af] md:inline">Drag to move · R turns · Del removes</span>
        <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-[#c2410c] hover:bg-[#fff1ea] md:ml-2">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </div>
  )
}

// ---- artwork -------------------------------------------------------------------------------

function ArtPanel({ display, onClose }: { display: ArtDisplay; onClose: () => void }) {
  const custom = useArtStore((s) => s.custom)
  const setArt = useArtStore((s) => s.setArt)
  const [error, setError] = useState<string | null>(null)
  const upload = async (slot: ArtSlot, file?: File | null) => {
    if (!file) return
    try {
      setError(null)
      setArt(display, slot, await fileToArtDataUrl(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }
  return (
    <div className="absolute right-2 top-[60px] z-30 w-[min(400px,calc(100vw-16px))] rounded-2xl bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.06]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Display artwork</h3>
          <p className="text-[11.5px] text-[#8a919c]">{display === 'half' ? 'Half pallet' : 'Full pallet'} · upload each promo's print art</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[#9aa3af] hover:bg-[#f1f3f6]" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2.5">
        {ART_SLOTS[display].map(({ slot, label, hint }) => {
          const url = artUrl(custom, display, slot)
          const isCustom = !!custom[display]?.[slot]
          return (
            <div key={slot} className="flex items-center gap-3 rounded-xl bg-[#f6f7f9] p-2">
              <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.06]">
                {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-[#c0c5cc]" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium">{label}</p>
                <p className="truncate text-[11px] text-[#8a919c]">{isCustom ? 'Your upload' : 'From your photos'} · {hint}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white px-2 py-1 text-[11.5px] font-medium ring-1 ring-black/[0.08] hover:bg-[#f1f3f6]">
                  <Upload className="h-3 w-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(slot, e.target.files?.[0])} />
                </label>
                {isCustom && (
                  <button onClick={() => setArt(display, slot, null)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-[#5f6672] hover:bg-white">
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="mt-2 text-[11.5px] text-[#c2410c]">{error}</p>}
      <p className="mt-3 text-[11px] text-[#9aa3af]">Saved in this browser. The original print files give the sharpest result.</p>
    </div>
  )
}

// ---- cubby dividers -------------------------------------------------------------------------

function DividerPanel({
  levels,
  dividers,
  onChange,
  onClose,
}: {
  levels: number[]
  dividers?: Record<number, number[]>
  onChange: (levels: number[], xs: number[]) => void
  onClose: () => void
}) {
  const { x0, x1 } = halfInner()
  const span = x1 - x0
  const ordered = [...levels].sort((a, b) => b - a)
  return (
    <div className="absolute right-2 top-[60px] z-30 w-[min(460px,calc(100vw-16px))] rounded-2xl bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.06]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Cubby dividers</h3>
          <p className="text-[11.5px] text-[#8a919c]">Drag a divider to move it. Any number of items can share a cubby.</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[#9aa3af] hover:bg-[#f1f3f6]" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {ordered.map((level) => (
          <DividerRow
            key={level}
            level={level}
            xs={dividersFor(dividers, level)}
            x0={x0}
            span={span}
            onCommit={(xs) => onChange([level], xs)}
            onAll={(xs) => onChange(levels, xs)}
          />
        ))}
      </div>
    </div>
  )
}

function DividerRow({
  level,
  xs,
  x0,
  span,
  onCommit,
  onAll,
}: {
  level: number
  xs: number[]
  x0: number
  span: number
  onCommit: (xs: number[]) => void
  onAll: (xs: number[]) => void
}) {
  const [draft, setDraft] = useState<number[] | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const shown = draft ?? xs
  const cubbies = shown.length + 1
  const startDrag = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    const el = bar.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let current = [...shown]
    const move = (ev: PointerEvent) => {
      const x = x0 + ((ev.clientX - rect.left) / rect.width) * span
      const lo = (i > 0 ? current[i - 1] : x0) + MIN_CUBBY + 0.35
      const hi = (i < current.length - 1 ? current[i + 1] : x0 + span) - MIN_CUBBY - 0.35
      current = current.map((v, k) => (k === i ? Math.round(Math.max(lo, Math.min(hi, x)) * 4) / 4 : v))
      setDraft(current)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDraft(null)
      onCommit(current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const edges = [x0, ...shown, x0 + span]
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[12px]">
        <span className="w-14 font-medium">Shelf {level}</span>
        <div className="flex items-center rounded-lg bg-[#eef0f3] p-0.5">
          <button className="rounded-md p-1 hover:bg-white disabled:opacity-30" disabled={cubbies <= 1} onClick={() => onCommit(evenDividers(cubbies - 1))} aria-label="Fewer cubbies">
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-16 text-center tabular-nums">{cubbies} cubb{cubbies === 1 ? 'y' : 'ies'}</span>
          <button className="rounded-md p-1 hover:bg-white disabled:opacity-30" disabled={cubbies >= 8} onClick={() => onCommit(evenDividers(cubbies + 1))} aria-label="More cubbies">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <button className="ml-auto text-[11px] text-[#5f6672] hover:text-[#111]" onClick={() => onCommit(evenDividers(cubbies))}>
          Even
        </button>
        <button className="text-[11px] font-medium text-[#0b3a7e] hover:underline" onClick={() => onAll(shown)}>
          Copy to all
        </button>
      </div>
      <div ref={bar} className="relative h-9 select-none rounded-lg bg-[#e6f7fa] ring-1 ring-[#05b5d3]/30">
        {edges.slice(0, -1).map((e, k) => {
          const w = edges[k + 1] - e
          return (
            <span
              key={k}
              className="absolute top-1/2 -translate-y-1/2 text-center text-[10.5px] tabular-nums text-[#0a7f93]"
              style={{ left: `${((e - x0) / span) * 100}%`, width: `${(w / span) * 100}%` }}
            >
              {fmt(w, w % 1 ? 1 : 0)}"
            </span>
          )
        })}
        {shown.map((x, i) => (
          <button
            key={i}
            onPointerDown={startDrag(i)}
            className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize touch-none"
            style={{ left: `${((x - x0) / span) * 100}%` }}
            aria-label={`Divider ${i + 1}`}
          >
            <span className="mx-auto block h-full w-1 rounded-full bg-[#0a7f93]" />
          </button>
        ))}
      </div>
    </div>
  )
}
