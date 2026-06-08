import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import type { PackResult } from '../../lib/packing/types'
import { DEFAULT_PACK_OPTIONS } from '../../lib/packing/types'

export function AutoPackButton() {
  const runAutoPack = useDisplayStore((state) => state.runAutoPack)
  const assortmentCount = useDisplayStore(
    (state) => state.currentProject?.assortment.filter((entry) => entry.cases > 0).length ?? 0,
  )
  const [result, setResult] = useState<PackResult | null>(null)

  const run = () => {
    const next = runAutoPack(DEFAULT_PACK_OPTIONS)
    if (next) setResult(next)
  }

  return (
    <div className="absolute right-4 top-20 z-30 flex flex-col items-end gap-2">
      <button
        onClick={run}
        disabled={assortmentCount === 0}
        className="h-9 px-3 rounded-md bg-[#171717] text-white text-[12px] font-medium inline-flex items-center gap-2 shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Boxes size={15} />
        Auto-pack cases
      </button>

      {result && (
        <div className="w-[260px] rounded-lg bg-white shadow-elevated border border-black/5 p-3">
          <p className="text-[11px] text-[#555]">
            <span className="tabular-nums font-semibold text-[#171717]">
              {result.placements.length}
            </span>{' '}
            cases placed
            {result.unplaced.length > 0 && (
              <>
                {' '}
                /{' '}
                <span className="tabular-nums font-semibold text-[#b42318]">
                  {result.unplaced.length}
                </span>{' '}
                could not fit
              </>
            )}
          </p>
          {result.unplaced.length > 0 && (
            <ul className="mt-2 max-h-28 overflow-auto space-y-1">
              {result.unplaced.slice(0, 5).map((entry, index) => (
                <li key={`${entry.productId}-${index}`} className="text-[11px] text-[#777]">
                  {entry.productName}: {entry.reason}
                </li>
              ))}
            </ul>
          )}
          {result.ruleWarnings && result.ruleWarnings.length > 0 && (
            <ul className="mt-2 max-h-20 overflow-auto space-y-1">
              {result.ruleWarnings.slice(0, 3).map((entry, index) => (
                <li key={`${entry.ruleKind}-${index}`} className="text-[11px] text-[#9a3412]">
                  {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
