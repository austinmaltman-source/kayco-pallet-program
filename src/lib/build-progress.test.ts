import {describe, expect, it} from 'vitest'
import {remainingPalletsToBuild} from './build-progress'

describe('remainingPalletsToBuild', () => {
  it('defaults to one pallet when quantity is unset', () => {
    expect(remainingPalletsToBuild({status: 'ready'})).toBe(1)
  })

  it('subtracts build-log progress from the requested quantity', () => {
    expect(
      remainingPalletsToBuild({
        status: 'in_build',
        quantity: 10,
        buildLog: [
          {date: '2026-06-01', built: 3},
          {date: '2026-06-02', built: 4},
        ],
      }),
    ).toBe(3)
  })

  it('never goes negative when the log overshoots', () => {
    expect(
      remainingPalletsToBuild({
        status: 'in_build',
        quantity: 2,
        buildLog: [{date: '2026-06-01', built: 5}],
      }),
    ).toBe(0)
  })

  it('treats a built pallet as fully done regardless of the log', () => {
    expect(remainingPalletsToBuild({status: 'built', quantity: 8, buildLog: []})).toBe(0)
  })
})
