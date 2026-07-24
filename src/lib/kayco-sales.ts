// Client for the Kayco Sales Intelligence API, reached through the /api/kayco
// proxy (vite dev proxy locally, api/kayco/[...path].ts edge function on
// Vercel). Read-only. Data freshness upstream is ~daily, so responses are
// cached in localStorage with a TTL.
//
// Source of truth for per-item, per-customer sales is /items/:id/accounts -
// the /orders endpoint does NOT reconcile (partial order-line coverage) and
// its `balance` field is not line revenue. Verified 2026-07-24.

export interface KaycoAccountRef {
  id: string
  name: string
}

export interface KaycoAccountSearchHit {
  id: string
  name: string
  channel: string
  region: string
  rep: string
  cases: string
  netSales: string
  lastOrder: string
}

// Row of /items/:id/accounts - numbers arrive as display strings.
export interface ItemAccountRow {
  id: string
  name: string
  cases: string
  orders: string
  netSales: string
  lastOrder: string
}

export interface ItemCustomerSales {
  cases: number
  netSales: number
  orders: number
  lastOrder: string | null
}

const API_BASE = '/api/kayco'
const CACHE_PREFIX = 'pf-kayco-item-accounts:'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // upstream syncs ~daily

// API item ids are unpadded Kayco item numbers ("730992"); catalog data may
// carry whitespace or zero-padding.
export function normalizeKaycoItemNumber(raw: string | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim().replace(/^0+(?=\d)/, '')
  return /^\d+$/.test(trimmed) ? trimmed : ''
}

// Parses the API's display strings: "8,880", "240.0", "$84,470", "$1.0M",
// "$737.7K", "-" or "" -> 0.
export function parseKaycoNumber(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const text = raw.trim()
  if (!text || text === '-') return 0
  const match = text.match(/^\$?\s*(-?[\d,]+(?:\.\d+)?)\s*([KMB])?$/i)
  if (!match) return 0
  const base = parseFloat(match[1].replace(/,/g, ''))
  if (!Number.isFinite(base)) return 0
  const suffix = match[2]?.toUpperCase()
  const factor = suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : 1
  return base * factor
}

// Sums the rows belonging to the given account ids. Items the customer never
// bought simply have no rows -> all zeros.
export function summarizeItemSales(
  rows: ItemAccountRow[],
  accountIds: ReadonlySet<string>,
): ItemCustomerSales {
  let cases = 0
  let netSales = 0
  let orders = 0
  let lastOrder: string | null = null
  for (const row of rows) {
    if (!accountIds.has(row.id)) continue
    cases += parseKaycoNumber(row.cases)
    netSales += parseKaycoNumber(row.netSales)
    orders += parseKaycoNumber(row.orders)
    if (row.lastOrder && (!lastOrder || row.lastOrder > lastOrder)) {
      lastOrder = row.lastOrder
    }
  }
  return { cases, netSales, orders, lastOrder }
}

async function fetchKaycoJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw new Error(`Kayco API ${res.status} on ${path}`)
  }
  const body = (await res.json()) as { data: T }
  return body.data
}

export async function searchKaycoAccounts(
  query: string,
): Promise<KaycoAccountSearchHit[]> {
  const hits = await fetchKaycoJson<KaycoAccountSearchHit[]>(
    `/accounts?search=${encodeURIComponent(query)}`,
  )
  return Array.isArray(hits) ? hits : []
}

interface CacheEntry {
  fetchedAt: number
  rows: ItemAccountRow[]
}

function readCache(itemNumber: string): ItemAccountRow[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${itemNumber}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!entry.fetchedAt || Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return Array.isArray(entry.rows) ? entry.rows : null
  } catch {
    return null
  }
}

function writeCache(itemNumber: string, rows: ItemAccountRow[]) {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), rows }
    localStorage.setItem(`${CACHE_PREFIX}${itemNumber}`, JSON.stringify(entry))
  } catch {
    // Storage full or unavailable - caching is best-effort.
  }
}

const inFlight = new Map<string, Promise<ItemAccountRow[]>>()

// All accounts with activity on an item. Cached (localStorage, 12h TTL) and
// deduped across concurrent callers.
export function fetchItemAccounts(itemNumber: string): Promise<ItemAccountRow[]> {
  const id = normalizeKaycoItemNumber(itemNumber)
  if (!id) return Promise.resolve([])
  const cached = readCache(id)
  if (cached) return Promise.resolve(cached)
  const pending = inFlight.get(id)
  if (pending) return pending
  const request = fetchKaycoJson<ItemAccountRow[]>(`/items/${id}/accounts`)
    .then((rows) => {
      const safe = Array.isArray(rows) ? rows : []
      writeCache(id, safe)
      return safe
    })
    .finally(() => {
      inFlight.delete(id)
    })
  inFlight.set(id, request)
  return request
}

export function formatSalesCases(value: number): string {
  if (value <= 0) return '—'
  return Math.round(value).toLocaleString('en-US')
}

export function formatSalesDollars(value: number): string {
  if (value <= 0) return '—'
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 10e3) return `$${Math.round(value / 1e3)}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function formatSalesDate(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
