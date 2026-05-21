import type {HTMLAttributes, ReactNode} from 'react'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'
import {PalletCreationWizard} from '.'
import {useDisplayStore} from '../../stores/display-store'
import {useRetailerStore} from '../../stores/retailer-store'
import {useRoleStore} from '../../stores/role-store'
import {useSeasonStore} from '../../stores/season-store'
import {makeRetailer, renderWithRouter} from '../../test/test-utils'

vi.mock('motion/react', () => ({
  AnimatePresence: ({children}: {children: ReactNode}) => <>{children}</>,
  motion: {
    div: ({children, ...props}: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

describe('PalletCreationWizard', () => {
  it('creates a project from the selected pallet, season, and retailer', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    useRoleStore.getState().setRole('manager')

    useSeasonStore.getState().setSeasons([
      {id: 'season-pesach', name: 'Pesach', archived: false, createdAt: 1000},
    ])

    useRetailerStore.getState().setRetailers([
      makeRetailer({
        id: 'ret-1',
        name: 'Retail Partner',
        defaultTierCount: 5,
        authorizedItems: [
          {
            productId: 'p1',
            productName: 'Juice',
            sku: 'J-1',
            brand: 'kedem',
            status: 'authorized',
            authorizedDate: '2025-01-01',
            avgMonthlyUnits: 10,
            marginPercent: 20,
          },
        ],
      }),
    ])

    renderWithRouter(<PalletCreationWizard open onClose={onClose} />)

    // The 3D preview also exposes a "Switch to Half Pallet" arrow button —
    // use an exact name match to pick only the pill selector.
    await user.click(screen.getByRole('button', {name: 'Half Pallet'}))
    await user.click(screen.getByRole('button', {name: /Next/i}))
    await user.click(screen.getByRole('button', {name: /Pesach/i}))
    await user.click(screen.getByRole('button', {name: /Next/i}))
    await user.click(screen.getByRole('button', {name: /Retail Partner/i}))
    await user.click(screen.getByRole('button', {name: /Next/i}))
    expect(screen.getByDisplayValue('Pesach - Retail Partner')).toBeInTheDocument()
    await user.click(screen.getByRole('button', {name: /Create Pallet/i}))

    expect(useDisplayStore.getState().currentProject).toMatchObject({
      retailerId: 'ret-1',
      palletType: 'half',
      seasonId: 'season-pesach',
      tierCount: 5,
      name: 'Pesach - Retail Partner',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
