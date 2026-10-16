// What ONE case of a catalog item looks like on the pallet: how many units,
// how they are arranged (cols across x rows deep x layers high), the unit and
// case dimensions, and whether those case dimensions are real (from the item
// master) or estimated from the unit size.

import type { PlacedProduct, Product } from '../../types'
import { deriveCaseLayout } from '../caseLayout'

export interface CaseLayout {
  cols: number
  rows: number
  layers: number
}

export interface CaseSpec {
  productId: string
  // pitch factor for soft goods (1 = rigid). `unit` below is the PITCH a unit
  // takes on the shelf (true size x squish); `trueUnit` is its real size.
  squish: number
  trueUnit: { width: number; height: number; depth: number }
  unitsPerCase: number
  layout: CaseLayout
  unit: { width: number; height: number; depth: number }
  case: { width: number; height: number; depth: number }
  // true when the case size was computed from unit size x layout (the item
  // master has no case dimensions for this item yet).
  estimatedCase: boolean
  // true when the unit itself had no dimensions and a placeholder was used.
  estimatedUnit: boolean
  unitWeight: number
  caseWeight: number
}

// Estimated corrugate when the item master has no case dimensions: a thin
// wall round the units, a small gap between them, and a tray floor.
// On a display the units come out of the case and are merchandised face-out,
// so a case's footprint on the shelf is its units packed side by side.
export const CASE_WALL = 0.05
export const UNIT_GAP = 0.1
export const TRAY_BASE = 0
export const CASE_PADDING = UNIT_GAP
const FALLBACK_UNIT = { width: 4, height: 6, depth: 4 }

// How a unit stands on a display shelf: upright and FACE-OUT, the printed
// face toward the shopper (Austin's reference photos). The item master often
// lists flat packs lying on their back (tea biscuits 7.75 x 3 x 1.5 high) and
// some pouches/boxes side-on (2 wide x 6 deep); turn those so the big face
// is the front.
export function merchandisedUnit(u: { width: number; height: number; depth: number }) {
  const { width: w, depth: d, height: h } = u
  const longest = Math.max(w, d)
  if (h < Math.min(w, d) && h < 0.6 * longest) {
    return { width: longest, height: Math.min(w, d), depth: h }
  }
  if (d > w * 1.4) return { width: d, height: h, depth: w }
  return { width: w, height: h, depth: d }
}

// Units can be stacked in layers only when they are short packs (boxes,
// sleeves); bottles and jars stand one high.
export const STACKABLE_UNIT_HEIGHT = 4.5

// Every exact arrangement of `count` units in merchandising order for a shelf
// `maxDepth` deep with `maxHeight` of clearance: arrangements that fit first,
// then the narrowest front (each item packed back-to-front to fill the shelf
// depth, like the real displays), deepest, fewest layers.
export function merchLayouts(
  count: number,
  unit: { width: number; height: number; depth: number },
  maxDepth: number,
  maxHeight: number,
): CaseLayout[] {
  const canStack = unit.height <= STACKABLE_UNIT_HEIGHT
  const dims = (l: CaseLayout) => ({
    w: unit.width * l.cols + UNIT_GAP * (l.cols - 1) + CASE_WALL * 2,
    d: unit.depth * l.rows + UNIT_GAP * (l.rows - 1) + CASE_WALL * 2,
    h: unit.height * l.layers,
  })
  const options = layoutOptions(count).filter((l) => l.layers === 1 || canStack)
  const scored = options.map((l) => {
    const m = dims(l)
    const fits = m.d <= maxDepth + 0.01 && m.h <= maxHeight + 0.01
    return { l, m, fits }
  })
  scored.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1
    if (!a.fits) return a.m.d - b.m.d
    if (Math.abs(a.m.w - b.m.w) > 0.01) return a.m.w - b.m.w
    if (Math.abs(a.m.d - b.m.d) > 0.01) return b.m.d - a.m.d
    return a.l.layers - b.l.layers
  })
  return scored.map((s) => s.l)
}

function positive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

