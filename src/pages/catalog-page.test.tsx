import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it} from 'vitest'
import {CatalogPage} from './catalog-page'
import {useCatalogStore} from '../stores/catalog-store'
import {makeProduct, renderWithRouter} from '../test/test-utils'

describe('CatalogPage', () => {
  it('filters seeded products and adds a new product', async () => {
    const user = userEvent.setup()
    // The page renders whatever the catalog store holds - seeding happens at
    // App startup from persistence + the inventory feed, not in the page.
    useCatalogStore.getState().setProducts([
      makeProduct({id: 'prod-matzo', name: 'Matzo Ball Mix', sku: 'MBM-1'}),
      makeProduct({id: 'prod-tea', name: 'Tea Biscuits', sku: 'KED-TBSC-1', brand: 'kedem'}),
    ])

    renderWithRouter(<CatalogPage />, {route: '/manager/catalog'})

    expect(screen.getByText(/2 products in workspace/i)).toBeInTheDocument()

    const search = screen.getByPlaceholderText('Search by name, SKU or brand...')
    await user.type(search, 'Tea Biscuits')
    expect(screen.getByText('Tea Biscuits')).toBeInTheDocument()
    expect(screen.queryByText('Matzo Ball Mix')).not.toBeInTheDocument()

    await user.clear(search)
    await user.click(screen.getByRole('button', {name: /New Product/i}))

    await user.type(
      screen.getByPlaceholderText('e.g. Extra Virgin Olive Oil 750ml'),
      'New Honey Cake',
    )
    await user.type(screen.getByPlaceholderText('e.g. TUS-EVOO-750'), 'CAKE-123')
    await user.click(screen.getByRole('button', {name: /Add Product/i}))

    const products = useCatalogStore.getState().products
    expect(
      products.some((product) => product.name === 'New Honey Cake' && product.sku === 'CAKE-123'),
    ).toBe(true)

    await user.type(search, 'New Honey Cake')
    expect(screen.getByText('New Honey Cake')).toBeInTheDocument()
  })
})
