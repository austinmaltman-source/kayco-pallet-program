import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RetailerDetailPage } from './retailer-detail-page'
import { useCatalogStore } from '../stores/catalog-store'
import { useDisplayStore } from '../stores/display-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useRoleStore } from '../stores/role-store'
import { makeProduct, makeProject, makeRetailer } from '../test/test-utils'

vi.mock('../components/Wizard/PalletWizard', () => ({
  PalletWizard: () => null,
}))

describe('RetailerDetailPage', () => {
  it('shows an Everyday program card for salesmen when a pallet has no season', async () => {
    useRoleStore.getState().setRole('salesman')
    useRetailerStore.getState().setRetailers([
      makeRetailer({ id: 'ret-1', name: 'Retail Partner' }),
    ])
    useDisplayStore.getState().setProjects([
      makeProject({ id: 'proj-none', retailerId: 'ret-1', season: 'none', seasonId: null }),
    ])

    render(
      <MemoryRouter initialEntries={['/salesman/retailers/ret-1']}>
        <Routes>
          <Route path="/:role/retailers/:id" element={<RetailerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Everyday')).toBeInTheDocument()
  })

  it('supports adding, updating, and removing retailer items', async () => {
    const user = userEvent.setup()

    useCatalogStore.getState().setProducts([
      makeProduct({
        id: 'prod-add',
        name: 'Add Me Product',
        sku: 'ADD-1',
        brand: 'kedem',
        category: 'Snacks',
      }),
    ])

    useRetailerStore.getState().setRetailers([
      makeRetailer({
        id: 'ret-1',
        name: 'Retail Partner',
        authorizedItems: [],
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/retailers/ret-1']}>
        <Routes>
          <Route path="/retailers/:id" element={<RetailerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Items' }))
    await user.click(screen.getByRole('button', { name: /Add Item/i }))

    await user.type(
      screen.getByPlaceholderText('Search by name, SKU, brand, or category...'),
      'Add Me',
    )
    await user.click(screen.getByRole('button', { name: /^Add$/i }))

    // New items land as authorized; status changes via action buttons.
    await waitFor(() => {
      expect(screen.getByText('Add Me Product')).toBeInTheDocument()
    })
    expect(
      useRetailerStore
        .getState()
        .getRetailer('ret-1')
        ?.authorizedItems.find((item) => item.productId === 'prod-add')?.status,
    ).toBe('authorized')

    await user.click(screen.getByRole('button', { name: /Discontinue/i }))

    expect(
      useRetailerStore
        .getState()
        .getRetailer('ret-1')
        ?.authorizedItems.find((item) => item.productId === 'prod-add')?.status,
    ).toBe('discontinued')

    await user.click(screen.getByLabelText('Remove Add Me Product'))

    await waitFor(() => {
      expect(screen.queryByText('Add Me Product')).not.toBeInTheDocument()
    })
  })
})
