// The physical display, modelled on Kayco's real pallets (reference photos
// from Austin, Oct 16 2026):
//
//  FULL  - 48" x 40" island display. Stacked corrugate trays with a printed
//          lip; a cardboard core in the middle; product merchandised on all
//          four sides of every tray; the top tray is open round a header sign.
//  HALF  - 48" x 20" single-face display. Tall printed side + back panels,
//          shelves split into cubbies by cardboard dividers, an open top
//          tray, and a branded header board above the back panel.
//
// Both the renderer (display-model.tsx) and the placement engine read this
// one spec, so what you see is exactly where products can go.

import type { PalletType } from '../../types'

export interface SpecRect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface LevelSpec {
  level: number // 1 = bottom
  floorY: number // top of the tray floor (inches from the ground)
  clearance: number // free height above the floor
  isTop: boolean
  outer: SpecRect // usable floor inside the lips / panels
  core: SpecRect | null // the cardboard core / header base (nothing sits here)
  cubbies: SpecRect[] | null // half pallet shelves: one rect per cubby
}

export interface DisplaySpec {
  type: PalletType
  width: number
  depth: number
  palletHeight: number
  trayThickness: number
  lipHeight: number
  lipThickness: number
  panelThickness: number
  dividerThickness: number
  ringDepth: number
  levels: LevelSpec[]
  // top of the structure (side/back panels for half; header sign base for full)
  structureTop: number
  header: { y: number; height: number; width: number }
}

export const TRAY_THICKNESS = 0.5
export const LIP_HEIGHT = 3.25
export const LIP_THICKNESS = 0.25
export const PANEL_THICKNESS = 0.5
export const DIVIDER_THICKNESS = 0.35
export const RING_DEPTH = 11
export const HALF_CUBBIES = 5
export const MIN_CUBBY = 3
const TOP_ALLOWANCE = 9

// Cubby dividers are Kayco's own cardboard and move anywhere (Austin: "we can
// move those dividers to wherever we want. Half pallets could have 7 cubbies").
// A shelf's dividers are stored as the X of each divider's centre (inches,
// display-centred); n dividers = n + 1 cubbies. No entry = 5 equal cubbies.
export type DividerMap = Record<number, number[]>

export function halfInner(width = 48) {
  return { x0: -width / 2 + PANEL_THICKNESS, x1: width / 2 - PANEL_THICKNESS }
}

export function evenDividers(cubbies: number, width = 48): number[] {
  const { x0, x1 } = halfInner(width)
  const n = Math.max(1, Math.min(12, Math.round(cubbies)))
  const cw = (x1 - x0 - DIVIDER_THICKNESS * (n - 1)) / n
  return Array.from({ length: n - 1 }, (_, k) => x0 + (k + 1) * cw + k * DIVIDER_THICKNESS + DIVIDER_THICKNESS / 2)
}

// Keep dividers in order, inside the shelf and at least MIN_CUBBY apart.
export function normalizeDividers(xs: number[], width = 48): number[] {
  const { x0, x1 } = halfInner(width)
  const half = DIVIDER_THICKNESS / 2
  const sorted = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  const out: number[] = []
  sorted.forEach((x, i) => {
    const lo = (out.length ? out[out.length - 1] + DIVIDER_THICKNESS : x0 + half) + (out.length ? MIN_CUBBY : MIN_CUBBY)
    const hi = x1 - half - MIN_CUBBY - (sorted.length - 1 - i) * (MIN_CUBBY + DIVIDER_THICKNESS)
    out.push(Math.max(lo, Math.min(hi, x)))
  })
  return out
}

export function dividersFor(map: DividerMap | undefined, level: number, width = 48) {
  const raw = map?.[level]
  return raw ? normalizeDividers(raw, width) : evenDividers(HALF_CUBBIES, width)
}

export function displaySpec(
  type: PalletType,
  levelCount: number,
  palletHeight = 6,
  maxDisplayHeight = 60,
  dividers?: DividerMap,
): DisplaySpec {
  const levels = Math.max(2, Math.min(6, Math.round(levelCount)))
  const width = 48
  const depth = type === 'half' ? 20 : 40
  const firstFloor = palletHeight + TRAY_THICKNESS
  // Spread the trays so the top tray's product finishes near the retailer's
  // height limit; never tighter than 9" between trays.
  const pitch = Math.max(9, (maxDisplayHeight - firstFloor - TOP_ALLOWANCE) / (levels - 1))
  const out: LevelSpec[] = []

  for (let i = 0; i < levels; i += 1) {
    const isTop = i === levels - 1
    const floorY = firstFloor + i * pitch
    const clearance = isTop ? Math.max(8, maxDisplayHeight - floorY) : pitch - TRAY_THICKNESS
    if (type === 'half') {
      const outer: SpecRect = {
        x0: -width / 2 + PANEL_THICKNESS,
        x1: width / 2 - PANEL_THICKNESS,
        z0: -depth / 2 + PANEL_THICKNESS,
        z1: depth / 2 - LIP_THICKNESS,
      }
      let cubbies: SpecRect[] | null = null
      if (!isTop) {
        const xs = dividersFor(dividers, i + 1, width)
        const edges = [outer.x0, ...xs.flatMap((x) => [x - DIVIDER_THICKNESS / 2, x + DIVIDER_THICKNESS / 2]), outer.x1]
        cubbies = []
        for (let k = 0; k < edges.length; k += 2) {
          cubbies.push({ x0: edges[k], x1: edges[k + 1], z0: outer.z0, z1: outer.z1 })
        }
      }
      out.push({ level: i + 1, floorY, clearance, isTop, outer, core: null, cubbies })
    } else {
      const outer: SpecRect = {
        x0: -width / 2 + LIP_THICKNESS,
        x1: width / 2 - LIP_THICKNESS,
        z0: -depth / 2 + LIP_THICKNESS,
        z1: depth / 2 - LIP_THICKNESS,
      }
      const core: SpecRect = isTop
        ? { x0: -8, x1: 8, z0: -8, z1: 8 } // pop-up header box (yellow sign in the photos)
        : {
            x0: -width / 2 + RING_DEPTH,
            x1: width / 2 - RING_DEPTH,
            z0: -depth / 2 + RING_DEPTH,
            z1: depth / 2 - RING_DEPTH,
          }
      out.push({ level: i + 1, floorY, clearance, isTop, outer, core, cubbies: null })
    }
  }

  const top = out[out.length - 1]
  const structureTop = type === 'half' ? top.floorY + Math.min(top.clearance, 10) : top.floorY
  return {
    type,
    width,
    depth,
    palletHeight,
    trayThickness: TRAY_THICKNESS,
    lipHeight: LIP_HEIGHT,
    lipThickness: LIP_THICKNESS,
    panelThickness: PANEL_THICKNESS,
    dividerThickness: DIVIDER_THICKNESS,
    ringDepth: RING_DEPTH,
    levels: out,
    structureTop,
    header:
      type === 'half'
        ? { y: structureTop, height: 7.6, width }
        : { y: top.floorY, height: 18, width: 16 },
  }
}

export function defaultHeaderText(holiday?: string) {
  switch (holiday) {
    case 'pesach':
      return 'Happy Passover'
    case 'rosh-hashanah':
      return 'Shana Tova'
    case 'sukkos':
      return 'Happy Sukkot'
    default:
      return 'Kayco'
  }
}
