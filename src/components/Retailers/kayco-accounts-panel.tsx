import { useEffect, useRef, useState } from 'react'
import { Link2, Loader2, Search, X } from 'lucide-react'
import type { Retailer } from '../../types'
import { useRetailerStore } from '../../stores/retailer-store'
import {
  searchKaycoAccounts,
  type KaycoAccountSearchHit,
} from '../../lib/kayco-sales'

// Links a retailer to its Kayco Sales Intelligence account(s). One retailer
// can map to several ship-to accounts (e.g. Costco's regional DCs); the
// program item picker sums sales across all linked accounts.
export function KaycoAccountsPanel({ retailer }: { retailer: Retailer }) {
  const updateRetailer = useRetailerStore((state) => state.updateRetailer)
  const linked = retailer.kaycoAccounts ?? []
  const linkedIds = new Set(linked.map((account) => account.id))

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<KaycoAccountSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setSearching(false)
      setSearchError(null)
      return
    }
    setSearching(true)
    debounceRef.current = window.setTimeout(() => {
      searchKaycoAccounts(trimmed)
        .then((results) => {
          setHits(results.slice(0, 12))
          setSearchError(null)
        })
        .catch(() => {
          setHits([])
          setSearchError('Account search failed. Check the sales API connection.')
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  const addAccount = (hit: KaycoAccountSearchHit) => {
    if (linkedIds.has(hit.id)) return
    updateRetailer(retailer.id, {
      kaycoAccounts: [...linked, { id: hit.id, name: hit.name }],
    })
  }

  const removeAccount = (id: string) => {
    updateRetailer(retailer.id, {
      kaycoAccounts: linked.filter((account) => account.id !== id),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#999]">
          Linked accounts
        </p>
        {linked.length === 0 ? (
          <p className="text-[12px] text-[#888] mt-2">
            No Kayco sales accounts linked yet. Search below - item sales for{' '}
            {retailer.name} stay hidden until at least one account is linked.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {linked.map((account) => (
              <li
                key={account.id}
                className="flex items-center gap-2 text-[13px] text-[#171717]"
              >
                <Link2 className="w-3.5 h-3.5 text-[#999] shrink-0" />
                <span className="truncate">{account.name}</span>
                <span className="text-[11px] text-[#999] font-mono">#{account.id}</span>
                <button
                  onClick={() => removeAccount(account.id)}
                  aria-label={`Unlink ${account.name}`}
                  className="ml-auto text-[#bbb] hover:text-[#c0392b] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Kayco accounts by name…"
            className="w-full pl-9 pr-9 h-9 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none placeholder:text-[#aaa]"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] animate-spin" />
          )}
        </div>
        {searchError && (
          <p className="text-[12px] text-[#c0392b] mt-2">{searchError}</p>
        )}
        {hits.length > 0 && (
          <ul className="mt-2 shadow-border rounded-md divide-y divide-[#f0f0f0] overflow-hidden bg-white max-h-[260px] overflow-y-auto">
            {hits.map((hit) => {
              const isLinked = linkedIds.has(hit.id)
              return (
                <li key={hit.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#171717] truncate">{hit.name}</p>
                    <p className="text-[11px] text-[#999]">
                      #{hit.id}
                      {hit.channel ? ` · ${hit.channel}` : ''}
                      {hit.netSales && hit.netSales !== '-'
                        ? ` · ${hit.netSales} net sales`
                        : ''}
                      {hit.lastOrder ? ` · last order ${hit.lastOrder}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => addAccount(hit)}
                    disabled={isLinked}
                    className={`ml-auto shrink-0 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
                      isLinked
                        ? 'text-[#bbb] cursor-default'
                        : 'text-white bg-[#171717] hover:bg-[#333]'
                    }`}
                  >
                    {isLinked ? 'Linked' : 'Link'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {!searching && !searchError && query.trim().length >= 2 && hits.length === 0 && (
          <p className="text-[12px] text-[#888] mt-2">No accounts match.</p>
        )}
      </div>
    </div>
  )
}

export function KaycoAccountsModal({
  retailer,
  open,
  onClose,
}: {
  retailer: Retailer
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div>
            <h3 className="text-[14px] font-semibold text-[#171717]">
              Kayco sales accounts
            </h3>
            <p className="text-[12px] text-[#888] mt-0.5">
              Item sales for {retailer.name} are pulled from these accounts.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#bbb] hover:text-[#666] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <KaycoAccountsPanel retailer={retailer} />
        </div>
      </div>
    </div>
  )
}
