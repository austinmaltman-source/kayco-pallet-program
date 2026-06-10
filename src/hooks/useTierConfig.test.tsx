import {renderHook} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import {useTierConfig} from './useTierConfig'

describe('useTierConfig', () => {
  it('clamps tier counts and applies half pallet depth', () => {
    const {result} = renderHook(() => useTierConfig(10, 60, 'half'))

    expect(result.current).toHaveLength(6)
    expect(result.current.every((tier) => tier.depth === 20)).toBe(true)
    // Half pallet shelves mirror the Kayco DisplayStructure: uniform 9" rows on an 11" stride
    expect(result.current.every((tier) => tier.trayHeight === 9)).toBe(true)
    expect(result.current[1].yOffset - result.current[0].yOffset).toBe(11)
  })

  it('tapers tray heights on full pallets', () => {
    const {result} = renderHook(() => useTierConfig(4, 60, 'full'))

    expect(result.current[0].trayHeight).toBeGreaterThan(result.current.at(-1)!.trayHeight)
    expect(result.current[1].yOffset).toBe(result.current[0].trayHeight + 1)
  })

  it('enforces the lower bound for tier count', () => {
    const {result} = renderHook(() => useTierConfig(1))

    expect(result.current).toHaveLength(2)
  })
})
