import { useMemo } from 'react'
import { Boxes, Package, Weight, type LucideIcon } from 'lucide-react'
import { computeKPIs } from '../../lib/kpis'
import { useCatalogStore } from '../../stores/catalog-store'
import { useDisplayStore } from '../../stores/display-store'

export function CompliancePanel() {
  const currentProject = useDisplayStore((state) => state.currentProject)
  const products = useCatalogStore((state) => state.products)

  const kpis = useMemo(() => {
    if (!currentProject?.palletSpec) return null
    return computeKPIs(currentProject.placements, currentProject.palletSpec, products)
  }, [currentProject, products])

  if (!currentProject?.palletSpec || !kpis) return null

  const metrics = [
    {
      label: 'Cases',
      value: kpis.totalCases.toLocaleString(),
      icon: Boxes,
    },
    {
      label: 'Units',
      value: kpis.totalUnits.toLocaleString(),
      icon: Package,
    },
    {
      label: 'Weight',
      value: `${Math.round(kpis.totalWeightLb).toLocaleString()} lb`,
      icon: Weight,
    },
  ]

  return (
    <div className="absolute right-4 bottom-6 z-30 w-[280px] rounded-lg bg-white shadow-elevated border border-black/5 p-3">
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-[#171717]">Pallet totals</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-md border border-[#eee] p-2">
      <Icon size={13} className="text-[#777]" />
      <p className="mt-2 text-[10px] uppercase tracking-wider text-[#777]">{label}</p>
      <p className="text-[13px] font-semibold text-[#171717] tabular-nums">{value}</p>
    </div>
  )
}