export function unitsPerCaseOf(product: Product) {
  return Math.max(1, Math.round(product.unitsPerCase ?? 1))
}

// Every exact arrangement of `count` units (cols x rows x layers), the
// squarest first. Used for the "arrangement" button on a placed case.
export function layoutOptions(count: number): CaseLayout[] {
  const n = Math.max(1, Math.floor(count))
  const out: CaseLayout[] = []
  for (let layers = 1; layers <= Math.min(n, 4); layers += 1) {
    if (n % layers !== 0) continue
    const perLayer = n / layers
    for (let rows = 1; rows <= perLayer; rows += 1) {
      if (perLayer % rows !== 0) continue
      const cols = perLayer / rows
      if (rows > 14 || cols > 24) continue
      out.push({ cols, rows, layers })
    }
  }
  const preferred = deriveCaseLayout(n)
  const key = (l: CaseLayout) => `${l.cols}x${l.rows}x${l.layers}`
  out.sort((a, b) => {
    if (key(a) === key(preferred)) return -1
    if (key(b) === key(preferred)) return 1
    const score = (l: CaseLayout) => l.layers * 10 + Math.abs(l.cols - l.rows * 2)
    return score(a) - score(b)
  })
  return out.length ? out : [preferred]
}

// Soft goods squeeze together on the shelf (Austin: "account for items that
// can be squished together like chips or soft bags"). Detected from the name
// / category / packaging; a per-item toggle overrides it.
export const SQUISH_FACTOR = 0.8
const SOFT_WORDS =
  /\b(CHIPS?|CRISPS?|BAGS?|BAGGED|POUCH(ES)?|PUFFS?|SNACKS?|POPCORN|PRETZELS?|CHEESE ?CURLS|CURLS|DOODLES|BAMBA|BISSLI|MARSHMALLOWS?|GUMMY|GUMMIES|CANDY|SOFT)\b/i
let squishOverrides: Record<string, boolean> = {}
export function setSquishOverrides(map: Record<string, boolean> | undefined) {
  squishOverrides = map ?? {}
}
export function autoSquishable(product: Pick<Product, 'name' | 'category' | 'packaging'>) {
  if (product.packaging === 'bag' || product.packaging === 'pouch') return true
  return SOFT_WORDS.test(`${product.name ?? ''} ${product.category ?? ''}`)
}
export function isSquishable(product: Pick<Product, 'id' | 'name' | 'category' | 'packaging'>) {
  const o = squishOverrides[product.id]
  return o != null ? o : autoSquishable(product)
}

// A merchandised block of units. By default one whole case; `units` makes it
// a half case or any loose unit count (Austin: "we add by case, sometimes by
// half a case, the option should be there to only add units too").
export function caseSpecFor(product: Product, layoutOverride?: CaseLayout | null, units?: number): CaseSpec {
  const unitsPerCase = units != null ? Math.max(1, Math.round(units)) : unitsPerCaseOf(product)
  const estimatedUnit = !(positive(product.width) && positive(product.height) && positive(product.depth))
  const trueUnit = merchandisedUnit(
    estimatedUnit ? FALLBACK_UNIT : { width: product.width, height: product.height, depth: product.depth },
  )
  const squish = isSquishable(product) ? SQUISH_FACTOR : 1
  const unit = { width: trueUnit.width * squish, height: trueUnit.height, depth: trueUnit.depth * squish }
  const layout =
    layoutOverride && layoutOverride.cols * layoutOverride.rows * layoutOverride.layers === unitsPerCase
      ? layoutOverride
      : deriveCaseLayout(unitsPerCase)

  // The catalog normaliser defaults case dims to the UNIT dims when the item
  // master has none, so only trust case dims that actually hold the units.
  const hasRealCase =
    positive(product.caseWidth) &&
    positive(product.caseHeight) &&
    positive(product.caseDepth) &&
    !(
      product.caseWidth === product.width &&
      product.caseDepth === product.depth &&
      product.caseHeight === product.height
    ) &&
    product.caseWidth! * product.caseDepth! * product.caseHeight! >=
      0.7 * unitsPerCase * unit.width * unit.depth * unit.height
  let caseDims: CaseSpec['case']
  // The footprint is always the merchandised unit block (see CASE_WALL).
  // hasRealCase only tells the UI whether the shipping case size is known.
  {
    caseDims = {
      width: unit.width * layout.cols + UNIT_GAP * (layout.cols - 1) + CASE_WALL * 2,
      depth: unit.depth * layout.rows + UNIT_GAP * (layout.rows - 1) + CASE_WALL * 2,
      height: unit.height * layout.layers + TRAY_BASE,
    }
  }

  const unitWeight = positive(product.weight) ? product.weight : 0
  const fullCase = unitsPerCaseOf(product)
  const caseWeight =
    positive(product.caseWeight) && product.caseWeight! > unitWeight * 1.5
      ? (product.caseWeight! / fullCase) * unitsPerCase
      : unitWeight * unitsPerCase
  return {
    productId: product.id,
    squish,
    trueUnit,
    // units in THIS block (a whole case unless `units` was given)
    unitsPerCase,
    layout,
    unit,
    case: caseDims,
    estimatedCase: !hasRealCase,
    estimatedUnit,
    unitWeight,
    caseWeight,
  }
}

