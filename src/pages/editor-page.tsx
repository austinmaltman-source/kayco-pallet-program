import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useDisplayStore } from '../stores/display-store'
import { useRoleStore } from '../stores/role-store'
import { ThreeDViewer } from '../components/Editor/three-d-viewer'
import { PlanogramView } from '../components/Editor/planogram-view'
import { ProductPickerModal } from '../components/Editor/product-picker-modal'
import { useRoleHref } from '../lib/role-href'
import { ArrowLeft, Box, LayoutGrid, Package } from 'lucide-react'

export function EditorPage() {
  const { palletId, retailerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const roleHref = useRoleHref()
  const role = useRoleStore((state) => state.role)
  const currentProject = useDisplayStore((state) => state.currentProject)
  const selectProject = useDisplayStore((state) => state.selectProject)

  const view = searchParams.get('view') === '2d' ? '2d' : '3d'
  const setView = (next: '2d' | '3d') => {
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

  const isSalesman = role === 'salesman'

  return (
    <>
      <div className="flex-1 h-screen relative">
        {!isSalesman && retailerId && palletId && (
          <div className="absolute left-4 top-5 z-[60]">
            <Link
              to={roleHref(`/retailers/${retailerId}/pallets/${palletId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 backdrop-blur text-[12px] font-medium text-[#555] hover:text-[#171717] shadow-card transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to pallet
            </Link>
          </div>
        )}

        {/* 2D / 3D switch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-white/95 backdrop-blur shadow-card">
            <button
              onClick={() => setView('2d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                view === '2d'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#777] hover:text-[#171717]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              2D
            </button>
            <button
              onClick={() => setView('3d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                view === '3d'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#777] hover:text-[#171717]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D
            </button>
          </div>
        </div>

        {view === '2d' ? <PlanogramView /> : <ThreeDViewer />}
      </div>
      <ProductPickerModal />
    </>
  )
}
