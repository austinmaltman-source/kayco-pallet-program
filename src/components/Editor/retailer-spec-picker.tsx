import { PALLET_SPECS, getDefaultPalletSpec } from '../../lib/retailer-specs'
import { useDisplayStore } from '../../stores/display-store'
import type { PalletSpec, RetailerPreset } from '../../types'

const PRESETS: Array<{ value: RetailerPreset | 'default'; label: string }> = [
  { value: 'default', label: 'GMA' },
  { value: 'costco', label: 'Costco' },
  { value: 'sams', label: "Sam's" },
  { value: 'walmart', label: 'Walmart' },
  { value: 'bjs', label: "BJ's" },
]

export function RetailerSpecPicker() {
  const currentProject = useDisplayStore((state) => state.currentProject)
  const updatePalletSpec = useDisplayStore((state) => state.updatePalletSpec)

  if (!currentProject) return null

  const currentValue = currentProject.palletSpec?.retailerPreset ?? 'default'

  const pickSpec = (value: RetailerPreset | 'default'): PalletSpec => {
    if (value === 'default') return getDefaultPalletSpec(currentProject.palletType)
    const preset = PALLET_SPECS.find((spec) => spec.retailerPreset === value)
    const next = preset ?? getDefaultPalletSpec(currentProject.palletType)
    return currentProject.palletType === 'half'
      ? { ...next, id: 'half-48x20', depthIn: 20, label: `${next.label} half` }
      : next
  }

  return (
    <select
      value={currentValue}
      onChange={(event) =>
        updatePalletSpec(pickSpec(event.target.value as RetailerPreset | 'default'))
      }
      className="h-8 rounded-md border border-[#ddd] bg-white px-2 text-[12px] font-medium text-[#171717]"
      aria-label="Retailer pallet spec"
    >
      {PRESETS.map((preset) => (
        <option key={preset.value} value={preset.value}>
          {preset.label}
        </option>
      ))}
    </select>
  )
}
