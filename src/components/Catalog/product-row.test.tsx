import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'
import {MemoryRouter} from 'react-router-dom'
import {ProductRow} from './product-row'
import {useCatalogStore} from '../../stores/catalog-store'
import {makeProduct} from '../../test/test-utils'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('ProductRow', () => {
  it('navigates on row click and reports deletes from the overflow menu without navigating', async () => {
    const user = userEvent.setup()
    const product = makeProduct({id: 'prod-row', name: 'Row Product'})
    const onDelete = vi.fn()
    useCatalogStore.getState().setProducts([product])

    render(
      <MemoryRouter initialEntries={['/manager/catalog']}>
        <table>
          <tbody>
            <ProductRow product={product} onDelete={onDelete} />
          </tbody>
        </table>
      </MemoryRouter>
    )

    // Row clicks navigate with the role prefix taken from the current URL.
    await user.click(screen.getByText('Row Product'))
    expect(navigateMock).toHaveBeenCalledWith('/manager/catalog/prod-row')

    navigateMock.mockClear()
    await user.click(screen.getByRole('button', {name: /More actions for Row Product/i}))
    await user.click(screen.getByRole('button', {name: /Delete/i}))

    // Deletion is delegated to the parent so it can confirm + cascade.
    expect(onDelete).toHaveBeenCalledWith(product)
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
