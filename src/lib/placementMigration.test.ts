import { describe, expect, it } from 'vitest'
import type { DisplayProject, PlacedProduct } from '../types'
import {
  computePlacementTransform,
  migrateProjectPlacements,
} from './placementMigration'
import {
  buildTierConfigs,
  createDefaultWallConfigs,
  getShelfPosition,
} from './shelfCoordinates'

function makePlacement(overrides: Partial<PlacedProduct> = {}): PlacedProduct {
  return {
    id: 'p1',
    slotId: '1-0',
    width: 10,
    height: 8,
    depth: 6,
    color: '#fff',
    label: 'Test',
    sku: 'SKU',
    wall: 'front',
    tier: 1,
    gridCol: 0,
    colSpan: 2,
    displayMode: 'face-out',
    ...overrides,
  }
}

function makeProject(placements: PlacedProduct[]): DisplayProject {
  return {
    id: 'proj',
    name: 'Test',
    retailerId: 'r1',
    holiday: 'none',
    season: 'none',
    seasonId: null,
    buildLocation: null,
    laborCost: null,
  corrugateCost: null,
    status: 'draft',
    tierCount: 4,
    palletType: 'full',
    lipColor: '#000',
    branding: {},
    placements,
    assortment: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

const CONTEXT = {
  palletType: 'full' as const,
  tierCount: 4,
  palletDimensions: { width: 48, depth: 40, height: 6 },
  maxDisplayHeight: 60,
}

describe('computePlacementTransform', () => {
  it('matches getShelfPosition for an explicit slot placement', () => {
    const placement = makePlacement()
    const transform = computePlacementTransform(placement, CONTEXT)

    const tiers = buildTierConfigs(4, 60, 'full')
    const wallConfigs = createDefaultWallConfigs('full')
    const expected = getShelfPosition(
      { wall: 'front', tier: 1, gridCol: 0, colSpan: 2, displayMode: 'face-out' },
      { width: 10, height: 8, depth: 6, source: 'manual' },
      { base: CONTEXT.palletDimensions, maxWeight: 2500 },
      tiers,
      wallConfigs.front,
    )

    expect(transform).not.toBeNull()
    expect(transform!.position).toEqual(expected.position)
    // Front wall, upright orientation: identity quaternion
    expect(transform!.quaternion[3]).toBeCloseTo(1)
  })

  it('derives wall/tier/gridCol from slotId when explicit fields are missing', () => {
    const placement = makePlacement({
      wall: undefined,
      tier: undefined,
      gridCol: undefined,
      slotId: '2-0',
    })
    const transform = computePlacementTransform(placement, CONTEXT)
    expect(transform).not.toBeNull()

    const tiers = buildTierConfigs(4, 60, 'full')
    const tier2 = tiers.find((t) => t.id === 2)!
    // y = palletHeight + yOffset + platform thickness
    expect(transform!.position[1]).toBeCloseTo(6 + tier2.yOffset + 1)
  })

  it('bakes the orientation preset into the quaternion', () => {
    const placement = makePlacement({ orientation: 1 }) // rotated 90 degrees
    const transform = computePlacementTransform(placement, CONTEXT)
    expect(transform).not.toBeNull()
    // 90 degree yaw: q = (0, sin(45deg), 0, cos(45deg))
    expect(transform!.quaternion[1]).toBeCloseTo(Math.sin(Math.PI / 4))
    expect(transform!.quaternion[3]).toBeCloseTo(Math.cos(Math.PI / 4))
  })

  it('returns null for an unresolvable slot', () => {
    const placement = makePlacement({
      wall: undefined,
      tier: undefined,
      gridCol: undefined,
      slotId: '99-0',
    })
    expect(computePlacementTransform(placement, CONTEXT)).toBeNull()
  })
})

describe('migrateProjectPlacements', () => {
  it('stamps transforms on slot placements and leaves transformed ones alone', () => {
    const settled = makePlacement({
      id: 'settled',
      position: [1, 2, 3],
      quaternion: [0, 0, 0, 1],
    })
    const slotBased = makePlacement({ id: 'slot-based' })
    const project = makeProject([settled, slotBased])

    const migrated = migrateProjectPlacements(project)
    const settledAfter = migrated.placements.find((p) => p.id === 'settled')!
    const slotAfter = migrated.placements.find((p) => p.id === 'slot-based')!

    expect(settledAfter.position).toEqual([1, 2, 3])
    expect(slotAfter.position).toBeDefined()
    expect(slotAfter.quaternion).toBeDefined()
  })

  it('drops placements whose slot cannot be resolved', () => {
    const orphan = makePlacement({
      id: 'orphan',
      wall: undefined,
      tier: undefined,
      gridCol: undefined,
      slotId: 'garbage',
    })
    const migrated = migrateProjectPlacements(makeProject([orphan]))
    expect(migrated.placements).toHaveLength(0)
  })

  it('returns the same project object when nothing needs migration', () => {
    const settled = makePlacement({
      position: [0, 7, 0],
      quaternion: [0, 0, 0, 1],
    })
    const project = makeProject([settled])
    expect(migrateProjectPlacements(project)).toBe(project)
  })
})
