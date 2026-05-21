import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, describe, expect, it} from 'vitest'
import {RetailersPage} from './retailers-page'
import {useRetailerStore} from '../stores/retailer-store'
import {useRoleStore} from '../stores/role-store'
import {makeRetailer, renderWithRouter} from '../test/test-utils'

describe('RetailersPage', () => {
  beforeEach(() => {
    // RetailersPage redirects to /salesman home when role=salesman,
    // since salesman home merges retailers + programs into one view.
    useRoleStore.getState().setRole('manager')
    useRetailerStore.getState().setRetailers([
      makeRetailer({
        id: 'ret-1',
        name: 'Alpha Stores',
        tier: 'enterprise',
        status: 'active',
        headquartersCity: 'Queens',
      }),
      makeRetailer({
        id: 'ret-2',
        name: 'Beta Market',
        tier: 'premium',
        status: 'pending',
        headquartersCity: 'Miami',
      }),
    ])
  })

  it('filters retailers and supports add flow', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RetailersPage />, {route: '/retailers'})

    await user.type(screen.getByPlaceholderText('Search retailers...'), 'Queens')
    expect(screen.getByText('Alpha Stores')).toBeInTheDocument()
    expect(screen.queryByText('Beta Market')).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Search retailers...'))
    await user.click(screen.getByRole('button', {name: /^Add Program$/i}))

    await user.type(screen.getByPlaceholderText('e.g. Walmart'), 'Gamma Wholesale')
    // The form's submit button is also labeled "Add Program" — pick the last one.
    const addProgramButtons = screen.getAllByRole('button', {name: /^Add Program$/i})
    await user.click(addProgramButtons[addProgramButtons.length - 1])

    expect(useRetailerStore.getState().retailers.some((retailer) => retailer.name === 'Gamma Wholesale')).toBe(true)
  })
})
