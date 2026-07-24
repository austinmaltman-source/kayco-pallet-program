import { useEffect, useMemo, useState } from 'react'
import {
  fetchItemAccounts,
  normalizeKaycoItemNumber,
  summarizeItemSales,
  type ItemCustomerSales,
} from '../lib/kayco-sales'

const CONCURRENCY = 5

// Per-item sales scoped to a customer (a set of linked Kayco account ids).
// Returns a map keyed by normalized Kayco item number. Fetches one API call
// per item (localStorage-cached for 12h in the lib), a few at a time, and
// fills the map incrementally as batches land.
export function useRetailerItemSales(
  accountIds: string[],
  itemNumbers: string[],
): {
  sales: Map<string, ItemCustomerSales>
  loading: boolean
  error: string | null
} {
  const accountKey = useMemo(() => [...accountIds].sort().join('|'), [accountIds])
  const itemKey = useMemo(
    () =>
      Array.from(
        new Set(itemNumbers.map(normalizeKaycoItemNumber).filter(Boolean)),
      )
        .sort()
        .join('|'),
    [itemNumbers],
  )

  const [sales, setSales] = useState<Map<string, ItemCustomerSales>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const accounts = new Set(accountKey ? accountKey.split('|') : [])
    const items = itemKey ? itemKey.split('|') : []
    if (accounts.size === 0 || items.length === 0) {
      setSales(new Map())
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const results = new Map<string, ItemCustomerSales>()
    let failures = 0

    const flush = () => {
      if (!cancelled) setSales(new Map(results))
    }

    const run = async () => {
      for (let i = 0; i < items.length; i += CONCURRENCY) {
        if (cancelled) return
        const batch = items.slice(i, i + CONCURRENCY)
        await Promise.all(
          batch.map(async (itemNumber) => {
            try {
              const rows = await fetchItemAccounts(itemNumber)
              results.set(itemNumber, summarizeItemSales(rows, accounts))
            } catch {
              failures += 1
            }
          }),
        )
        flush()
      }
      if (cancelled) return
      setLoading(false)
      if (failures > 0) {
        setError(
          failures === items.length
            ? 'Sales data unavailable right now.'
            : `Sales data missing for ${failures} item${failures === 1 ? '' : 's'}.`,
        )
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [accountKey, itemKey])

  return { sales, loading, error }
}
