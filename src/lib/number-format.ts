export function roundToDecimals(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function formatWeight(value: number) {
  return roundToDecimals(value, 2).toFixed(2)
}

// Comma-grouped with at most 2 decimals: 3588 -> "3,588", 854.5 -> "854.5".
export function formatQty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
