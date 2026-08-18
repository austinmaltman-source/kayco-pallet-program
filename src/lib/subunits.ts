// Sleeve / inner-pack math. Some items are ordered in sub-case sleeves
// (e.g. 10 sleeves per case), which is why assortments can hold fractional
// cases like 0.2 (= 2 sleeves). `Product.sleevesPerCase` marks such items;
// quantities for them are ENTERED in whole sleeves and stored as fractional
// cases (cases stay the canonical unit everywhere - exports, sync, math).

export function sleevesToCases(sleeves: number, sleevesPerCase: number): number {
  if (!Number.isFinite(sleeves) || sleeves <= 0 || sleevesPerCase <= 0) return 0
  // Round to 4dp so 2 sleeves of 10/case is exactly 0.2, not 0.20000000004.
  return Math.round((Math.round(sleeves) / sleevesPerCase) * 10000) / 10000
}

export function casesToSleeves(cases: number, sleevesPerCase: number): number {
  if (!Number.isFinite(cases) || cases <= 0 || sleevesPerCase <= 0) return 0
  return Math.round(cases * sleevesPerCase)
}

// Display for possibly-fractional case counts (sleeve items): comma-grouped,
// up to 2 decimals only when actually fractional. Whole-case items keep the
// round-up display (formatQty).
export function formatCasesExact(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
