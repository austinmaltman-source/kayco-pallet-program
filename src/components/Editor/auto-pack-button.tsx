import { useState } from 'react'
import { Boxes, SlidersHorizontal, X } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import type { PackOptions, PackResult } from '../../lib/packing/types'
import { DEFAULT_PACK_OPTIONS } from '../../lib/packing/types'

export function AutoPackButton() {
  const runAutoPack = useDisplayStore((state) => state.runAutoPack)
  const assortmentCount = useDisplayStore(
    (state) => state.currentProject?.assortment.filter((entry) => entry.cases > 0).length ?? 0,
  )
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<PackOptions>(DEFAULT_PACK_OPTIONS)
  const [result, setResult] = useState<PackResult | null>(null)

  const run = () => {
    const next = runAutoPack(options)
    if (next) setResult(next)
  }

  return (
    <div className="absolute right-4 top-20 z-30 flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((value) => !value)}
        disabled={assortmentCount === 0}
        className="h-9 px-3 rounded-md bg-[#171717] text-white text-[12px] font-medium inline-flex items-center gap-2 shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Boxes size={15} />
        Auto-pack
      </button>

      {open && (
        <div className="w-[280px] rounded-lg bg-white shadow-elevated border border-black/5 p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-[#555]" />
              <p className="text-[12px] font-semibold text-[#171717]">Pack options</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[#777] hover:bg-[#fafafa]"
              aria-label="Close auto-pack options"
            >
              <X size={14} />
            </button>
          </div>

          <label className="block text-[10px] uppercase tracking-wider text-[#777] mb-1">
            Pattern
          </label>
          <select
            value={options.pattern}
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                pattern: event.target.value as PackOptions['pattern'],
              }))
            }
            className="w-full rounded-md border border-[#ddd] px-2 py-1.5 text-[12px] text-[#171717] bg-white"
          >
            <option value="column">Column</option>
            <option value="interlock">Interlock</option>
            <option value="pinwheel">Pinwheel</option>
          </select>

          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between gap-3 text-[12px] text-[#333]">
              Respect fragile
              <input
                type="checkbox"
                checked={options.respectFragile}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    respectFragile: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[12px] text-[#333]">
              Light on top
              <input
                type="checkbox"
                checked={options.lightOnTop}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    lightOnTop: event.target.checked,
                  }))
                }
              />
            </label>
          </div>

          <button
            onClick={run}
            className="mt-3 w-full h-8 rounded-md bg-[#171717] text-white text-[12px] font-medium"
          >
            Pack pallet
          </button>

          {result && (
            <div className="mt-3 border-t border-[#eee] pt-2">
              <p className="text-[11px] text-[#555]">
                <span className="tabular-nums font-semibold text-[#171717]">
                  {result.placements.length}
                </span>{' '}
                placed
                {result.unplaced.length > 0 && (
                  <>
                    {' '}
                    /{' '}
                    <span className="tabular-nums font-semibold text-[#b42318]">
                      {result.unplaced.length}
                    </span>{' '}
                    unplaced
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
