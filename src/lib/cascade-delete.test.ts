import {beforeEach, describe, expect, it} from 'vitest'
import {
  cascadeDeleteProduct,
  cascadeDeleteRetailer,
  countProductReferences,
  countRetailerPallets,
} from './cascade-delete'
import {useCatalogStore} from '../stores/catalog-store'
import {useDisplayStore} from '../stores/display-store'
import {useRetailerStore} from '../stores/retailer-store'
import {useSalespersonStore} from '../stores/salesperson-store'
import {makeProduct, makeRetailer, resetAllStores} from '../test/test-utils'

function seed() {
  resetAllStores()
  useSalespersonStore.setState({salespeople: []})
  useCatalogStore.getState().setProducts([
    makeProduct({id: 'prod-a', name: 'Alpha'}),
    makeProduct({id: 'prod-b', name: 'Beta'}),
  ])
  useRetailerStore.getState().setRetailers([
    makeRetailer({
      id: 'ret-1',
      name: 'Retailer One',
      authorizedItems: [
        {productId: 'prod-a', productName: 'Alpha', sku: 'A', brand: 'tuscanini', authorizedDate: '2026-01-01', status: 'authorized'},
        {productId: 'prod-b', productName: 'Beta', sku: 'B', brand: 'tuscanini', authorizedDate: '2026-01-01', status: 'authorized'},
      ],
    }),
    makeRetailer({id: 'ret-2', name: 'Retailer Two'}),
  ])

  const store = useDisplayStore.getState()
  store.createProject('Pallet One', {
    palletType: 'full',
    season: 'none',
    retailerId: 'ret-1',
  })
  useDisplayStore.setState((state) => ({
    currentProject: state.currentProject && {
      ...state.currentProject,
      assortment: [
        {productId: 'prod-a', cases: 4},
        {productId: 'prod-b', cases: 2},
      ],
      placements: [
        {
          id: 'pl-1', slotId: '', sourceProductId: 'prod-a',
          width: 4, height: 8, depth: 3, color: '#000', label: 'Alpha', sku: 'A',
          position: [0, 7, 14] as [number, number, number],
          quaternion: [0, 0, 0, 1] as [number, number, number, number],
        },
      ],
    },
    projects: state.currentProject
      ? state.projects.map((p) =>
          p.id === state.currentProject!.id
            ? {
                ...p,
                assortment: [
                  {productId: 'prod-a', cases: 4},
                  {productId: 'prod-b', cases: 2},
                ],
                placements: [
                  {
                    id: 'pl-1', slotId: '', sourceProductId: 'prod-a',
                    width: 4, height: 8, depth: 3, color: '#000', label: 'Alpha', sku: 'A',
                    position: [0, 7, 14] as [number, number, number],
                    quaternion: [0, 0, 0, 1] as [number, number, number, number],
                  },
                ],
              }
            : p,
        )
      : state.projects,
  }))
}

describe('cascade-delete', () => {
  beforeEach(seed)

  it('counts every reference a product holds', () => {
    expect(countProductReferences('prod-a')).toEqual({
      assortmentEntries: 1,
      placements: 1,
      pallets: 1,
      authorizations: 1,
    })
  })

  it('deleting a product prunes assortment, placements, and authorizations', () => {
    cascadeDeleteProduct('prod-a')

    expect(useCatalogStore.getState().getProduct('prod-a')).toBeUndefined()
    const project = useDisplayStore.getState().projects[0]
    expect(project.assortment).toEqual([{productId: 'prod-b', cases: 2}])
    expect(project.placements).toHaveLength(0)
    const retailer = useRetailerStore.getState().getRetailer('ret-1')!
    expect(retailer.authorizedItems.map((i) => i.productId)).toEqual(['prod-b'])
  })

  it('deleting a retailer removes its pallets and unassigns salespeople', () => {
    const salesperson = useSalespersonStore.getState().createSalesperson('Sam')
    useSalespersonStore.getState().setRetailers(salesperson.id, ['ret-1', 'ret-2'])

    expect(countRetailerPallets('ret-1')).toBe(1)
    cascadeDeleteRetailer('ret-1')

    expect(useRetailerStore.getState().getRetailer('ret-1')).toBeUndefined()
    expect(useDisplayStore.getState().projects).toHaveLength(0)
    const sam = useSalespersonStore.getState().salespeople.find((sp) => sp.id === salesperson.id)!
    expect(sam.retailerIds).toEqual(['ret-2'])
  })

  it('keeps the active project selected when an unrelated retailer is deleted', () => {
    const store = useDisplayStore.getState()
    store.createProject('Pallet Two', {
      palletType: 'full',
      season: 'none',
      retailerId: 'ret-2',
    })
    // Active project now belongs to ret-2; delete ret-1 and stay on it.
    cascadeDeleteRetailer('ret-1')

    const state = useDisplayStore.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.currentProject?.name).toBe('Pallet Two')
  })
})
