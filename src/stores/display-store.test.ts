import {beforeEach, describe, expect, it} from 'vitest'
import {useDisplayStore} from './display-store'
import {useRetailerStore} from './retailer-store'
import {useCatalogStore} from './catalog-store'
import {useAppSettingsStore} from './app-settings-store'
import {makeProduct, makeRetailer} from '../test/test-utils'

describe('display-store', () => {
  beforeEach(() => {
    useRetailerStore.getState().setRetailers([
      makeRetailer({
        id: 'ret-main',
        name: 'Main Retailer',
        defaultTierCount: 5,
      }),
    ])
  })

  it('creates a project using current app defaults and stores the last used config', () => {
    useAppSettingsStore.getState().updateSettings({
      defaultFace: 'left',
      defaultCameraPreset: 'top',
    })

    useDisplayStore.getState().createProject('Holiday Build', {
      palletType: 'half',
      season: 'pesach',
      retailerId: 'ret-main',
    })

    const state = useDisplayStore.getState()
    expect(state.currentProject).toMatchObject({
      name: 'Holiday Build',
      retailerId: 'ret-main',
      season: 'pesach',
      palletType: 'half',
      tierCount: 4,
    })
    expect(state.activeFace).toBe('left')
    expect(state.cameraPreset).toBe('top')
    expect(state.history).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('lastUsedConfig')!)).toEqual({
      palletType: 'half',
      season: 'pesach',
      retailerId: 'ret-main',
    })
  })

  it('spawns a carried placement with a world transform and supports undo/redo', () => {
    const store = useDisplayStore.getState()
    store.createProject('Test Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    const id = store.spawnProduct(makeProduct({id: 'prod-a', name: 'Alpha'}))
    expect(id).toBeDefined()
    let state = useDisplayStore.getState()
    expect(state.currentProject?.placements).toHaveLength(1)
    expect(state.currentProject?.placements[0].position).toBeDefined()
    expect(state.currentProject?.placements[0].quaternion).toEqual([0, 0, 0, 1])
    expect(state.carryPlacementId).toBe(id)
    expect(state.isPickerOpen).toBe(false)

    store.undo()
    expect(useDisplayStore.getState().currentProject?.placements).toHaveLength(0)
    store.redo()
    expect(useDisplayStore.getState().currentProject?.placements).toHaveLength(1)
  })

  it('synthesizes a case from unitsPerCase when spawning a unit product', () => {
    const store = useDisplayStore.getState()
    store.createProject('Case Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    store.spawnProduct(
      makeProduct({id: 'unit-1', width: 4, height: 8, depth: 3, unitsPerCase: 8}),
    )

    const placement = useDisplayStore.getState().currentProject!.placements[0]
    expect(placement.caseConfig).toMatchObject({
      unitProductId: 'unit-1',
      layout: {cols: 4, rows: 2, layers: 1},
    })
    // Case is wider than a single 4 inch unit
    expect(placement.width).toBeGreaterThan(15)
  })

  it('persists settled transforms and clears slot fields on moved items', () => {
    const store = useDisplayStore.getState()
    store.createProject('Settle Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [
          {
            id: 'p-1', slotId: '1-0', wall: 'front' as const, tier: 1, gridCol: 0,
            width: 4, height: 8, depth: 3, color: '#000', label: 'Alpha', sku: 'A',
            position: [0, 7, 14] as [number, number, number],
            quaternion: [0, 0, 0, 1] as [number, number, number, number],
          },
        ],
      },
    }))

    store.settlePlacements([
      {id: 'p-1', position: [5, 22, 10], quaternion: [0, 0, 0, 1]},
    ])

    const placement = useDisplayStore.getState().currentProject!.placements[0]
    expect(placement.position).toEqual([5, 22, 10])
    expect(placement.slotId).toBe('')
    expect(placement.wall).toBeUndefined()
  })

  it('skips settle writes within noise of the stored transform', () => {
    const store = useDisplayStore.getState()
    store.createProject('Noise Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [
          {
            id: 'p-1', slotId: '1-0', wall: 'front' as const, tier: 1, gridCol: 0,
            width: 4, height: 8, depth: 3, color: '#000', label: 'Alpha', sku: 'A',
            position: [0, 7, 14] as [number, number, number],
            quaternion: [0, 0, 0, 1] as [number, number, number, number],
          },
        ],
      },
    }))

    store.settlePlacements([
      {id: 'p-1', position: [0.01, 7.01, 14], quaternion: [0, 0, 0, 1]},
    ])

    const placement = useDisplayStore.getState().currentProject!.placements[0]
    // No-op write: slot fields survive
    expect(placement.slotId).toBe('1-0')
    expect(placement.wall).toBe('front')
  })

  it('returns floor-settled items to the catalog with a notice', () => {
    const store = useDisplayStore.getState()
    store.createProject('Floor Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [
          {
            id: 'p-1', slotId: '', width: 4, height: 8, depth: 3,
            color: '#000', label: 'Fallen', sku: 'F',
            position: [0, 30, 0] as [number, number, number],
            quaternion: [0, 0, 0, 1] as [number, number, number, number],
          },
        ],
      },
    }))

    store.settlePlacements([
      {id: 'p-1', position: [80, 0.1, 90], quaternion: [0, 0, 0, 1]},
    ])

    expect(useDisplayStore.getState().currentProject?.placements).toHaveLength(0)
    expect(useDisplayStore.getState().offPalletNotice?.label).toBe('Fallen')
  })

  it('clamps tier count, drops legacy slot placements above the new max, keeps free ones', () => {
    const store = useDisplayStore.getState()
    store.createProject('Tier Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [
          {id: 'p-1', slotId: '1-0', width: 1, height: 1, depth: 1, color: '#000', label: 'Low', sku: 'LOW'},
          {id: 'p-2', slotId: '6-0', width: 1, height: 1, depth: 1, color: '#000', label: 'High', sku: 'HIGH'},
          {
            id: 'p-3', slotId: '', width: 1, height: 1, depth: 1, color: '#000', label: 'Free', sku: 'FREE',
            position: [0, 40, 0] as [number, number, number],
            quaternion: [0, 0, 0, 1] as [number, number, number, number],
          },
        ],
      },
    }))

    const wakeBefore = useDisplayStore.getState().wakeToken
    store.updateTierCount(1)

    const state = useDisplayStore.getState()
    expect(state.currentProject).toMatchObject({tierCount: 2})
    expect(state.currentProject?.placements.map((placement) => placement.id)).toEqual(['p-1', 'p-3'])
    expect(state.wakeToken).toBe(wakeBefore + 1)
  })

  it('switches full pallets to half pallets, removes non-front legacy placements, keeps free ones', () => {
    const store = useDisplayStore.getState()
    store.createProject('Half Pallet Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })
    store.setActiveFace('right')
    store.selectProduct('placed-1')

    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [
          {id: 'front', slotId: '1-1', width: 1, height: 1, depth: 1, color: '#000', label: 'Front', sku: 'FRONT'},
          {id: 'back', slotId: '1-1001', width: 1, height: 1, depth: 1, color: '#000', label: 'Back', sku: 'BACK'},
          {id: 'side', slotId: '1-2001', width: 1, height: 1, depth: 1, color: '#000', label: 'Side', sku: 'SIDE'},
          {
            id: 'free', slotId: '', width: 1, height: 1, depth: 1, color: '#000', label: 'Free', sku: 'FREE',
            position: [0, 8, 5] as [number, number, number],
            quaternion: [0, 0, 0, 1] as [number, number, number, number],
          },
        ],
      },
    }))

    store.setPalletType('half')

    const state = useDisplayStore.getState()
    expect(state.currentProject?.palletType).toBe('half')
    expect(state.currentProject?.placements.map((placement) => placement.id)).toEqual(['front', 'free'])
    expect(state.activeFace).toBe('front')
    expect(state.selectedProductId).toBeNull()
  })

  it('populates free physics placements from the assortment', () => {
    useCatalogStore.getState().setProducts([
      makeProduct({id: 'heavy', name: 'Heavy', weight: 3, width: 6, height: 8, depth: 5}),
      makeProduct({id: 'light', name: 'Light', weight: 0.3, width: 4, height: 5, depth: 3}),
    ])

    const store = useDisplayStore.getState()
    store.createProject('Populate Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })
    store.setAssortment([
      {productId: 'heavy', cases: 2},
      {productId: 'light', cases: 1},
    ])

    store.populateFromAssortment()

    const placements = useDisplayStore.getState().currentProject!.placements
    expect(placements.length).toBe(2)
    for (const placement of placements) {
      expect(placement.slotId).toBe('')
      expect(placement.position).toBeDefined()
      expect(placement.quaternion).toEqual([0, 0, 0, 1])
    }
    const heavy = placements.find((p) => p.sourceProductId === 'heavy')!
    const light = placements.find((p) => p.sourceProductId === 'light')!
    // Heavy sits on tier 1 (lower y), light on the top tier
    expect(heavy.position![1]).toBeLessThan(light.position![1])
  })

  it('nudges a placement by inches and clears its slot fields', () => {
    const store = useDisplayStore.getState()
    store.createProject('Nudge Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [
          {
            id: 'p-1', slotId: '1-0', wall: 'front' as const, tier: 1, gridCol: 0,
            width: 4, height: 8, depth: 3, color: '#000', label: 'Alpha', sku: 'A',
            position: [0, 7, 14] as [number, number, number],
            quaternion: [0, 0, 0, 1] as [number, number, number, number],
          },
        ],
      },
    }))

    store.nudgePlacement('p-1', [1, 0, -0.25])

    const placement = useDisplayStore.getState().currentProject!.placements[0]
    expect(placement.position).toEqual([1, 7, 13.75])
    expect(placement.slotId).toBe('')
    expect(placement.wall).toBeUndefined()
  })

  it('builds a multi-selection set with additive clicks and group ops', () => {
    const store = useDisplayStore.getState()
    store.createProject('Multi Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    const make = (id: string, x: number) => ({
      id, slotId: '', sourceProductId: 'p', width: 4, height: 8, depth: 3,
      color: '#000', label: id, sku: id.toUpperCase(),
      position: [x, 20, 0] as [number, number, number],
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
    })
    useDisplayStore.setState((state) => ({
      currentProject: state.currentProject && {
        ...state.currentProject,
        placements: [make('a', 0), make('b', 10), make('c', 20)],
      },
    }))

    // Plain click selects one; shift-click adds; shift-click again toggles off.
    store.selectProduct('a')
    store.selectProduct('b', true)
    expect(useDisplayStore.getState().selectedProductIds).toEqual(['a', 'b'])
    expect(useDisplayStore.getState().selectedProductId).toBe('b')
    store.selectProduct('a', true)
    expect(useDisplayStore.getState().selectedProductIds).toEqual(['b'])

    // Group nudge moves every selected item as one history entry.
    store.selectProduct('a')
    store.selectProduct('b', true)
    const before = useDisplayStore.getState().history.length
    store.nudgePlacements(['a', 'b'], [5, 0, 0])
    let placements = useDisplayStore.getState().currentProject!.placements
    expect(placements.find((p) => p.id === 'a')!.position![0]).toBe(5)
    expect(placements.find((p) => p.id === 'b')!.position![0]).toBe(15)
    expect(placements.find((p) => p.id === 'c')!.position![0]).toBe(20)
    expect(useDisplayStore.getState().history.length).toBe(before + 1)

    // Group duplicate adds one copy per selected item.
    store.duplicatePlacements(['a', 'b'])
    expect(useDisplayStore.getState().currentProject!.placements).toHaveLength(5)

    // Group delete removes the selected items and clears them from the set.
    store.removePlacements(['a', 'b'])
    placements = useDisplayStore.getState().currentProject!.placements
    expect(placements.some((p) => p.id === 'a' || p.id === 'b')).toBe(false)
    expect(useDisplayStore.getState().selectedProductIds).toEqual([])
  })

  it('toggles vertical drag mode and bumps the held-rotate token', () => {
    const store = useDisplayStore.getState()
    expect(useDisplayStore.getState().verticalDragMode).toBe(false)

    store.toggleVerticalDragMode()
    expect(useDisplayStore.getState().verticalDragMode).toBe(true)
    store.setVerticalDragMode(false)
    expect(useDisplayStore.getState().verticalDragMode).toBe(false)

    const before = useDisplayStore.getState().heldRotateToken
    store.requestHeldRotate()
    expect(useDisplayStore.getState().heldRotateToken).toBe(before + 1)
  })

  it('enforces forward-only status transitions with a single backward step', () => {
    const store = useDisplayStore.getState()
    store.createProject('Status Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    store.updateStatus('built') // forward jumps are fine
    expect(useDisplayStore.getState().currentProject?.status).toBe('built')

    store.updateStatus('draft') // two+ steps back is rejected
    expect(useDisplayStore.getState().currentProject?.status).toBe('built')

    store.updateStatus('in_build') // one step back is allowed
    expect(useDisplayStore.getState().currentProject?.status).toBe('in_build')
  })

  it('returns the currently active retailer for the project', () => {
    useDisplayStore.getState().createProject('Retailer Project', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-main',
    })

    expect(useDisplayStore.getState().getActiveRetailer()?.name).toBe('Main Retailer')
  })
})
