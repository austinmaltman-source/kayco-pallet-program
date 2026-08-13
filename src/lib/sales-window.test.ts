import { describe, expect, it } from 'vitest'
import {
  addMonths,
  resolveWindowMonths,
  windowLabel,
} from './sales-window'

describe('sales-window', () => {
  const now = new Date(2026, 7, 13) // Aug 13, 2026

  it('addMonths crosses year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2025-12', 1)).toBe('2026-01')
    expect(addMonths('2026-08', -11)).toBe('2025-09')
  })

  it('rolling 12 = current month plus previous 11', () => {
    expect(resolveWindowMonths({ kind: 'r12' }, now)).toEqual({
      from: '2025-09',
      to: '2026-08',
    })
  })

  it('YTD = January through current month', () => {
    expect(resolveWindowMonths({ kind: 'ytd' }, now)).toEqual({
      from: '2026-01',
      to: '2026-08',
    })
  })

  it('all-time resolves to null (live API path)', () => {
    expect(resolveWindowMonths({ kind: 'all' }, now)).toBeNull()
  })

  it('custom swaps inverted ranges and rejects junk', () => {
    expect(
      resolveWindowMonths({ kind: 'custom', from: '2026-06', to: '2026-02' }, now),
    ).toEqual({ from: '2026-02', to: '2026-06' })
    expect(
      resolveWindowMonths({ kind: 'custom', from: 'nope', to: '2026-02' }, now),
    ).toBeNull()
  })

  it('labels read cleanly', () => {
    expect(windowLabel({ kind: 'r12' })).toBe('Rolling 12 mo')
    expect(windowLabel({ kind: 'custom', from: '2026-02', to: '2026-06' })).toBe(
      'Feb 2026 – Jun 2026',
    )
  })
})
