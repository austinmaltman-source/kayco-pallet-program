// Deterministic placement engine for the 3D pallet builder (v2).
//
// No physics: every case is an axis-aligned block that sits either on a
// shelf (tier platform) or on top of other cases. Positions snap to a grid,
// edges magnet flush to neighbours and shelf walls, nothing may overlap, and
// a block can never poke above its shelf's clearance. Pure functions only, so
// the rules are unit-tested (placement-engine.test.ts) and the scene just
// renders what this file decides.

import { displaySpec } from './display-spec'
import type { PalletType, TrayFace } from '../../types'

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface ShelfSurface {
  tier: number
  // World Y of the platform top (inches from the floor).
  y: number
  // Free height above the platform before the next platform / display ceiling.
  clearance: number
  // Usable area on the platform (inside the retaining lips / walls).
  outer: Rect
  // Cardboard core a full pallet's trays wrap around / header base on the
  // top tray (nothing sits here).
  core: Rect | null
  // Half pallet shelves are split into cubbies; a case must sit in one.
  cubbies: Rect[] | null
  isTop: boolean
  faces: TrayFace[]
  // Usable shelf area in square inches (outer minus core).
  area: number
}

export interface Block {
  id: string
  tier: number
  // Footprint centre in world inches.
  x: number
  z: number
  // Bottom of the block in world inches.
  y: number
  // Footprint AFTER rotation (w along X, d along Z) and height.
  w: number
  d: number
  h: number
  // Quarter turns about Y (0 = label faces +Z / the front aisle).
  rotQ: number
}

export const EPS = 0.01

export function buildSurfaces(
  palletType: PalletType,
  tierCount: number,
  palletHeight = 6,
  maxDisplayHeight = 60,
): ShelfSurface[] {
  const spec = displaySpec(palletType, tierCount, palletHeight, maxDisplayHeight)
  return spec.levels.map((level) => {
    const faces: TrayFace[] =
      palletType === 'half' ? ['front'] : level.isTop ? ['front', 'back'] : ['front', 'right', 'back', 'left']
    const area = level.cubbies
      ? level.cubbies.reduce((sum, c) => sum + rectArea(c), 0)
      : rectArea(level.outer) - (level.core ? rectArea(level.core) : 0)
    return {
      tier: level.level,
      y: level.floorY,
      clearance: level.clearance,
      outer: level.outer,
      core: level.core,
      cubbies: level.cubbies,
      isTop: level.isTop,
      faces,
      area,
    }
  })
}

export function rectArea(r: Rect) {
  return Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0)
}

export function footprint(b: Pick<Block, 'x' | 'z' | 'w' | 'd'>): Rect {
  return { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }
}

export function rectsOverlap(a: Rect, b: Rect, eps = EPS) {
  return a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps
}

export function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const d = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
  return w > 0 && d > 0 ? w * d : 0
}

export function blocksOverlap(a: Block, b: Block, eps = EPS) {
  if (a.tier !== b.tier) return false
  if (a.y >= b.y + b.h - eps || b.y >= a.y + a.h - eps) return false
  return rectsOverlap(footprint(a), footprint(b), eps)
}

export function rectInside(inner: Rect, outer: Rect, eps = EPS) {
  return (
    inner.x0 >= outer.x0 - eps &&
    inner.x1 <= outer.x1 + eps &&
    inner.z0 >= outer.z0 - eps &&
    inner.z1 <= outer.z1 + eps
  )
}

export function onSurface(r: Rect, s: ShelfSurface) {
  if (!rectInside(r, s.outer)) return false
  if (s.core && rectsOverlap(r, s.core)) return false
  if (s.cubbies && !s.cubbies.some((c) => rectInside(r, c))) return false
  return true
}

