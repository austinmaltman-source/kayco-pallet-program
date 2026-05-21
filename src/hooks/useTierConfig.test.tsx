import {renderHook} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import {useTierConfig} from './useTierConfig'

describe('useTierConfig', () => {
  it('clamps tier counts and applies half pallet depth', () => {
    const {result} = renderHook(() => useTierConfig(10, 60, 'half'))

    expect(result.current).toHaveLength(6)
    expect(result.current.every((tier) => tier.depth === 20)).toBe(true)
    // Half pallets use the Kayco tower geometry: constant trayHeight per tier,
    // slotGridSize tapers smaller toward the top, yOffsets strictly increase.
    expect(result.current[0].slotGridSize).toBeGreaterThan(result.current.at(-1)!.slotGridSize)
    expect(result.current[1].yOffset).toBeGreaterThan(result.current[0].yOffset)
  })

  it('enforces the lower bound for tier count', () => {
    const {result} = renderHook(() => useTierConfig(1))

    expect(result.current).toHaveLength(2)
  })
})
