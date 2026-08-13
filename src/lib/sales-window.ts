// Period selection for the sales columns in the program item picker.
// "all" uses the live per-item dashboard API (all-time totals); the rest hit
// /api/sales/summary over the monthly history table synced from the Azure
// warehouse (month granularity - see migrations/0002_sales_monthly.sql).

export type SalesWindow =
  | { kind: 'all' }
  | { kind: 'r12' }
  | { kind: 'ytd' }
  | { kind: 'custom'; from: string; to: string } // YYYY-MM, inclusive

export interface MonthRange {
  from: string
  to: string
}

function ym(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  return ym(new Date(y, m - 1 + n, 1))
}

// Resolves a window to an inclusive month range, or null for all-time.
// r12 = the 12 months ending in the current month (11 back + current).
export function resolveWindowMonths(
  window: SalesWindow,
  now: Date = new Date(),
): MonthRange | null {
  const current = ym(now)
  switch (window.kind) {
    case 'all':
      return null
    case 'r12':
      return { from: addMonths(current, -11), to: current }
    case 'ytd':
      return { from: `${now.getFullYear()}-01`, to: current }
    case 'custom': {
      const valid = /^\d{4}-\d{2}$/
      if (!valid.test(window.from) || !valid.test(window.to)) return null
      return window.from <= window.to
        ? { from: window.from, to: window.to }
        : { from: window.to, to: window.from }
    }
  }
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_LABELS[(m ?? 1) - 1]} ${y}`
}

export function windowLabel(window: SalesWindow): string {
  switch (window.kind) {
    case 'all':
      return 'All time'
    case 'r12':
      return 'Rolling 12 mo'
    case 'ytd':
      return 'YTD'
    case 'custom': {
      const range = resolveWindowMonths(window)
      if (!range) return 'Custom'
      return `${formatMonth(range.from)} – ${formatMonth(range.to)}`
    }
  }
}
