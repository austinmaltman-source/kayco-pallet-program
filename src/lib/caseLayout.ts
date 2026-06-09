// Derive a physical case layout (cols x rows x layers) from a product's
// unitsPerCase. Used when the catalog has real per-unit dimensions and a
// case count but no authored caseConfig. The factorization is exact so a
// case of 12 renders exactly 12 units.
export function deriveCaseLayout(unitsPerCase: number): {
  cols: number
  rows: number
  layers: number
} {
  const count = Math.max(1, Math.floor(unitsPerCase))

  // Large even counts stack in two layers, like real shippers.
  const layers = count > 16 && count % 2 === 0 ? 2 : 1
  const perLayer = count / layers

  // Squarest exact factor pair, widest first.
  let cols = perLayer
  let rows = 1
  for (let b = 1; b * b <= perLayer; b += 1) {
    if (perLayer % b === 0) {
      cols = perLayer / b
      rows = b
    }
  }

  return { cols, rows, layers }
}
