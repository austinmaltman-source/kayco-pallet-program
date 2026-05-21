import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { useRoleStore } from '../../stores/role-store'
import { makeProject, makeRetailer } from '../../test/test-utils'

describe('Sidebar', () => {
  it('shows the current pallet with quick links and role-prefixed navigation', () => {
    useRoleStore.getState().setRole('manager')
    useRetailerStore.setState({
      retailers: [makeRetailer({ id: 'ret-1', name: 'Retail Partner' })],
    })
    useDisplayStore.setState({
      currentProject: makeProject({
        id: 'proj-1',
        retailerId: 'ret-1',
        name: 'Spring Reset',
        tierCount: 5,
        placements: [
          { id: 'p1', slotId: '1-0', width: 1, height: 1, depth: 1, color: '#000', label: 'One', sku: 'ONE' },
          { id: 'p2', slotId: '1-1', width: 1, height: 1, depth: 1, color: '#000', label: 'Two', sku: 'TWO' },
        ],
      }),
    })

    render(
      <MemoryRouter initialEntries={['/manager/catalog']}>
        <Sidebar />
      </MemoryRouter>
    )

    expect(screen.getByText('Pallet program planning')).toBeInTheDocument()
    expect(screen.getByText('Spring Reset')).toBeInTheDocument()
    expect(screen.getByText('Retail Partner')).toBeInTheDocument()
    expect(screen.getByText('2 products')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pallet Details/i })).toHaveAttribute(
      'href',
      '/manager/retailers/ret-1/pallets/proj-1'
    )
    expect(screen.getByRole('link', { name: /Open Editor/i })).toHaveAttribute(
      'href',
      '/manager/retailers/ret-1/pallets/proj-1/editor'
    )
    expect(screen.getByRole('link', { name: /Programs/i })).toHaveAttribute(
      'href',
      '/manager/retailers'
    )
  })
})
