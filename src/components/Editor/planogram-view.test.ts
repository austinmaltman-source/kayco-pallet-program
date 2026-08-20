import { describe, expect, it } from 'vitest'
import { faceOf } from './planogram-view'

// A 48x40 pallet: front/back edges at z = +/-20, side edges at x = +/-24.
const PALLET = { width: 48, depth: 40 }

describe('planogram face classification', () => {
  it('keeps the far end of the front row on the front face', () => {
    // The right-hand end of the front row: large x, but pressed against the
    // FRONT edge. Naive axis dominance calls this 'right' and hides it from
    // the front elevation.
    expect(faceOf([22, 30, 19], PALLET)).toBe('front')
    expect(faceOf([-22, 30, 19], PALLET)).toBe('front')
  })

  it('puts items pressed against a side edge on that side', () => {
    expect(faceOf([23, 30, 8], PALLET)).toBe('right')
    expect(faceOf([-23, 30, -8], PALLET)).toBe('left')
  })

  it('reads the back row as back', () => {
    expect(faceOf([0, 30, -19], PALLET)).toBe('back')
    expect(faceOf([21, 30, -19], PALLET)).toBe('back')
  })
})
