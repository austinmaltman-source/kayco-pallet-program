// Bridges the app's PlacedProduct records and the placement engine's
// blocks, and implements every builder edit as a pure function
// (placements in -> placements out) so the React layer only commits them.

import { nanoid } from 'nanoid'
import type { PalletType, PlacedProduct, Product, TrayFace } from '../../types'
import {
  type Block,
  type ShelfSurface,
  type SnapOptions,
  DEFAULT_SNAP,
  EPS,
  FACE_QUARTER,
  buildSurfaces,
  faceAt,
  findFreeSpot,
  normQ,
  resolvePlacement,
  rotatedFootprint,
  settleBlocks,
  validateBlock,
} from './placement-engine'
import type { DividerMap } from './display-spec'
import { BUILDER_TAG, type CaseLayout, caseSpecFor, layoutOptions, merchLayouts } from './case-spec'

export interface BuilderContext {
  palletType: PalletType
  tierCount: number
  palletHeight: number
  maxDisplayHeight: number
  // half pallet cubby dividers per shelf (see display-spec DividerMap)
  dividers?: DividerMap
}

export function surfacesFor(ctx: BuilderContext): ShelfSurface[] {
  return buildSurfaces(ctx.palletType, ctx.tierCount, ctx.palletHeight, ctx.maxDisplayHeight, ctx.dividers)
}

export function yawToQuaternion(rotQ: number): [number, number, number, number] {
  const theta = (normQ(rotQ) * Math.PI) / 2
  return [0, Math.sin(theta / 2), 0, Math.cos(theta / 2)]
}

export function quaternionToRotQ(q?: [number, number, number, number]) {
  if (!q) return 0
  const [x, y, z, w] = q
  // Yaw of an (approximately) upright quaternion.
  const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x))
  return normQ(Math.round(yaw / (Math.PI / 2)))
}

// The shelf a placement rests on: the highest platform at or below its base.
export function tierForY(y: number, surfaces: ShelfSurface[]) {
  let best = surfaces[0]
  for (const s of surfaces) if (s.y <= y + 0.5) best = s
  return best?.tier ?? 1
}

export function placementToBlock(p: PlacedProduct, surfaces: ShelfSurface[]): Block | null {
  if (!p.position) return null
  const rotQ = quaternionToRotQ(p.quaternion)
  const { w, d } = rotatedFootprint(p.width, p.depth, rotQ)
  const tier = p.tier && surfaces.some((s) => s.tier === p.tier) && p.slotId?.startsWith(BUILDER_TAG)
    ? p.tier
    : tierForY(p.position[1], surfaces)
  return { id: p.id, tier, x: p.position[0], z: p.position[2], y: p.position[1], w, d, h: p.height, rotQ }
}

export function blocksOf(placements: PlacedProduct[], surfaces: ShelfSurface[]) {
  return placements.map((p) => placementToBlock(p, surfaces)).filter((b): b is Block => !!b)
}

