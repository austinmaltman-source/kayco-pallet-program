import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Gauge } from 'lucide-react'
import { computeKPIs } from '../../lib/kpis'
import { useCatalogStore } from '../../stores/catalog-store'
import { useDisplayStore } from '../../stores/display-store'
import type { PalletWarning } from '../../types'
import { RetailerSpecPicker } from './retailer-spec-picker'

function pct(value: number): string {
  return `${Math.round(value)}%`
}

function warningText(warning: PalletWarning): string {
  switch (warning.kind) {
    case 'overweight':
      return `Weight ${warning.lb.toFixed(0)} lb exceeds ${warning.maxLb.toFixed(0)} lb.`
    case 'overhang':
      return `Overhang ${warning.overhangIn.toFixed(1)} in.`
    case 'overheight':
      return `Height ${warning.usedIn.toFixed(1)} in exceeds ${warning.maxIn.toFixed(1)} in.`
    case 'crush':
      return `Stack load ${warning.loadAboveLb.toFixed(1)} lb exceeds ${warning.maxLoadLb.toFixed(1)} lb.`
    case 'unsupported':
      return `Support is ${warning.supportPct.toFixed(0)}%.`
    case 'fragile-under-heavy':
      return 'Fragile case has a heavier case above it.'
    case 'orientation-disallowed':
      return `${warning.orientation} orientation is not allowed.`
  }
}

function warningPlacementId(warning: PalletWarning): string | null {
  if (warning.kind === 'overweight' || warning.kind === 'overheight') return null
  return warning.placementId
}

export function CompliancePanel() {
  const currentProject = useDisplayStore((state) => state.currentProject)
  const selectProduct = useDisplayStore((state) => state.selectProduct)
  const products = useCatalogStore((state) => state.products)

  const kpis = useMemo(() => {
    if (!currentProject?.palletSpec) return null
    return computeKPIs(currentProject.placements, currentProject.palletSpec, products)
  }, [currentProject, products])

  if (!currentProject?.palletSpec || !kpis) return null

  const spec = currentProject.palletSpec
  const hasWarnings = kpis.warnings.length > 0

  return (
    <div className="absolute right-4 bottom-6 z-30 w-[320px] rounded-lg bg-white shadow-elevated border border-black/5 p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Gauge size={15} className="text-[#555]" />
          <p className="text-[12px] font-semibold text-[#171717]">Compliance</p>
        </div>
        <RetailerSpecPicker />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Height" value={`${kpis.heightUsedIn.toFixed(1)} in`} pct={(kpis.heightUsedIn / spec.maxHeightIn) * 100} />
        <Metric label="Weight" value={`${kpis.totalWeightLb.toFixed(0)} lb`} pct={kpis.weightUtilizationPct} />
        <Metric label="Cube" value={pct(kpis.cubeUtilizationPct)} pct={kpis.cubeUtilizationPct} />
        <Metric label="Footprint" value={pct(kpis.footprintUtilizationPct)} pct={kpis.footprintUtilizationPct} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[#555]">
        <span>
          <span className="tabular-nums font-semibold text-[#171717]">{kpis.totalCases}</span> cases
        </span>
        <span>
          <span className="tabular-nums font-semibold text-[#171717]">{kpis.totalUnits}</span> units
        </span>
      </div>

      <div className="mt-3 border-t border-[#eee] pt-2">
        <div className="flex items-center gap-2 mb-2">
          {hasWarnings ? (
            <AlertTriangle size={14} className="text-[#b42318]" />
          ) : (
            <CheckCircle2 size={14} className="text-emerald-600" />
          )}
          <p className="text-[11px] font-medium text-[#555]">
            {hasWarnings ? `${kpis.warnings.length} warning${kpis.warnings.length === 1 ? '' : 's'}` : 'No warnings'}
          </p>
        </div>

        {hasWarnings && (
          <ul className="max-h-32 overflow-auto space-y-1">
            {kpis.warnings.map((warning, index) => {
              const placementId = warningPlacementId(warning)
              return (
                <li key={`${warning.kind}-${index}`}>
                  <button
                    onClick={() => placementId && selectProduct(placementId)}
                    disabled={!placementId}
                    className="w-full text-left rounded-md px-2 py-1 text-[11px] text-[#555] hover:bg-[#fafafa] disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    {warningText(warning)}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, pct }: { label: string; value: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const danger = pct > 100

  return (
    <div className="rounded-md border border-[#eee] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[#777]">{label}</span>
        <span className="text-[11px] font-semibold text-[#171717] tabular-nums">{value}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#eee] overflow-hidden">
        <div
          className={`h-full ${danger ? 'bg-[#b42318]' : 'bg-[#171717]'}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
