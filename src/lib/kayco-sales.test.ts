import { describe, expect, it } from 'vitest'
import {
  normalizeKaycoItemNumber,
  parseKaycoNumber,
  summarizeItemSales,
  type ItemAccountRow,
} from './kayco-sales'

describe('parseKaycoNumber', () => {
  it('parses plain and comma-grouped numbers', () => {
    expect(parseKaycoNumber('8,880')).toBe(8880)
    expect(parseKaycoNumber('240.0')).toBe(240)
    expect(parseKaycoNumber('27')).toBe(27)
  })

  it('parses dollar strings including K/M abbreviations', () => {
    expect(parseKaycoNumber('$84,470')).toBe(84470)
    expect(parseKaycoNumber('$737.7K')).toBeCloseTo(737700)
    expect(parseKaycoNumber('$1.0M')).toBeCloseTo(1_000_000)
  })

  it('returns 0 for blanks, dashes, and junk', () => {
    expect(parseKaycoNumber('')).toBe(0)
    expect(parseKaycoNumber('-')).toBe(0)
    expect(parseKaycoNumber(undefined)).toBe(0)
    expect(parseKaycoNumber('n/a')).toBe(0)
  })

  it('passes numbers through', () => {
    expect(parseKaycoNumber(30464.21)).toBe(30464.21)
  })
})

describe('normalizeKaycoItemNumber', () => {
  it('trims whitespace and zero padding', () => {
    expect(normalizeKaycoItemNumber(' 730992 ')).toBe('730992')
    expect(normalizeKaycoItemNumber('000730992')).toBe('730992')
  })

  it('rejects non-numeric values', () => {
    expect(normalizeKaycoItemNumber('ABC123')).toBe('')
    expect(normalizeKaycoItemNumber(undefined)).toBe('')
    expect(normalizeKaycoItemNumber('')).toBe('')
  })
})

describe('summarizeItemSales', () => {
  const rows: ItemAccountRow[] = [
    { id: '40129', name: 'COSTCO NJ', cases: '8,880', orders: '27', netSales: '$1.0M', lastOrder: '2026-07-09' },
    { id: '40121', name: 'COSTCO SD', cases: '6,288', orders: '15', netSales: '$737.7K', lastOrder: '2026-06-24' },
    { id: '99999', name: 'SOME OTHER STORE', cases: '500', orders: '2', netSales: '$50,000', lastOrder: '2026-07-20' },
  ]

  it('sums only the linked accounts and takes the latest of their order dates', () => {
    const summary = summarizeItemSales(rows, new Set(['40129', '40121']))
    expect(summary.cases).toBe(15168)
    expect(summary.netSales).toBeCloseTo(1_737_700)
    expect(summary.orders).toBe(42)
    // 2026-07-20 belongs to an unlinked account and must not leak in.
    expect(summary.lastOrder).toBe('2026-07-09')
  })

  it('returns zeros when the customer never bought the item', () => {
    const summary = summarizeItemSales(rows, new Set(['12345']))
    expect(summary).toEqual({ cases: 0, netSales: 0, orders: 0, lastOrder: null })
  })
})