function applyBlock(p: PlacedProduct, b: Block, surfaces: ShelfSurface[]): PlacedProduct {
  const s = surfaces.find((entry) => entry.tier === b.tier)
  return {
    ...p,
    position: [round2(b.x), round2(b.y), round2(b.z)],
    quaternion: yawToQuaternion(b.rotQ),
    tier: b.tier,
    wall: s ? faceAt(b.x, b.z, s) : p.wall,
    spawnAsleep: true,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function makeCasePlacement(
  product: Product,
  block: Block,
  surfaces: ShelfSurface[],
  layout?: CaseLayout | null,
  units?: number,
): PlacedProduct {
  const spec = caseSpecFor(product, layout, units)
  const base: PlacedProduct = {
    id: nanoid(10),
    sourceProductId: product.id,
    slotId: `${BUILDER_TAG}:${product.id}`,
    width: round2(spec.case.width),
    height: round2(spec.case.height),
    depth: round2(spec.case.depth),
    color: product.brandColor,
    label: product.name,
    sku: product.sku,
    category: product.category,
    imageUrl: product.imageUrl,
    modelUrl: product.modelUrl,
    packaging: product.packaging,
    caseConfig: {
      unitProductId: product.id,
      layout: spec.layout,
      caseStyle: 'tray',
      innerPadding: 0.25,
      dividers: false,
      ...(spec.squish < 1 ? { squish: spec.squish } : {}),
    },
    renderStyle: 'case',
    facings: spec.layout.cols,
    rows: spec.layout.rows,
    layers: spec.layout.layers,
    quantity: spec.unitsPerCase,
  }
  return applyBlock(base, block, surfaces)
}

export interface AddResult {
  placements: PlacedProduct[]
  added: number
  requested: number
  addedIds: string[]
}

// Add `count` cases of a product, each in the first free spot (bottom-left
// fill, front face first). Stops early when nothing fits.
// How deep and how tall a block may be to fit the shelves it is aimed at
// (the ring of a full pallet's trays, a half pallet's cubby, a given tier).
export function shelfLimits(surfaces: ShelfSurface[], tier?: number) {
  const pool = surfaces.filter((s) => (tier != null ? s.tier === tier : !s.isTop))
  const use = pool.length ? pool : surfaces
  let depth = Infinity
  let height = Infinity
  for (const s of use) {
    const dz = s.cubbies || !s.core ? s.outer.z1 - s.outer.z0 : s.outer.z1 - s.core.z1
    depth = Math.min(depth, dz)
    height = Math.min(height, s.clearance)
  }
  return { depth: Number.isFinite(depth) ? depth : 20, height: Number.isFinite(height) ? height : 12 }
}

// Add `count` blocks (a case, half case or N loose units each) of a product.
// Units are merchandised face-out and packed back-to-front to the shelf
// depth. A block that fits nowhere whole (a case of 6 boxes is wider than a
// 9" cubby) is split across neighbouring spots, the way a merchandiser
// would put the case's units into two cubbies; counts stay exact.
export function addCases(
  placements: PlacedProduct[],
  product: Product,
  count: number,
  ctx: BuilderContext,
  prefs: { tier?: number; face?: TrayFace; gap?: number; onlyTier?: number; onlyFace?: TrayFace; noStack?: boolean; cubby?: number; onlyCubby?: number; unitsPerBlock?: number; noSplit?: boolean } = {},
): AddResult {
  const surfaces = surfacesFor(ctx)
  const units = prefs.unitsPerBlock
  const preferred = caseSpecFor(product, null, units)
  // Long items (Gefen honey cake) go on the top tray unless aimed elsewhere.
  if (prefs.tier == null && prefs.onlyTier == null && prefersTopTray(product, surfaces)) {
    const top = surfaces.find((x) => x.isTop)
    if (top) prefs = { ...prefs, tier: top.tier }
  }
  const limits = shelfLimits(surfaces, prefs.onlyTier ?? prefs.tier)
  let next = placements
  let blocks = blocksOf(next, surfaces)
  const addedIds: string[] = []
  const layoutsFor = (n: number) => merchLayouts(n, preferred.unit, limits.depth, limits.height)

  // Place n units as ONE block; returns the new placement id or null.
  const placeBlock = (n: number): string | null => {
    const sameProduct = new Set(next.filter((p) => p.sourceProductId === product.id).map((p) => p.id))
    for (const layout of layoutsFor(n)) {
      const spec = caseSpecFor(product, layout, n)
      const spot = findFreeSpot(
        { width: spec.case.width, depth: spec.case.depth, height: spec.case.height },
        surfaces,
        blocks,
        {
          preferTier: prefs.tier,
          preferFace: prefs.face,
          gap: prefs.gap,
          stackOnIds: sameProduct,
          onlyTier: prefs.onlyTier,
          onlyFace: prefs.onlyFace,
          allowStack: !prefs.noStack,
          preferCubby: prefs.cubby,
          onlyCubby: prefs.onlyCubby,
        },
      )
      if (!spot) continue
      const placement = makeCasePlacement(product, spot, surfaces, layout, n)
      next = [...next, placement]
      blocks = [...blocks, { ...spot, id: placement.id }]
      return placement.id
    }
    return null
  }

  let added = 0
  for (let i = 0; i < count; i += 1) {
    const n = preferred.unitsPerCase
    const whole = placeBlock(n)
    if (whole) {
      addedIds.push(whole)
      added += 1
      continue
    }
    if (prefs.noSplit || n < 2) break
    // Split: the biggest part that fits, then the rest, until all units are
    // down. Roll back if the case cannot be fully placed.
    const before = { next, blocks, ids: addedIds.length }
    let left = n
    let ok = true
    while (left > 0) {
      let placedPart = false
      for (let k = left; k >= 1; k -= 1) {
        if (k === n) continue
        const id = placeBlock(k)
        if (id) {
          addedIds.push(id)
          left -= k
          placedPart = true
          break
        }
      }
      if (!placedPart) {
        ok = false
        break
      }
    }
    if (!ok) {
      next = before.next
      blocks = before.blocks
      addedIds.length = before.ids
      break
    }
    added += 1
  }
  return { placements: next, added, requested: count, addedIds }
}

// Live preview of a drag: where the case would land and whether it may.
export function previewMove(
  placements: PlacedProduct[],
  id: string,
  target: { tier: number; x: number; z: number; stack: boolean; rotQ?: number },
  ctx: BuilderContext,
  snapOptions: SnapOptions = DEFAULT_SNAP,
) {
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  const current = blocks.find((b) => b.id === id)
  if (!current) return null
  const placement = placements.find((p) => p.id === id)!
  // Moving to another face of a full pallet turns the case to face that aisle,
  // keeping any extra quarter turns the user gave it.
  const fromSurface = surfaces.find((s) => s.tier === current.tier)
  const toSurface = surfaces.find((s) => s.tier === target.tier)
  let rotQ = target.rotQ ?? current.rotQ
  if (target.rotQ == null && fromSurface && toSurface) {
    const fromFace = faceAt(current.x, current.z, fromSurface)
    const toFace = faceAt(target.x, target.z, toSurface)
    if (fromFace !== toFace) rotQ = normQ(rotQ - FACE_QUARTER[fromFace] + FACE_QUARTER[toFace])
  }
  const { w, d } = rotatedFootprint(placement.width, placement.depth, rotQ)
  const draft: Block = { ...current, tier: target.tier, x: target.x, z: target.z, w, d, rotQ }
  // Cases resting on the moved case are not obstacles for it.
  const riders = ridersOf(id, blocks)
  const others = blocks.filter((b) => !riders.has(b.id))
  return resolvePlacement(draft, surfaces, others, snapOptions, target.stack ? 'stack' : 'floor')
}

// Everything stacked (directly or indirectly) on top of a block.
export function ridersOf(id: string, blocks: Block[]) {
  const out = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const baseId = queue.shift()!
    const base = blocks.find((b) => b.id === baseId)
    if (!base) continue
    for (const b of blocks) {
      if (out.has(b.id) || b.id === id || b.tier !== base.tier) continue
      if (Math.abs(b.y - (base.y + base.h)) > 0.05) continue
      const overlapX = Math.min(b.x + b.w / 2, base.x + base.w / 2) - Math.max(b.x - b.w / 2, base.x - base.w / 2)
      const overlapZ = Math.min(b.z + b.d / 2, base.z + base.d / 2) - Math.max(b.z - b.d / 2, base.z - base.d / 2)
      if (overlapX > EPS && overlapZ > EPS) {
        out.add(b.id)
        queue.push(b.id)
      }
    }
  }
  return out
}

// Commit a move. Cases riding on the moved case travel with it (a column of
// stacked cases moves as one); everything else settles under gravity.
export function commitMove(
  placements: PlacedProduct[],
  id: string,
  landed: Block,
  ctx: BuilderContext,
): PlacedProduct[] {
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  const current = blocks.find((b) => b.id === id)
  if (!current) return placements
  const riders = ridersOf(id, blocks)
  const dx = landed.x - current.x
  const dz = landed.z - current.z
  const dy = landed.y - current.y
  const turned = landed.rotQ !== current.rotQ || landed.tier !== current.tier
  let moved = blocks.map((b) => {
    if (b.id === id) return landed
    if (riders.has(b.id) && !turned) return { ...b, x: b.x + dx, z: b.z + dz, y: b.y + dy, tier: landed.tier }
    return b
  })
  // Riders that would now collide or hang off (or when the base turned /
  // changed shelf) drop off and settle where they are instead.
  moved = settleBlocks(moved, surfaces)
  const byId = new Map(moved.map((b) => [b.id, b]))
  return placements.map((p) => {
    const b = byId.get(p.id)
    return b ? applyBlock(p, b, surfaces) : p
  })
}

export function rotateCase(placements: PlacedProduct[], id: string, ctx: BuilderContext) {
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  const current = blocks.find((b) => b.id === id)
  const placement = placements.find((p) => p.id === id)
  if (!current || !placement) return { placements, ok: false }
  const rotQ = normQ(current.rotQ + 1)
  const { w, d } = rotatedFootprint(placement.width, placement.depth, rotQ)
  const others = blocks.filter((b) => b.id !== id && !ridersOf(id, blocks).has(b.id))
  const result = resolvePlacement(
    { ...current, w, d, rotQ },
    surfaces,
    others,
    { ...DEFAULT_SNAP, magnet: 0 },
    current.y > (surfaces.find((s) => s.tier === current.tier)?.y ?? 0) + EPS ? 'stack' : 'floor',
  )
  if (result.invalid) return { placements, ok: false }
  return { placements: commitMove(placements, id, result.block, ctx), ok: true }
}

export function removeCases(placements: PlacedProduct[], ids: string[], ctx: BuilderContext) {
  const surfaces = surfacesFor(ctx)
  const drop = new Set(ids)
  const kept = placements.filter((p) => !drop.has(p.id))
  const settled = settleBlocks(blocksOf(kept, surfaces), surfaces)
  const byId = new Map(settled.map((b) => [b.id, b]))
  return kept.map((p) => {
    const b = byId.get(p.id)
    return b && p.position && Math.abs(b.y - p.position[1]) > EPS ? applyBlock(p, b, surfaces) : p
  })
}

export function duplicateCase(
  placements: PlacedProduct[],
  id: string,
  ctx: BuilderContext,
  catalog: Product[],
) {
  const placement = placements.find((p) => p.id === id)
  if (!placement) return { placements, newId: null as string | null }
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  const current = blocks.find((b) => b.id === id)
  if (!current) return { placements, newId: null }
  // Try right next to the original first, then anywhere.
  const s = surfaces.find((entry) => entry.tier === current.tier)!
  const face = faceAt(current.x, current.z, s)
  const step = face === 'front' || face === 'back' ? [current.w, 0] : [0, current.d]
  const tries = [
    [step[0], step[1]],
    [-step[0], -step[1]],
  ]
  const clone = { ...placement, id: nanoid(10) }
  for (const [dx, dz] of tries) {
    const result = resolvePlacement(
      { ...current, id: clone.id, x: current.x + dx, z: current.z + dz },
      surfaces,
      blocks,
      DEFAULT_SNAP,
      'floor',
      6,
    )
    if (!result.invalid) {
      return { placements: [...placements, applyBlock(clone, result.block, surfaces)], newId: clone.id }
    }
  }
  const product = catalog.find((p) => p.id === placement.sourceProductId)
  if (product) {
    const added = addCases(placements, product, 1, ctx, { tier: current.tier, face })
    return { placements: added.placements, newId: added.addedIds[0] ?? null }
  }
  return { placements, newId: null }
}

// Cycle how the units sit in the case (e.g. 8 = 4x2 -> 8x1 -> 2x4 ...).
export function cycleArrangement(
  placements: PlacedProduct[],
  id: string,
  ctx: BuilderContext,
  catalog: Product[],
) {
  const placement = placements.find((p) => p.id === id)
  const product = catalog.find((p) => p.id === placement?.sourceProductId)
  if (!placement || !product) return { placements, ok: false }
  const blockUnits = placement.caseConfig
    ? placement.caseConfig.layout.cols * placement.caseConfig.layout.rows * placement.caseConfig.layout.layers
    : 1
  const options = layoutOptions(blockUnits)
  if (options.length < 2) return { placements, ok: false }
  const cur = placement.caseConfig?.layout
  const idx = options.findIndex((o) => cur && o.cols === cur.cols && o.rows === cur.rows && o.layers === cur.layers)
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  const current = blocks.find((b) => b.id === id)
  if (!current) return { placements, ok: false }
  for (let k = 1; k < options.length; k += 1) {
    const layout = options[(idx + k + options.length) % options.length]
    const nextSpec = caseSpecFor(product, layout, blockUnits)
    const { w, d } = rotatedFootprint(nextSpec.case.width, nextSpec.case.depth, current.rotQ)
    const others = blocks.filter((b) => b.id !== id)
    const result = resolvePlacement(
      { ...current, w, d, h: nextSpec.case.height },
      surfaces,
      others,
      { ...DEFAULT_SNAP, magnet: 0 },
      current.y > (surfaces.find((s) => s.tier === current.tier)?.y ?? 0) + EPS ? 'stack' : 'floor',
    )
    if (result.invalid) continue
    const updated: PlacedProduct = {
      ...placement,
      width: round2(nextSpec.case.width),
      height: round2(nextSpec.case.height),
      depth: round2(nextSpec.case.depth),
      caseConfig: { ...(placement.caseConfig ?? { unitProductId: product.id, caseStyle: 'tray', innerPadding: 0.25, dividers: false }), layout },
      facings: layout.cols,
      rows: layout.rows,
      layers: layout.layers,
    }
    const replaced = placements.map((p) => (p.id === id ? updated : p))
    return { placements: commitMove(replaced, id, result.block, ctx), ok: true, layout }
  }
  return { placements, ok: false }
}

// Nudge by whole grid steps (arrow keys). Refuses moves that collide.
export function nudgeCase(
  placements: PlacedProduct[],
  id: string,
  dx: number,
  dz: number,
  ctx: BuilderContext,
) {
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  const current = blocks.find((b) => b.id === id)
  if (!current) return { placements, ok: false }
  const riders = ridersOf(id, blocks)
  const others = blocks.filter((b) => b.id !== id && !riders.has(b.id))
  const s = surfaces.find((entry) => entry.tier === current.tier)!
  const moved: Block = { ...current, x: current.x + dx, z: current.z + dz }
  const onFloor = current.y <= s.y + EPS
  const y = onFloor ? s.y : current.y
  const candidate = { ...moved, y }
  if (validateBlock(candidate, surfaces, others)) return { placements, ok: false }
  return { placements: commitMove(placements, id, candidate, ctx), ok: true }
}

// Re-seat every case after the shelf geometry changed (half <-> full, tier
// count): cases that still fit stay, the rest are re-placed in free spots;
// the ones that fit nowhere are reported back.
export function reflowForGeometry(
  placements: PlacedProduct[],
  ctx: BuilderContext,
  catalog?: Product[],
): { placements: PlacedProduct[]; dropped: PlacedProduct[] } {
  const surfaces = surfacesFor(ctx)
  const kept: PlacedProduct[] = []
  const dropped: PlacedProduct[] = []
  let blocks: Block[] = []
  const ordered = [...placements].sort((a, b) => (a.position?.[1] ?? 0) - (b.position?.[1] ?? 0))
  for (const p of ordered) {
    const b = placementToBlock(p, surfaces)
    if (!b) {
      kept.push(p)
      continue
    }
    const s = surfaces.find((entry) => entry.tier === b.tier)
    let candidate: Block | null = s ? { ...b, y: s.y } : null
    if (candidate) {
      const r = resolvePlacement(candidate, surfaces, blocks, { ...DEFAULT_SNAP, magnet: 0 }, 'floor', 8)
      candidate = r.invalid ? null : r.block
    }
    if (!candidate) {
      const spot = findFreeSpot({ width: p.width, depth: p.depth, height: p.height }, surfaces, blocks, {})
      candidate = spot ? { ...spot, id: p.id } : null
    }
    if (!candidate) {
      dropped.push(p)
      continue
    }
    blocks = [...blocks, { ...candidate, id: p.id }]
    kept.push(applyBlock(p, { ...candidate, id: p.id }, surfaces))
  }
  // A block that no longer fits as it was gets re-laid-out (another unit
  // arrangement, or split over two spots) before it is given up on.
  if (catalog && dropped.length) {
    let next = kept
    const still: PlacedProduct[] = []
    for (const p of dropped) {
      const product = p.sourceProductId ? catalog.find((c) => c.id === p.sourceProductId) : undefined
      const units = p.caseConfig ? p.caseConfig.layout.cols * p.caseConfig.layout.rows * p.caseConfig.layout.layers : 1
      const r = product && p.caseConfig ? addCases(next, product, 1, ctx, { unitsPerBlock: units }) : null
      if (r && r.added) next = r.placements
      else still.push(p)
    }
    return { placements: next, dropped: still }
  }
  return { placements: kept, dropped }
}

export interface BuilderTotals {
  cases: number
  units: number
  weight: number
  height: number
  byProduct: Map<string, { cases: number; units: number }>
}

export function totalsOf(
  placements: PlacedProduct[],
  catalog: Product[],
  palletHeight: number,
): BuilderTotals {
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const byProduct = new Map<string, { cases: number; units: number }>()
  let cases = 0
  let units = 0
  let weight = 0
  let height = palletHeight
  for (const p of placements) {
    if (p.subunit) continue
    const product = p.sourceProductId ? byId.get(p.sourceProductId) : undefined
    const isCase = !!p.caseConfig
    const unitsHere = isCase
      ? p.caseConfig!.layout.cols * p.caseConfig!.layout.rows * p.caseConfig!.layout.layers
      : 1
    const upc = Math.max(1, Math.round(product?.unitsPerCase ?? (isCase ? unitsHere : 1)))
    const caseFraction = unitsHere / upc
    cases += caseFraction
    units += unitsHere
    weight += (product?.weight ?? 0) * unitsHere
    if (p.position) height = Math.max(height, p.position[1] + p.height)
    const key = p.sourceProductId ?? p.sku
    const entry = byProduct.get(key) ?? { cases: 0, units: 0 }
    entry.cases += caseFraction
    entry.units += unitsHere
    byProduct.set(key, entry)
  }
  return { cases, units, weight, height, byProduct }
}


// ---- weight ordering ("heavy stuff always goes on the bottom") -------------

export function caseWeightOf(p: PlacedProduct, catalog: Map<string, Product>) {
  const units = p.caseConfig
    ? p.caseConfig.layout.cols * p.caseConfig.layout.rows * p.caseConfig.layout.layers
    : 1
  return unitWeightOf(p, catalog) * units
}

// "Heavy" is about the item itself (a 64oz bottle vs a box of biscuits), so
// ordering compares per-unit weight.
export function unitWeightOf(p: PlacedProduct, catalog: Map<string, Product>) {
  const product = p.sourceProductId ? catalog.get(p.sourceProductId) : undefined
  if (!product) return 0
  const spec = caseSpecFor(product)
  return spec.unitWeight || spec.caseWeight / Math.max(1, spec.unitsPerCase)
}

function clearlyHeavier(a: number, b: number) {
  return a > b * 1.5 + 0.25
}

// Cases sitting higher than a clearly lighter item (on a higher shelf, or
// stacked on top of it). Returns the ids of the heavy cases out of order.
export function heavyAboveLight(placements: PlacedProduct[], ctx: BuilderContext, catalog: Product[]) {
  const surfaces = surfacesFor(ctx)
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const blocks = blocksOf(placements, surfaces)
  const weight = new Map(placements.map((p) => [p.id, unitWeightOf(p, byId)]))
  const out = new Set<string>()
  for (const a of blocks) {
    const wa = weight.get(a.id) ?? 0
    for (const b of blocks) {
      if (a.id === b.id) continue
      const wb = weight.get(b.id) ?? 0
      if (!clearlyHeavier(wa, wb)) continue
      const higherShelf = a.tier > b.tier
      const stackedOn = a.tier === b.tier && ridersOf(b.id, blocks).has(a.id)
      if (higherShelf || stackedOn) {
        out.add(a.id)
        break
      }
    }
  }
  // Only worth a warning when the heavy case could actually go lower: if no
  // lower shelf has room for it, it is where it has to be.
  for (const id of [...out]) {
    const a = blocks.find((b) => b.id === id)!
    const p = placements.find((q) => q.id === id)!
    const others = blocks.filter((b) => b.id !== id && !ridersOf(id, blocks).has(b.id))
    const lower = surfaces.filter((s) => s.tier < a.tier || (s.tier === a.tier && a.y > s.y + 0.01))
    const spot = findFreeSpot({ width: p.width, depth: p.depth, height: p.height }, lower, others, { allowStack: false })
    if (!spot || spot.tier >= a.tier) out.delete(id)
  }
  return out
}

// Re-place every case from scratch: heaviest items first so they take the
// bottom shelves, each product's cases kept together, packed edge to edge
// along each side (front first). A lighter item never goes on a lower shelf
// than a clearly heavier one. Cases that fit nowhere are returned.
// Items too long to stand face-out in a cubby/shelf slot (Austin: "Gefen
// honey cake usually go on top but we also do put things sideways sometimes").
export function prefersTopTray(product: Product, surfaces: ShelfSurface[]) {
  if (/HONEY\s*CAKE|LOAF|SPONGE\s*CAKE/i.test(product.name ?? '')) return true
  const unit = caseSpecFor(product, null, 1).trueUnit
  const widest = Math.max(
    0,
    ...surfaces.filter((x) => !x.isTop).flatMap((x) => (x.cubbies ?? [x.outer]).map((c) => c.x1 - c.x0)),
  )
  return surfaces.some((x) => x.cubbies) ? unit.width > widest - 0.2 : unit.width > 11
}

export type Orientation = 'upright' | 'sideways'

export function orientationOf(block: Pick<Block, 'rotQ'> | null | undefined): Orientation {
  return block && normQ(block.rotQ) % 2 === 1 ? 'sideways' : 'upright'
}

// Upright = face-out; sideways = turned a quarter so the end/spine faces out
// (fits long items into a narrow cubby).
export function setOrientation(placements: PlacedProduct[], id: string, to: Orientation, ctx: BuilderContext) {
  const surfaces = surfacesFor(ctx)
  const block = blocksOf(placements, surfaces).find((b) => b.id === id)
  if (!block) return { placements, ok: false }
  if (orientationOf(block) === to) return { placements, ok: true }
  return rotateCase(placements, id, ctx)
}

// Move one placed block onto the top tray (same units, best arrangement).
export function moveToTopTray(placements: PlacedProduct[], id: string, ctx: BuilderContext, catalog: Product[]) {
  const surfaces = surfacesFor(ctx)
  const top = surfaces.find((x) => x.isTop)
  const p = placements.find((q) => q.id === id)
  const product = p?.sourceProductId ? catalog.find((c) => c.id === p.sourceProductId) : undefined
  if (!top || !p || !product) return { placements, ok: false, newId: null as string | null }
  const units = p.caseConfig ? p.caseConfig.layout.cols * p.caseConfig.layout.rows * p.caseConfig.layout.layers : 1
  const without = removeCases(placements, [id], ctx)
  const r = addCases(without, product, 1, ctx, { onlyTier: top.tier, unitsPerBlock: units, noSplit: true })
  if (!r.added) return { placements, ok: false, newId: null }
  return { placements: r.placements, ok: true, newId: r.addedIds[0] ?? null }
}

// Change a placed block's unit count (the popover's - / + / Case / Half).
export function setBlockUnits(
  placements: PlacedProduct[],
  id: string,
  units: number,
  ctx: BuilderContext,
  catalog: Product[],
) {
  const p = placements.find((q) => q.id === id)
  const product = p?.sourceProductId ? catalog.find((c) => c.id === p.sourceProductId) : undefined
  if (!p || !product) return { placements, ok: false, newId: null as string | null }
  const n = Math.max(1, Math.round(units))
  const surfaces = surfacesFor(ctx)
  const block = blocksOf(placements, surfaces).find((b) => b.id === id)
  const without = removeCases(placements, [id], ctx)
  const r = addCases(without, product, 1, ctx, {
    tier: block?.tier,
    unitsPerBlock: n,
    face: block ? faceAt(block.x, block.z, surfaces.find((x) => x.tier === block.tier)!) : undefined,
    cubby: block ? cubbyIndexOf(block, surfaces) ?? undefined : undefined,
  })
  if (!r.added) return { placements, ok: false, newId: null }
  return { placements: r.placements, ok: true, newId: r.addedIds[r.addedIds.length - 1] ?? null }
}

// Grow a placed block to as many units as fit in its cubby / shelf slot
// (packed edge to edge, back to front) - the "fill this cubby" move.
export function fillSlot(placements: PlacedProduct[], id: string, ctx: BuilderContext, catalog: Product[]) {
  const p = placements.find((q) => q.id === id)
  const product = p?.sourceProductId ? catalog.find((c) => c.id === p.sourceProductId) : undefined
  const surfaces = surfacesFor(ctx)
  const block = blocksOf(placements, surfaces).find((b) => b.id === id)
  if (!p || !product || !block) return { placements, ok: false, newId: null as string | null, units: 0 }
  const s = surfaces.find((x) => x.tier === block.tier)!
  const cubby = cubbyIndexOf(block, surfaces)
  const face = faceAt(block.x, block.z, s)
  const without = removeCases(placements, [id], ctx)
  const tryN = (n: number) =>
    addCases(without, product, 1, ctx, {
      onlyTier: block.tier,
      onlyCubby: cubby ?? undefined,
      onlyFace: s.cubbies ? undefined : face,
      unitsPerBlock: n,
      noSplit: true,
      noStack: true,
    })
  const start = p.caseConfig ? p.caseConfig.layout.cols * p.caseConfig.layout.rows * p.caseConfig.layout.layers : 1
  let best = tryN(start)
  if (!best.added) return { placements, ok: false, newId: null, units: start }
  let lo = start
  let hi = start
  while (hi < 480) {
    const r = tryN(hi * 2)
    if (!r.added) break
    best = r
    lo = hi * 2
    hi = hi * 2
  }
  hi = hi * 2
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    const r = tryN(mid)
    if (r.added) {
      lo = mid
      best = r
    } else hi = mid
  }
  return { placements: best.placements, ok: lo > start, newId: best.addedIds[0] ?? null, units: lo }
}

