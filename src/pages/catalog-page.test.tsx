import {screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it} from 'vitest'
import {CatalogPage} from './catalog-page'
import {useCatalogStore} from '../stores/catalog-store'
import {useRoleStore} from '../stores/role-store'
import {mockProducts} from '../lib/mock-data'
import {renderWithRouter} from '../test/test-utils'

describe('CatalogPage', () => {
  it('filters mock products and adds a new product with its case variant', async () => {
    const user = userEvent.setup()
    useRoleStore.getState().setRole('manager')
    useCatalogStore.getState().setProducts(mockProducts)

    renderWithRouter(<CatalogPage />, {route: '/manager/catalog'})

    await waitFor(() => {
      expect(useCatalogStore.getState().products.length).toBeGreaterThan(0)
    })

    expect(screen.getByText(/products in workspace/i)).toBeInTheDocument()

    // Search filter
    await user.type(screen.getByPlaceholderText('Search by name, SKU or brand...'), 'Tea Biscuits')
    expect(screen.getByText('Tea Biscuits')).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Search by name, SKU or brand...'))

    // New product flow (form still includes optional holiday radios)
    await user.click(screen.getByRole('button', {name: /New Product/i}))

    await user.type(screen.getByPlaceholderText('e.g. Extra Virgin Olive Oil 750ml'), 'New Honey Cake')
    await user.type(screen.getByPlaceholderText('e.g. TUS-EVOO-750'), 'CAKE-123')
    await user.click(screen.getByRole('radio', {name: 'RH'}))
    await user.click(screen.getByRole('button', {name: /Add Product/i}))

    expect(useCatalogStore.getState().products.some((product) => product.name === 'New Honey Cake')).toBe(true)
    expect(useCatalogStore.getState().products.some((product) => product.sku === 'CAKE-123')).toBe(true)

    await user.type(screen.getByPlaceholderText('Search by name, SKU or brand...'), 'New Honey Cake')
    expect(screen.getByText('New Honey Cake')).toBeInTheDocument()
  })
})
