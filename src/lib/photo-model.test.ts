import { describe, expect, it } from 'vitest'
import { analyzePhoto, looksRound, PROFILE_ROWS } from './photo-model'

// Paint a W x H white canvas, then fill pixels where inside(x, y) is true.
function paint(
  width: number,
  height: number,
  inside: (x: number, y: number) => boolean,
  color: [number, number, number] = [120, 30, 60],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const on = inside(x, y)
      pixels[i] = on ? color[0] : 255
      pixels[i + 1] = on ? color[1] : 255
      pixels[i + 2] = on ? color[2] : 255
      pixels[i + 3] = 255
    }
  }
  return pixels
}

describe('analyzePhoto', () => {
  it('finds the product bounding box inside the white margin', () => {
    const p = paint(100, 200, (x, y) => x >= 20 && x < 80 && y >= 10 && y < 190)
    const result = analyzePhoto(p, 100, 200)!
    expect(result.bbox).toEqual({ x: 20, y: 10, width: 60, height: 180 })
  })

  it('reads a straight-sided box as not curved', () => {
    const p = paint(100, 200, (x, y) => x >= 20 && x < 80 && y >= 10 && y < 190)
    const result = analyzePhoto(p, 100, 200)!
    expect(result.curved).toBe(false)
    expect(result.profile).toHaveLength(PROFILE_ROWS)
    result.profile.forEach((v) => expect(v).toBeCloseTo(1, 1))
  })

  it('reads a bottle (narrow neck on a wide body) as curved, neck at the top', () => {
    // Neck: top 30% is 20px wide; body below is 60px wide.
    const p = paint(100, 200, (x, y) => {
      if (y < 10 || y >= 190) return false
      const neck = y < 10 + 180 * 0.3
      return neck ? x >= 40 && x < 60 : x >= 20 && x < 80
    })
    const result = analyzePhoto(p, 100, 200)!
    expect(result.curved).toBe(true)
    expect(result.profile[2]).toBeLessThan(0.5) // neck
    expect(result.profile[PROFILE_ROWS - 3]).toBeCloseTo(1, 1) // body
  })

  it('reads a tapered cup as curved', () => {
    // 60px wide at the top tapering to 40px at the bottom.
    const p = paint(100, 200, (x, y) => {
      if (y < 10 || y >= 190) return false
      const t = (y - 10) / 180
      const half = 30 - 10 * t
      return Math.abs(x + 0.5 - 50) <= half
    })
    expect(analyzePhoto(p, 100, 200)!.curved).toBe(true)
  })

  it('samples the edge color from the product, not the white background', () => {
    const p = paint(100, 200, (x, y) => x >= 20 && x < 80 && y >= 10 && y < 190, [10, 120, 200])
    const [r, g, b] = analyzePhoto(p, 100, 200)!.edgeColor
    expect(r).toBeCloseTo(10, 0)
    expect(g).toBeCloseTo(120, 0)
    expect(b).toBeCloseTo(200, 0)
  })

  it('returns null for a blank image', () => {
    expect(analyzePhoto(paint(50, 50, () => false), 50, 50)).toBeNull()
  })

  it('treats transparent pixels as background', () => {
    const p = paint(40, 40, (x, y) => x >= 10 && x < 30 && y >= 10 && y < 30)
    // Make the white margin transparent black instead.
    for (let i = 0; i < p.length; i += 4) {
      if (p[i] === 255) {
        p[i] = p[i + 1] = p[i + 2] = 0
        p[i + 3] = 0
      }
    }
    expect(analyzePhoto(p, 40, 40)!.bbox).toEqual({ x: 10, y: 10, width: 20, height: 20 })
  })
})

describe('looksRound', () => {
  it('rounds a square-footprint item whose outline curves', () => {
    expect(looksRound({ width: 4.4, depth: 4.4 }, 'GRAPE JUICE 64OZ', { curved: true })).toBe(true)
  })

  it('rounds a straight-sided can by name', () => {
    expect(looksRound({ width: 3, depth: 3 }, 'TUNA CAN 5OZ', { curved: false })).toBe(true)
  })

  it('keeps a square box a box when nothing says round', () => {
    expect(looksRound({ width: 4, depth: 4 }, 'TEA BAGS 20CT', { curved: false })).toBe(false)
  })

  it('never rounds a flat, deep-and-narrow box even if it says JUICE', () => {
    expect(looksRound({ width: 6, depth: 2 }, 'JUICE BOX 6PK', { curved: true })).toBe(false)
  })
})