function cubbyIndexOf(block: Block, surfaces: ShelfSurface[]) {
  const s = surfaces.find((x) => x.tier === block.tier)
  if (!s?.cubbies) return null
  const i = s.cubbies.findIndex((c) => block.x >= c.x0 - 0.01 && block.x <= c.x1 + 0.01)
  return i >= 0 ? i : null
}

// Re-measure every block of a product after its squishable toggle changed
// (call setSquishOverrides first), then re-seat everything without overlaps.
export function respecProduct(placements: PlacedProduct[], productId: string, ctx: BuilderContext, catalog: Product[]) {
  const product = catalog.find((c) => c.id === productId)
  if (!product) return { placements, dropped: [] as PlacedProduct[] }
  const resized = placements.map((p) => {
    if (p.sourceProductId !== productId || !p.caseConfig) return p
    const l = p.caseConfig.layout
    const spec = caseSpecFor(product, l, l.cols * l.rows * l.layers)
    const { squish: _old, ...rest } = p.caseConfig
    void _old
    return {
      ...p,
      width: round2(spec.case.width),
      depth: round2(spec.case.depth),
      height: round2(spec.case.height),
      caseConfig: { ...rest, ...(spec.squish < 1 ? { squish: spec.squish } : {}) },
    }
  })
  return reflowForGeometry(resized, ctx, catalog)
}

