import { useEffect, useMemo, useState } from 'react'
import { resolveWindowMonths, type SalesWindow } from '../lib/sales-window'

export interface WindowedItemSales {
  cases: number
  netSales: number
}

interface SummaryResponse {
  data?: {
    ready: boolean
    syncedAt?: string
    items?: { itemKey: string; cases: number; netCents: number }[]
  }
}

const cache = new Map<string, { ready: boolean; map: Map<string, WindowedItemSales> }>()

// Windowed per-item sales for a customer (account ids + name patterns) from
// /api/sales/summary. Returns ready=false when the history sync has not
// populated the backend yet (the UI then falls back to all-time).
export function useWindowedItemSales(
  accountIds: string[],
  accountPatterns: string[],
  window: SalesWindow,
): {
  windowed: Map<string, WindowedItemSales> | null
  windowReady: boolean
  windowLoading: boolean
} {
  const range = useMemo(() => resolveWindowMonths(window), [window])
  const key = useMemo(
    () =>
      range
        ? [
            range.from,
            range.to,
            [...accountIds].sort().join(','),
            accountPatterns.map((p) => p.trim().toUpperCase()).filter(Boolean).sort().join('|'),
          ].join('#')
        : null,
    [range, accountIds, accountPatterns],
  )

  const [state, setState] = useState<{
    key: string | null
    ready: boolean
    map: Map<string, WindowedItemSales> | null
    loading: boolean
  }>({ key: null, ready: true, map: null, loading: false })

  useEffect(() => {
    if (!key || !range) {
      setState({ key: null, ready: true, map: null, loading: false })
      return
    }
    const cached = cache.get(key)
    if (cached) {
      setState({ key, ready: cached.ready, map: cached.map, loading: false })
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, key, loading: true }))
    const params = new URLSearchParams({ from: range.from, to: range.to })
    const ids = accountIds.filter(Boolean).join(',')
    const patterns = accountPatterns.map((p) => p.trim()).filter(Boolean).join('|')
    if (ids) params.set('ids', ids)
    if (patterns) params.set('patterns', patterns)
    fetch(`/api/sales/summary?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`summary ${res.status}`)
        const body = (await res.json()) as SummaryResponse
        const ready = body.data?.ready === true
        const map = new Map<string, WindowedItemSales>()
        for (const item of body.data?.items ?? []) {
          map.set(item.itemKey, {
            cases: item.cases,
            netSales: item.netCents / 100,
          })
        }
        cache.set(key, { ready, map })
        if (!cancelled) setState({ key, ready, map, loading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ key, ready: false, map: null, loading: false })
      })
    return () => {
      cancelled = true
    }
    // range is derived from key; accountIds/patterns folded into key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    windowed: state.map,
    windowReady: state.ready,
    windowLoading: state.loading,
  }
}
