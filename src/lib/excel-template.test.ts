import { describe, expect, it } from 'vitest'
import { densifyRows } from './program-template-xlsx'

describe('densifyRows (sparse xlsx rows)', () => {
  it('fills holes so findIndex callbacks never see undefined', () => {
    // Simulate SheetJS `header: 1` output: empty cells become array holes.
    const sparse: unknown[][] = []
    const row: unknown[] = []
    row[0] = 'Kayco Item#'
    row[3] = 'Half Pallet Cases' // indexes 1-2 are holes
    sparse.push(row)
    const dense = densifyRows(sparse)
    expect(dense[0]).toEqual(['Kayco Item#', '', '', 'Half Pallet Cases'])
    // The exact call pattern that crashed the import in prod (findIndex
    // visits holes, unlike map/some):
    expect(() => dense[0].findIndex((h) => h.includes('kayco'))).not.toThrow()
  })

  it('stringifies numbers and preserves dense rows', () => {
    expect(densifyRows([[110209, 5, 7]])).toEqual([['110209', '5', '7']])
  })
})
