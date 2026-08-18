export function roundToDecimals(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function formatWeight(value: number) {
  return roundToDecimals(value, 2).toFixed(2)
}

// Comma-grouped whole numbers; fractional quantities round UP (a partial
// case still has to be built/shipped): 3588 -> "3,588", 854.5 -> "855".
export function formatQty(value: number): string {
  return Math.ceil(value).toLocaleString('en-US')
}
