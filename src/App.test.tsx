import {act, render, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import App from './App'
import {useAppSettingsStore} from './stores/app-settings-store'
import {useCatalogStore} from './stores/catalog-store'
import {useDisplayStore} from './stores/display-store'
import {useRetailerStore} from './stores/retailer-store'
import {mockRetailers} from './lib/mock-data'
import {makeProduct, makeProject, makeRetailer} from './test/test-utils'

vi.mock('./pages/editor-page', () => ({
  EditorPage: () => <div>Editor Page</div>,
}))

vi.mock('./pages/catalog-page', () => ({
  CatalogPage: () => <div>Catalog Page</div>,
}))

vi.mock('./pages/product-detail-page', () => ({
  ProductDetailPage: () => <div>Product Detail</div>,
}))

vi.mock('./pages/retailers-page', () => ({
  RetailersPage: () => <div>Retailers Page</div>,
}))

vi.mock('./pages/retailer-detail-page', () => ({
  RetailerDetailPage: () => <div>Retailer Detail</div>,
}))

vi.mock('./pages/pallet-detail-page', () => ({
  PalletDetailPage: () => <div>Pallet Detail</div>,
}))

vi.mock('./pages/program-rollup-page', () => ({
  ProgramRollupPage: () => <div>Program Rollup</div>,
}))

vi.mock('./pages/settings-page', () => ({
  SettingsPage: () => <div>Settings Page</div>,
}))

describe('App', () => {
  it('hydrates persisted data while merging in mock retailers and authorizations', async () => {
    const persistedProducts = [
      makeProduct({id: 'prod-persisted', name: 'Persisted Product'}),
    ]
    const persistedRetailers = [makeRetailer({id: 'ret-persisted', name: 'Persisted Retailer'})]
    const persistedProject = makeProject({
      id: 'proj-persisted',
      name: 'Persisted Project',
      retailerId: 'ret-persisted',
    })

    localStorage.setItem('palletforge-products', JSON.stringify(persistedProducts))
    localStorage.setItem('palletforge-retailers', JSON.stringify(persistedRetailers))
    localStorage.setItem('palletforge-pallets', JSON.stringify([persistedProject]))
    localStorage.setItem('palletforge-active-pallet-id', persistedProject.id)

    render(<App />)

    await waitFor(() => {
      // The product seed was removed: the catalog hydrates from persistence
      // only (the inventory feed is absent in tests, so nothing merges in).
      const catalogProducts = useCatalogStore.getState().products
      expect(catalogProducts.map((product) => product.id)).toEqual(['prod-persisted'])

      const retailerIds = useRetailerStore.getState().retailers.map((retailer) => retailer.id)
      expect(retailerIds[0]).toBe('ret-persisted')
      mockRetailers.forEach((retailer) => expect(retailerIds).toContain(retailer.id))

      expect(useDisplayStore.getState().projects).toHaveLength(1)
      expect(useDisplayStore.getState().projects[0]).toMatchObject({
        id: 'proj-persisted',
        name: 'Persisted Project',
        retailerId: 'ret-persisted',
      })
      expect(useDisplayStore.getState().currentProject?.id).toBe('proj-persisted')
    })
  })

  it('clears corrupt persisted catalog data', async () => {
    localStorage.setItem('palletforge-products', '{bad json')

    render(<App />)

    await waitFor(() => {
      expect(localStorage.getItem('palletforge-products')).toBeNull()
      // No product seed: the catalog stays empty until the inventory feed loads.
      expect(useCatalogStore.getState().products).toEqual([])
    })
  })

  it('autosaves projects only when auto-save is enabled', async () => {
    useRetailerStore.getState().setRetailers([makeRetailer({id: 'ret-1'})])
    render(<App />)

    act(() => {
      useDisplayStore.getState().createProject('Autosaved Project', {
        palletType: 'full',
        season: 'none',
        retailerId: 'ret-1',
      })
    })

    await waitFor(() => {
      expect(localStorage.getItem('palletforge-pallets')).toContain('Autosaved Project')
      expect(localStorage.getItem('palletforge-project')).toContain('Autosaved Project')
    })

    act(() => {
      useAppSettingsStore.getState().updateSettings({autoSaveProject: false})
      localStorage.removeItem('palletforge-pallets')
      localStorage.removeItem('palletforge-project')
      useDisplayStore.getState().updateBranding({headerText: 'Should not persist'})
    })

    await waitFor(() => {
      expect(localStorage.getItem('palletforge-pallets')).toBeNull()
      expect(localStorage.getItem('palletforge-project')).toBeNull()
    })
  })
})