// Index of the cubby a point is in (or nearest to), null without cubbies.
export function cubbyAt(x: number, s: ShelfSurface): number | null {
  if (!s.cubbies) return null
  let best = 0
  let bestDist = Infinity
  s.cubbies.forEach((c, i) => {
    const dist = x < c.x0 ? c.x0 - x : x > c.x1 ? x - c.x1 : 0
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}

// Which face of the display a footprint centre belongs to.
export function faceAt(x: number, z: number, s: ShelfSurface): TrayFace {
  if (!s.core) return 'front'
  if (s.isTop) return z >= 0 ? 'front' : 'back'
  if (z >= s.core.z1 - EPS) return 'front'
  if (z <= s.core.z0 + EPS) return 'back'
  return x >= 0 ? 'right' : 'left'
}

export const FACE_QUARTER: Record<TrayFace, number> = { front: 0, right: 1, back: 2, left: 3 }

export function normQ(q: number) {
  return ((Math.round(q) % 4) + 4) % 4
}

// Footprint of a case with the given (unrotated) width/depth after rotQ.
export function rotatedFootprint(width: number, depth: number, rotQ: number) {
  return normQ(rotQ) % 2 === 0 ? { w: width, d: depth } : { w: depth, d: width }
}

// Highest top of any block under this footprint on the tier (shelf floor
// when nothing is underneath). Cases stack on whatever they rest over.
export function supportHeight(
  r: Rect,
  tier: number,
  surface: ShelfSurface,
  blocks: Block[],
  excludeIds: Set<string> = new Set(),
) {
  let y = surface.y
  for (const b of blocks) {
    if (b.tier !== tier || excludeIds.has(b.id)) continue
    if (rectsOverlap(r, footprint(b))) y = Math.max(y, b.y + b.h)
  }
  return y
}

// Fraction of a stacked block's footprint that actually rests on the blocks
// directly below it (1 for anything on the shelf floor).
export function supportedFraction(block: Block, surface: ShelfSurface, blocks: Block[]) {
  if (block.y <= surface.y + EPS) return 1
  const r = footprint(block)
  const area = block.w * block.d
  if (area <= 0) return 0
  let covered = 0
  for (const b of blocks) {
    if (b.id === block.id || b.tier !== block.tier) continue
    if (Math.abs(b.y + b.h - block.y) > 0.05) continue
    covered += overlapArea(r, footprint(b))
  }
  return Math.min(1, covered / area)
}

export type Invalid =
  | 'off-shelf'
  | 'overlap'
  | 'too-tall'
  | 'unsupported'
  | 'no-shelf'

export function validateBlock(
  block: Block,
  surfaces: ShelfSurface[],
  blocks: Block[],
): Invalid | null {
  const s = surfaces.find((entry) => entry.tier === block.tier)
  if (!s) return 'no-shelf'
  if (!onSurface(footprint(block), s)) return 'off-shelf'
  if (block.y + block.h > s.y + s.clearance + EPS) return 'too-tall'
  for (const other of blocks) {
    if (other.id === block.id) continue
    if (blocksOverlap(block, other)) return 'overlap'
  }
  if (supportedFraction(block, s, blocks) < 0.5 - EPS) return 'unsupported'
  return null
}

export function snap(value: number, grid: number) {
  if (grid <= 0) return value
  return Math.round(value / grid) * grid
}

export interface SnapOptions {
  grid: number // inches, e.g. 0.5
  gap: number // spacing kept between neighbouring cases
  magnet: number // pull distance for flush edges
}

export const DEFAULT_SNAP: SnapOptions = { grid: 0.5, gap: 0, magnet: 1.25 }

// Candidate edge lines a footprint can sit flush against: shelf walls, the
// centre column, and every neighbour on the same level (plus the gap).
function edgeTargets(
  tier: number,
  s: ShelfSurface,
  blocks: Block[],
  y: number,
  h: number,
  gap: number,
  exclude: Set<string>,
) {
  const xs: { lo: number[]; hi: number[] } = { lo: [s.outer.x0], hi: [s.outer.x1] }
  const zs: { lo: number[]; hi: number[] } = { lo: [s.outer.z0], hi: [s.outer.z1] }
  if (s.core) {
    xs.lo.push(s.core.x1)
    xs.hi.push(s.core.x0)
    zs.lo.push(s.core.z1)
    zs.hi.push(s.core.z0)
  }
  for (const c of s.cubbies ?? []) {
    xs.lo.push(c.x0)
    xs.hi.push(c.x1)
  }
  for (const b of blocks) {
    if (b.tier !== tier || exclude.has(b.id)) continue
    // Only neighbours that share some height with us constrain our sides.
    if (b.y >= y + h - EPS || y >= b.y + b.h - EPS) continue
    const r = footprint(b)
    xs.lo.push(r.x1 + gap)
    xs.hi.push(r.x0 - gap)
    zs.lo.push(r.z1 + gap)
    zs.hi.push(r.z0 - gap)
  }
  return { xs, zs }
}

function magnetAxis(center: number, half: number, lo: number[], hi: number[], magnet: number) {
  let best = center
  let bestDist = magnet
  for (const edge of lo) {
    const dist = Math.abs(center - half - edge)
    if (dist < bestDist) {
      bestDist = dist
      best = edge + half
    }
  }
  for (const edge of hi) {
    const dist = Math.abs(center + half - edge)
    if (dist < bestDist) {
      bestDist = dist
      best = edge - half
    }
  }
  return best
}

// Push a footprint back inside the shelf and out of the centre column with the
// smallest move.
export function clampToSurface(block: Block, s: ShelfSurface): Block {
  let { x, z } = block
  const hw = block.w / 2
  const hd = block.d / 2
  const area = s.cubbies ? s.cubbies[cubbyAt(x, s) ?? 0] : s.outer
  x = Math.min(Math.max(x, area.x0 + hw), area.x1 - hw)
  z = Math.min(Math.max(z, area.z0 + hd), area.z1 - hd)
  if (s.core) {
    const r = footprint({ x, z, w: block.w, d: block.d })
    if (rectsOverlap(r, s.core)) {
      const moves = [
        { dx: s.core.x0 - r.x1, dz: 0 },
        { dx: s.core.x1 - r.x0, dz: 0 },
        { dx: 0, dz: s.core.z0 - r.z1 },
        { dx: 0, dz: s.core.z1 - r.z0 },
      ].filter((m) => {
        const nx = x + m.dx
        const nz = z + m.dz
        return (
          nx - hw >= s.outer.x0 - EPS &&
          nx + hw <= s.outer.x1 + EPS &&
          nz - hd >= s.outer.z0 - EPS &&
          nz + hd <= s.outer.z1 + EPS
        )
      })
      moves.sort((a, b) => Math.abs(a.dx) + Math.abs(a.dz) - (Math.abs(b.dx) + Math.abs(b.dz)))
      if (moves[0]) {
        x += moves[0].dx
        z += moves[0].dz
      }
    }
  }
  return { ...block, x, z }
}

// Where a case dragged to (x, z) on a tier actually lands: snapped, flush to
// nearby edges, inside the shelf, resting on whatever is under it, and moved
// to the nearest free spot if that position collides. Returns the block and
// whether it is valid (an invalid block is still returned for the red ghost).
export function resolvePlacement(
  draft: Block,
  surfaces: ShelfSurface[],
  blocks: Block[],
  options: SnapOptions = DEFAULT_SNAP,
  mode: 'floor' | 'stack' = 'floor',
  searchRadius = 14,
): { block: Block; invalid: Invalid | null } {
  const s = surfaces.find((entry) => entry.tier === draft.tier)
  if (!s) return { block: draft, invalid: 'no-shelf' }
  const others = blocks.filter((b) => b.id !== draft.id)
  const exclude = new Set([draft.id])

  const settleAt = (x: number, z: number): Block => {
    let b = clampToSurface({ ...draft, x, z }, s)
    const y = mode === 'stack' ? supportHeight(footprint(b), b.tier, s, others, exclude) : s.y
    b = { ...b, y }
    return b
  }

  // 1. grid snap, then magnet to edges at the level we would rest on
  let b = settleAt(snap(draft.x, options.grid), snap(draft.z, options.grid))
  const targets = edgeTargets(b.tier, s, others, b.y, b.h, options.gap, exclude)
  b = settleAt(
    magnetAxis(b.x, b.w / 2, targets.xs.lo, targets.xs.hi, options.magnet),
    magnetAxis(b.z, b.d / 2, targets.zs.lo, targets.zs.hi, options.magnet),
  )
  const invalid = validateBlock(b, surfaces, others)
  if (!invalid) return { block: b, invalid }
  // Too tall for this shelf even on its floor: moving sideways cannot help.
  if (invalid === 'too-tall' && mode === 'floor') return { block: b, invalid }

  // 2. nearest free spot, spiralling out on the grid (on the shelf floor or on
  //    top of whatever is there, whichever is valid first)
  const step = Math.max(0.5, options.grid)
  // Big cases need a wider search to clear a neighbour of their own size.
  const radius = Math.max(searchRadius, Math.max(draft.w, draft.d) * 1.25)
  const rings = Math.ceil(radius / step)
  const origin = b
  for (let ring = 1; ring <= rings; ring += 1) {
    let best: Block | null = null
    let bestDist = Infinity
    for (let i = -ring; i <= ring; i += 1) {
      for (const [dx, dz] of [
        [i, -ring],
        [i, ring],
        [-ring, i],
        [ring, i],
      ]) {
        const candidate = settleAt(origin.x + dx * step, origin.z + dz * step)
        if (validateBlock(candidate, surfaces, others)) continue
        const dist = Math.hypot(candidate.x - draft.x, candidate.z - draft.z)
        if (dist < bestDist) {
          bestDist = dist
          best = candidate
        }
      }
    }
    if (best) return { block: best, invalid: null }
  }
  return { block: b, invalid }
}

// Bottom-left fill: the first free spot for a new case, scanning each shelf
// from the bottom tier up, front face first, outer edge (aisle side) first.
export function findFreeSpot(
  shape: { width: number; depth: number; height: number },
  surfaces: ShelfSurface[],
  blocks: Block[],
  options: {
    preferTier?: number
    preferFace?: TrayFace
    gap?: number
    allowStack?: boolean
    stackOnIds?: Set<string>
    // Only this shelf / face (no fallback elsewhere) - used by "fill shelf".
    onlyTier?: number
    onlyFace?: TrayFace
    // Half pallet: try this cubby first / only this cubby (0-based).
    preferCubby?: number
    onlyCubby?: number
  } = {},
): Block | null {
  const gap = options.gap ?? 0
  const pool = options.onlyTier != null ? surfaces.filter((s) => s.tier === options.onlyTier) : surfaces
  const ordered = [...pool].sort((a, b) => {
    if (options.preferTier != null) {
      if (a.tier === options.preferTier) return -1
      if (b.tier === options.preferTier) return 1
    }
    return a.tier - b.tier
  })
  for (const s of ordered) {
    const faces = options.onlyFace
      ? s.faces.filter((f) => f === options.onlyFace)
      : options.preferFace && s.faces.includes(options.preferFace)
        ? [options.preferFace, ...s.faces.filter((f) => f !== options.preferFace)]
        : s.faces
    for (const face of faces) {
      const rotQ = FACE_QUARTER[face]
      const { w, d } = rotatedFootprint(shape.width, shape.depth, rotQ)
      const tierBlocks = blocks.filter((b) => b.tier === s.tier)
      let cubbyOrder: number[] | undefined
      if (s.cubbies) {
        const all = s.cubbies.map((_, i) => i)
        if (options.onlyCubby != null) cubbyOrder = [options.onlyCubby]
        else if (options.preferCubby != null)
          cubbyOrder = [options.preferCubby, ...all.filter((i) => i !== options.preferCubby)]
      }
      const found = scanFace(s, face, { w, d, h: shape.height, rotQ }, tierBlocks, blocks, surfaces, gap, cubbyOrder)
      if (found) return found
    }
  }
  if (options.allowStack !== false) {
    // Nothing free on a shelf floor: stack on top of matching cases.
    for (const base of blocks) {
      if (options.stackOnIds && !options.stackOnIds.has(base.id)) continue
      if (options.onlyTier != null && base.tier !== options.onlyTier) continue
      const s = surfaces.find((entry) => entry.tier === base.tier)
      if (!s) continue
      const { w, d } = rotatedFootprint(shape.width, shape.depth, base.rotQ)
      const candidate: Block = {
        id: '__new__',
        tier: base.tier,
        x: base.x,
        z: base.z,
        y: base.y + base.h,
        w,
        d,
        h: shape.height,
        rotQ: base.rotQ,
      }
      candidate.y = supportHeight(footprint(candidate), base.tier, s, blocks)
      if (!validateBlock(candidate, surfaces, blocks)) return candidate
    }
  }
  return null
}

function scanFace(
  s: ShelfSurface,
  face: TrayFace,
  shape: { w: number; d: number; h: number; rotQ: number },
  tierBlocks: Block[],
  allBlocks: Block[],
  surfaces: ShelfSurface[],
  gap: number,
  cubbyOrder?: number[],
): Block | null {
  if (shape.h > s.clearance + EPS) return null
  if (s.cubbies) {
    const order = cubbyOrder ?? s.cubbies.map((_, i) => i)
    for (const i of order) {
      const c = s.cubbies[i]
      if (!c) continue
      const found = scanStrip(s, 'front', c, shape, tierBlocks, allBlocks, surfaces, gap)
      if (found) return found
    }
    return null
  }
  // Strip of the shelf that belongs to this face.
  let strip: Rect = s.outer
  if (s.core) {
    if (face === 'front') strip = { ...s.outer, z0: s.core.z1 }
    else if (face === 'back') strip = { ...s.outer, z1: s.core.z0 }
    else if (face === 'right') strip = { x0: s.core.x1, x1: s.outer.x1, z0: s.outer.z0, z1: s.outer.z1 }
    else strip = { x0: s.outer.x0, x1: s.core.x0, z0: s.outer.z0, z1: s.outer.z1 }
  }
  return scanStrip(s, face, strip, shape, tierBlocks, allBlocks, surfaces, gap)
}

function scanStrip(
  s: ShelfSurface,
  face: TrayFace,
  strip: Rect,
  shape: { w: number; d: number; h: number; rotQ: number },
  tierBlocks: Block[],
  allBlocks: Block[],
  surfaces: ShelfSurface[],
  gap: number,
): Block | null {
  // Candidate edge positions: the strip edge and every neighbour edge.
  const along = face === 'front' || face === 'back' ? 'x' : 'z'
  const lo = along === 'x' ? strip.x0 : strip.z0
  const alongEdges = [lo]
  const depthEdges: number[] = []
  // "Outer" edge = aisle side; scan from it inward.
  const outerEdge =
    face === 'front' ? strip.z1 : face === 'back' ? strip.z0 : face === 'right' ? strip.x1 : strip.x0
  depthEdges.push(outerEdge)
  for (const b of tierBlocks) {
    const r = footprint(b)
    if (along === 'x') alongEdges.push(r.x1 + gap)
    else alongEdges.push(r.z1 + gap)
    if (face === 'front') depthEdges.push(r.z0 - gap)
    else if (face === 'back') depthEdges.push(r.z1 + gap)
    else if (face === 'right') depthEdges.push(r.x0 - gap)
    else depthEdges.push(r.x1 + gap)
  }
  alongEdges.sort((a, b) => a - b)
  // Aisle side first.
  depthEdges.sort((a, b) => (face === 'front' || face === 'right' ? b - a : a - b))
  for (const depthEdge of depthEdges) {
    for (const alongEdge of alongEdges) {
      let x: number
      let z: number
      if (along === 'x') {
        x = alongEdge + shape.w / 2
        z = face === 'front' ? depthEdge - shape.d / 2 : depthEdge + shape.d / 2
      } else {
        z = alongEdge + shape.d / 2
        x = face === 'right' ? depthEdge - shape.w / 2 : depthEdge + shape.w / 2
      }
      const candidate: Block = {
        id: '__new__',
        tier: s.tier,
        x,
        z,
        y: s.y,
        w: shape.w,
        d: shape.d,
        h: shape.h,
        rotQ: shape.rotQ,
      }
      if (!rectInside(footprint(candidate), strip)) continue
      if (!validateBlock(candidate, surfaces, allBlocks)) return candidate
    }
  }
  return null
}

// Gravity without physics: after a case is moved or removed, everything that
// was resting on it drops to whatever is now underneath.
export function settleBlocks(blocks: Block[], surfaces: ShelfSurface[]): Block[] {
  const ordered = [...blocks].sort((a, b) => a.y - b.y)
  const placed: Block[] = []
  for (const block of ordered) {
    const s = surfaces.find((entry) => entry.tier === block.tier)
    if (!s) {
      placed.push(block)
      continue
    }
    const y = supportHeight(footprint(block), block.tier, s, placed)
    placed.push({ ...block, y })
  }
  const byId = new Map(placed.map((b) => [b.id, b]))
  return blocks.map((b) => byId.get(b.id) ?? b)
}

export interface ShelfUsage {
  tier: number
  usedArea: number
  area: number
  fill: number
  tallest: number
  clearance: number
  stackLevels: number
}

export function shelfUsage(surfaces: ShelfSurface[], blocks: Block[]): ShelfUsage[] {
  return surfaces.map((s) => {
    const onTier = blocks.filter((b) => b.tier === s.tier)
    // Floor footprint only (stacked cases do not use more shelf).
    const floor = onTier.filter((b) => b.y <= s.y + EPS)
    const usedArea = floor.reduce((sum, b) => sum + b.w * b.d, 0)
    const tallest = onTier.reduce((max, b) => Math.max(max, b.y + b.h - s.y), 0)
    const levels = new Set(onTier.map((b) => Math.round((b.y - s.y) * 10)))
    return {
      tier: s.tier,
      usedArea,
      area: s.area,
      fill: s.area > 0 ? Math.min(1, usedArea / s.area) : 0,
      tallest,
      clearance: s.clearance,
      stackLevels: levels.size,
    }
  })
}