// Local positions (bottom-centre anchors, case-local, before rotation) of
// every unit inside a case, plus the scale applied when real case dims are
// smaller than the unit grid.
export function unitPositions(spec: Pick<CaseSpec, 'layout' | 'unit' | 'case'>) {
  const { cols, rows, layers } = spec.layout
  const innerW = Math.max(0.1, spec.case.width - CASE_WALL * 2)
  const innerD = Math.max(0.1, spec.case.depth - CASE_WALL * 2)
  const innerH = Math.max(0.1, spec.case.height - TRAY_BASE)
  const gridW = spec.unit.width * cols + UNIT_GAP * Math.max(0, cols - 1)
  const gridD = spec.unit.depth * rows + UNIT_GAP * Math.max(0, rows - 1)
  const gridH = spec.unit.height * layers
  const scale = Math.min(1, innerW / Math.max(gridW, 0.01), innerD / Math.max(gridD, 0.01), innerH / Math.max(gridH, 0.01))
  const uw = spec.unit.width * scale
  const ud = spec.unit.depth * scale
  const uh = spec.unit.height * scale
  // Spread units across the case interior (real cases can be roomier).
  const padW = cols > 1 ? (innerW - uw * cols) / (cols - 1) : 0
  const padD = rows > 1 ? (innerD - ud * rows) / (rows - 1) : 0
  const positions: [number, number, number][] = []
  for (let layer = 0; layer < layers; layer += 1) {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        positions.push([
          cols > 1 ? -innerW / 2 + uw / 2 + col * (uw + padW) : 0,
          TRAY_BASE + layer * uh,
          // row 0 is the front row (+z, the aisle side)
          rows > 1 ? innerD / 2 - ud / 2 - row * (ud + padD) : 0,
        ])
      }
    }
  }
  return { positions, unitSize: { width: uw, height: uh, depth: ud }, scale }
}

// Builder placements are ordinary PlacedProducts (so the 2D planogram, the
// build sheet and rollups keep working): one placement = one case, with the
// case's units described by caseConfig.layout and facings/rows/layers.
export const BUILDER_TAG = 'builder-v2'

export function isBuilderPlacement(p: PlacedProduct) {
  return p.renderStyle === 'case' && p.slotId?.startsWith(BUILDER_TAG)
}

export type AddMode = 'case' | 'half' | 'units'

// Units in one added block for a mode (units mode: the typed count).
export function unitsForMode(product: Product, mode: AddMode, unitCount = 1) {
  const upc = unitsPerCaseOf(product)
  if (mode === 'half') return Math.max(1, Math.ceil(upc / 2))
  if (mode === 'units') return Math.max(1, Math.round(unitCount))
  return upc
}
