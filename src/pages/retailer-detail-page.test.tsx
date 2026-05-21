import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RetailerDetailPage } from './retailer-detail-page'
import { useCatalogStore } from '../stores/catalog-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useRoleStore } from '../stores/role-store'
import { makeProduct, makeRetailer } from '../test/test-utils'

vi.mock('../components/Wizard/PalletWizard', () => ({
  PalletWizard: () => null,
}))

vi.mock('../components/StartProgramWizard', () => ({
  StartProgramWizard: () => null,
}))

describe('RetailerDetailPage', () => {
  it('supports adding, discontinuing, and removing retailer items', async () => {
    const user = userEvent.setup()
    useRoleStore.getState().setRole('manager')

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
      <MemoryRouter initialEntries={['/manager/retailers/ret-1']}>
        <Routes>
          <Route path="/:role/retailers/:id" element={<RetailerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Items' }))
    await user.click(screen.getByRole('button', { name: /Add Item/i }))

    await user.type(
      screen.getByPlaceholderText('Search by name, SKU, brand, or category...'),
      'Add Me',
    )
    const productRow = screen.getByText('Add Me Product').closest('div[class*="flex-1"]')?.parentElement
    expect(productRow).not.toBeNull()
    await user.click(within(productRow as HTMLElement).getByRole('button', { name: /^Add$/i }))

    await waitFor(() => {
      expect(screen.getByText('Add Me Product')).toBeInTheDocument()
    })

    // Items are added with status='authorized'. The status flow is now a
    // "Discontinue" button instead of a per-item status <select>.
    expect(
      useRetailerStore
        .getState()
        .getRetailer('ret-1')
        ?.authorizedItems.find((item) => item.productId === 'prod-add')?.status,
    ).toBe('authorized')

    await user.click(screen.getByRole('button', { name: /Discontinue/i }))

    await waitFor(() => {
      expect(
        useRetailerStore
          .getState()
          .getRetailer('ret-1')
          ?.authorizedItems.find((item) => item.productId === 'prod-add')?.status,
      ).toBe('discontinued')
    })

    await user.click(screen.getByLabelText('Remove Add Me Product'))

    await waitFor(() => {
      expect(screen.queryByText('Add Me Product')).not.toBeInTheDocument()
    })
  })
})
