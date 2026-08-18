import { describe, expect, it } from 'vitest'
import { casesToSleeves, formatCasesExact, sleevesToCases } from './subunits'

describe('sleeve math', () => {
  it('2 sleeves of a 10-per-case item is exactly 0.2 cases', () => {
    expect(sleevesToCases(2, 10)).toBe(0.2)
    expect(casesToSleeves(0.2, 10)).toBe(2)
  })

  it('round-trips without float drift', () => {
    for (const per of [4, 6, 10, 12]) {
      for (let s = 0; s <= 3 * per; s++) {
        expect(casesToSleeves(sleevesToCases(s, per), per)).toBe(s)
      }
    }
  })

  it('guards junk input', () => {
    expect(sleevesToCases(-1, 10)).toBe(0)
    expect(sleevesToCases(2, 0)).toBe(0)
    expect(casesToSleeves(NaN, 10)).toBe(0)
  })

  it('formats fractional cases without inventing precision', () => {
    expect(formatCasesExact(0.2)).toBe('0.2')
    expect(formatCasesExact(1354.5)).toBe('1,354.5')
    expect(formatCasesExact(299)).toBe('299')
  })
})