export function autoArrange(placements: PlacedProduct[], ctx: BuilderContext, catalog: Product[], gap = 0) {
  const surfaces = surfacesFor(ctx)
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const movable = placements.filter((p) => p.position && p.caseConfig)
  const fixed = placements.filter((p) => !(p.position && p.caseConfig))
  const groups = new Map<string, PlacedProduct[]>()
  for (const p of movable) {
    const key = p.sourceProductId ?? p.sku
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const ordered = [...groups.values()].sort((a, b) => {
    const wa = unitWeightOf(a[0], byId)
    const wb = unitWeightOf(b[0], byId)
    if (Math.abs(wb - wa) > 0.001) return wb - wa
    return b[0].height - a[0].height
  })
  let blocks: Block[] = blocksOf(fixed, surfaces)
  const placed: PlacedProduct[] = []
  // Fill from the bottom shelf up: each shelf takes the heaviest remaining
  // cases that fit on it (an item too tall for a low shelf waits for one
  // that has the clearance).
  let remaining = ordered.flat()
  const tiers = [...surfaces].sort((x, y) => x.tier - y.tier)
  const unitsOf = (p: PlacedProduct) =>
    p.caseConfig ? p.caseConfig.layout.cols * p.caseConfig.layout.rows * p.caseConfig.layout.layers : 1
  // Put `units` of p on shelf s in its best merchandised arrangement (packed
  // back-to-front, face-out). Returns the placed record or null.
  const tryPlace = (p: PlacedProduct, units: number, s: ShelfSurface, id: string): PlacedProduct | null => {
    const product = p.sourceProductId ? byId.get(p.sourceProductId) : undefined
    const shapes: { layout: CaseLayout | null; width: number; depth: number; height: number }[] = []
    if (product && p.caseConfig) {
      const lim = shelfLimits([s], s.tier)
      const unit = caseSpecFor(product, null, units).unit
      for (const layout of merchLayouts(units, unit, lim.depth, lim.height)) {
        const spec = caseSpecFor(product, layout, units)
        shapes.push({ layout, width: spec.case.width, depth: spec.case.depth, height: spec.case.height })
      }
    }
    if (units === unitsOf(p)) shapes.push({ layout: null, width: p.width, depth: p.depth, height: p.height })
    for (const shape of shapes) {
      const spot = findFreeSpot(shape, [s], blocks, { gap, allowStack: false })
      if (!spot) continue
      const block = { ...spot, id }
      blocks = [...blocks, block]
      const reshaped: PlacedProduct = shape.layout
        ? {
            ...p,
            id,
            width: round2(shape.width),
            depth: round2(shape.depth),
            height: round2(shape.height),
            caseConfig: { ...p.caseConfig!, layout: shape.layout },
            facings: shape.layout.cols,
            rows: shape.layout.rows,
            layers: shape.layout.layers,
          }
        : { ...p, id }
      return applyBlock(reshaped, block, surfaces)
    }
    return null
  }
  const longIds = new Set(
    movable
      .filter((p) => {
        const product = p.sourceProductId ? byId.get(p.sourceProductId) : undefined
        return product ? prefersTopTray(product, surfaces) : false
      })
      .map((p) => p.sourceProductId),
  )
  for (const s of tiers) {
    const next: PlacedProduct[] = []
    const queue = [...remaining]
    while (queue.length) {
      const p = queue.shift()!
      const units = unitsOf(p)
      if (!s.isTop && longIds.has(p.sourceProductId)) {
        next.push(p)
        continue
      }
      const whole = tryPlace(p, units, s, p.id)
      if (whole) {
        placed.push(whole)
        continue
      }
      // Too wide for what is left here (a 9" cubby, the end of a shelf): put
      // as many of its units as fit on this shelf - the way a merchandiser
      // spreads a case over two cubbies - and carry the rest on.
      let split = false
      if (p.caseConfig && units > 1) {
        // No slivers: a part is at least a quarter of the block (2+ units).
        const minPart = Math.min(units - 1, Math.max(2, Math.ceil(units / 4)))
        for (let k = units - 1; k >= minPart; k -= 1) {
          if (units - k < 2) continue // never leave a single stray unit behind
          const part = tryPlace(p, k, s, nanoid())
          if (!part) continue
          placed.push(part)
          const product = p.sourceProductId ? byId.get(p.sourceProductId) : undefined
          const restSpec = product ? caseSpecFor(product, null, units - k) : null
          const rest: PlacedProduct = restSpec
            ? {
                ...p,
                width: round2(restSpec.case.width),
                depth: round2(restSpec.case.depth),
                height: round2(restSpec.case.height),
                caseConfig: { ...p.caseConfig, layout: restSpec.layout },
                facings: restSpec.layout.cols,
                rows: restSpec.layout.rows,
                layers: restSpec.layout.layers,
              }
            : p
          queue.unshift(rest)
          split = true
          break
        }
      }
      if (!split) next.push(p)
    }
    remaining = next
  }
  // Whatever is left stacks on its own item if there is clearance.
  const dropped: PlacedProduct[] = []
  for (const p of remaining) {
    const sameProduct = new Set(placed.filter((q) => q.sourceProductId === p.sourceProductId).map((q) => q.id))
    const spot = findFreeSpot({ width: p.width, depth: p.depth, height: p.height }, surfaces, blocks, {
      gap,
      stackOnIds: sameProduct,
    })
    if (!spot) {
      dropped.push(p)
      continue
    }
    const block = { ...spot, id: p.id }
    blocks = [...blocks, block]
    placed.push(applyBlock(p, block, surfaces))
  }
  return {
    placements: [...fixed, ...placed],
    dropped,
  }
}

// How many more cases of this item fit on one shelf face (edge to edge).
export function roomOnFace(
  placements: PlacedProduct[],
  product: Product,
  tier: number,
  face: TrayFace,
  ctx: BuilderContext,
  gap = 0,
) {
  const r = addCases(placements, product, 60, ctx, { onlyTier: tier, onlyFace: face, gap, noStack: true, noSplit: true })
  return r
}
