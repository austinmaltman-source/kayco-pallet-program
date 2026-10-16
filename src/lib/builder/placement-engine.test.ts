import { describe, expect, it } from 'vitest'
import type { PlacedProduct, Product } from '../../types'
import { buildSurfaces, footprint, onSurface, validateBlock } from './placement-engine'
import {
  addCases,
  blocksOf,
  commitMove,
  previewMove,
  removeCases,
  rotateCase,
  surfacesFor,
  totalsOf,
  autoArrange,
  heavyAboveLight,
  type BuilderContext,
} from './builder-model'
import { caseSpecFor, layoutOptions, unitPositions } from './case-spec'

const juice: Product = {
  id: 'kayco-100100',
  name: 'GRAPE JUICE CONCORD 64OZ KEDEM',
  sku: '100100',
  brand: 'Kedem' as Product['brand'],
  brandColor: '#7b2d8b',
  category: 'Beverages',
  width: 4.4,
  height: 10.5,
  depth: 4.4,
  weight: 4.79,
  unitsPerCase: 8,
  holidayTags: [],
}

const full: BuilderContext = { palletType: 'full', tierCount: 4, palletHeight: 6, maxDisplayHeight: 60 }
const half: BuilderContext = { palletType: 'half', tierCount: 4, palletHeight: 6, maxDisplayHeight: 60 }

function noOverlaps(placements: PlacedProduct[], ctx: BuilderContext) {
  const surfaces = surfacesFor(ctx)
  const blocks = blocksOf(placements, surfaces)
  for (const b of blocks) expect(validateBlock(b, surfaces, blocks)).toBeNull()
}

describe('case spec', () => {
  it('a case shows every unit it holds', () => {
    const spec = caseSpecFor(juice)
    expect(spec.unitsPerCase).toBe(8)
    expect(spec.layout.cols * spec.layout.rows * spec.layout.layers).toBe(8)
    expect(unitPositions(spec).positions).toHaveLength(8)
    expect(spec.estimatedCase).toBe(true)
  })
  it('lists every exact arrangement', () => {
    const options = layoutOptions(12)
    expect(options.every((o) => o.cols * o.rows * o.layers === 12)).toBe(true)
    expect(options.length).toBeGreaterThan(3)
  })
})

describe('surfaces', () => {
  it('full pallet trays wrap the centre column; half pallet is front-only', () => {
    const f = buildSurfaces('full', 4)
    expect(f).toHaveLength(4)
    expect(f[0].core).not.toBeNull()
    expect(f[0].faces).toEqual(['front', 'right', 'back', 'left'])
    const h = buildSurfaces('half', 4)
    expect(h[0].core).toBeNull()
    expect(h[0].faces).toEqual(['front'])
    // shelves go up
    expect(f[1].y).toBeGreaterThan(f[0].y)
  })
})

describe('builder edits', () => {
  it('adds whole cases without overlaps, front face first', () => {
    const { placements, added } = addCases([], juice, 6, full)
    expect(added).toBe(6)
    noOverlaps(placements, full)
    expect(placements.every((p) => p.quantity === 8)).toBe(true)
    expect(placements[0].wall).toBe('front')
    const totals = totalsOf(placements, [juice], 6)
    expect(totals.cases).toBe(6)
    expect(totals.units).toBe(48)
  })

  it('fills a half pallet and reports when it is full', () => {
    const snack = { ...juice, id: 'snack', width: 5, depth: 2, height: 7, unitsPerCase: 6 }
    const { placements, added, requested } = addCases([], snack, 400, half)
    expect(added).toBeLessThan(requested)
    expect(added).toBeGreaterThan(10)
    noOverlaps(placements, half)
  })

  it('a dragged case never lands on another one', () => {
    const { placements } = addCases([], juice, 2, full)
    const [a, b] = placements
    const preview = previewMove(placements, b.id, { tier: a.tier!, x: a.position![0], z: a.position![2], stack: false }, full)!
    expect(preview.invalid).toBeNull()
    const moved = commitMove(placements, b.id, preview.block, full)
    noOverlaps(moved, full)
  })

  it('stacks on top when dropped onto a case, and falls when the base is removed', () => {
    const { placements } = addCases([], { ...juice, height: 4 }, 2, full)
    const [a, b] = placements
    const preview = previewMove(placements, b.id, { tier: a.tier!, x: a.position![0], z: a.position![2], stack: true }, full)!
    expect(preview.invalid).toBeNull()
    expect(preview.block.y).toBeCloseTo(a.position![1] + a.height)
    const stacked = commitMove(placements, b.id, preview.block, full)
    noOverlaps(stacked, full)
    const removed = removeCases(stacked, [a.id], full)
    expect(removed).toHaveLength(1)
    expect(removed[0].position![1]).toBeCloseTo(a.position![1])
  })

  it('auto-arrange puts the heaviest cases on the bottom shelf', () => {
    const light = { ...juice, id: 'light', name: 'LIGHT SNACK', weight: 0.2, width: 3, depth: 2, height: 5, unitsPerCase: 12 }
    let placements = addCases([], light, 4, full).placements
    placements = addCases(placements, juice, 2, full).placements
    const arranged = autoArrange(placements, full, [juice, light]).placements
    const juiceTiers = arranged.filter((p) => p.sourceProductId === juice.id).map((p) => p.tier!)
    expect(Math.max(...juiceTiers)).toBe(1)
    expect(heavyAboveLight(arranged, full, [juice, light]).size).toBe(0)
    noOverlaps(arranged, full)
  })

  it('half pallet shelves are cubbies; a case never straddles a divider', () => {
    const { placements } = addCases([], juice, 30, half)
    const surfaces = surfacesFor(half)
    for (const b of blocksOf(placements, surfaces)) {
      const s = surfaces.find((x) => x.tier === b.tier)!
      expect(onSurface(footprint(b), s)).toBe(true)
    }
  })

  it('refuses a case taller than the shelf clearance', () => {
    const tall = { ...juice, id: 'tall', height: 40 }
    const { added } = addCases([], tall, 1, full)
    expect(added).toBe(0)
  })

  it('rotates 90 degrees and stays on the shelf', () => {
    const cube = { ...juice, id: 'cube', width: 6, depth: 6, height: 6, unitsPerCase: 1 }
    const { placements } = addCases([], cube, 1, full)
    const result = rotateCase(placements, placements[0].id, full)
    expect(result.ok).toBe(true)
    const surfaces = surfacesFor(full)
    const block = blocksOf(result.placements, surfaces)[0]
    expect(block.rotQ).toBe(1)
    expect(onSurface(footprint(block), surfaces.find((s) => s.tier === block.tier)!)).toBe(true)
  })
})
