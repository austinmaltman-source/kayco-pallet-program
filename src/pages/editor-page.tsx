import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDisplayStore } from '../stores/display-store'
import { useRetailerStore } from '../stores/retailer-store'
import { ThreeDViewer } from '../components/Editor/three-d-viewer'
import { PlanogramView } from '../components/Editor/planogram-view'
import { ProductPickerModal } from '../components/Editor/product-picker-modal'
import { PalletBuilder } from '../components/Builder/pallet-builder'
import { useRoleHref } from '../lib/role-href'
import { ArrowLeft, Box, LayoutGrid, Package, Atom } from 'lucide-react'

type EditorView = 'build' | '2d' | 'classic'

export function EditorPage() {
  const { palletId, retailerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const roleHref = useRoleHref()
  const navigate = useNavigate()
  const currentProject = useDisplayStore((state) => state.currentProject)
  const selectProject = useDisplayStore((state) => state.selectProject)
  const retailer = useRetailerStore((s) =>
    currentProject ? s.getRetailer(currentProject.retailerId) : undefined,
  )

  // ?view=3d (old links) opens the new builder; the physics sandbox stays
  // reachable as "classic" while the new builder beds in.
  const raw = searchParams.get('view')
  const view: EditorView = raw === '2d' ? '2d' : raw === 'classic' ? 'classic' : 'build'
  const setView = (next: EditorView) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    if (palletId && currentProject?.id !== palletId) {
      selectProject(palletId)
    }
  }, [palletId, currentProject?.id, selectProject])

  if (!currentProject) {
    return (
      <div className="flex-1 h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <Package size={40} className="mx-auto text-[#333] mb-4" />
          <p className="text-[15px] text-[#666] font-medium">No pallet loaded</p>
          <p className="text-[12px] text-[#444] mt-1">
            Open a retailer and create a pallet to start building.
          </p>
          <Link
            to={roleHref('/retailers')}
            className="inline-flex mt-4 px-4 py-2 rounded-md bg-white text-[#111] text-[12px] font-medium hover:bg-[#eee] transition-colors"
          >
            Go to Retailers
          </Link>
        </div>
      </div>
    )
  }

  // The builder owns the whole screen: its own top bar (back, name, tools).
  if (view === 'build') {
    return (
      <div className="fixed inset-0 z-[200] bg-white">
        <PalletBuilder
          title={currentProject.name}
          subtitle={`${retailer?.name ?? 'Pallet'} · saved automatically`}
          onBack={retailerId && palletId ? () => navigate(roleHref(`/retailers/${retailerId}/pallets/${palletId}`)) : undefined}
          onOpenPlan={() => setView('2d')}
        />
      </div>
    )
  }

  const tabs: [EditorView, string, typeof Box][] = [
    ['build', 'Build', Box],
    ['2d', '2D plan', LayoutGrid],
    ['classic', 'Classic', Atom],
  ]

  return (
    <>
      <div className="flex-1 h-screen min-w-0 flex flex-col">
        <header className="flex items-center gap-2 border-b border-black/[0.06] bg-white px-3 py-2 md:px-4">
          {retailerId && palletId && (
            <Link
              to={roleHref(`/retailers/${retailerId}/pallets/${palletId}`)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[#555] hover:bg-[#f1f3f6] hover:text-[#171717]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight-sm">{currentProject.name}</p>
            <p className="truncate text-[11px] text-[#888]">
              {retailer?.name ?? 'Pallet'} · {currentProject.palletType === 'half' ? 'Half pallet' : 'Full pallet'} ·{' '}
              {currentProject.tierCount} shelves · saves automatically
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#f1f3f6] p-0.5">
            {tabs.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                title={key === 'classic' ? 'The previous physics-based 3D editor' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  view === key ? 'bg-[#171717] text-white' : 'text-[#666] hover:text-[#171717]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className={key === 'build' ? '' : 'hidden sm:inline'}>{label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          {view === '2d' && <PlanogramView />}
          {view === 'classic' && <ThreeDViewer />}
        </div>
      </div>
      {view === 'classic' && <ProductPickerModal />}
    </>
  )
}
