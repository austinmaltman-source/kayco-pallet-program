import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useDisplayStore } from '../stores/display-store'
import { useRoleStore } from '../stores/role-store'
import { ThreeDViewer } from '../components/Editor/three-d-viewer'
import { GridEditor } from '../components/Editor/grid-editor'
import { ProductPickerModal } from '../components/Editor/product-picker-modal'
import { useRoleHref } from '../lib/role-href'
import { ArrowLeft, Package } from 'lucide-react'

export function EditorPage() {
  const { palletId, retailerId } = useParams()
  const [searchParams] = useSearchParams()
  const roleHref = useRoleHref()
  const role = useRoleStore((state) => state.role)
  const viewMode = useDisplayStore((state) => state.viewMode)
  const setViewMode = useDisplayStore((state) => state.setViewMode)
  const currentProject = useDisplayStore((state) => state.currentProject)
  const selectProject = useDisplayStore((state) => state.selectProject)

  useEffect(() => {
    if (palletId && currentProject?.id !== palletId) {
      selectProject(palletId)
    }
  }, [palletId, currentProject?.id, selectProject])

  useEffect(() => {
    const requestedView = searchParams.get('view')
    if ((requestedView === '2d' || requestedView === '3d') && viewMode !== requestedView) {
      setViewMode(requestedView)
    }
  }, [searchParams, setViewMode, viewMode])

  // Salesmen land in 3D — they're orienting on the pallet, not gridding cases.
  useEffect(() => {
    const requestedView = searchParams.get('view')
    if (!requestedView && role === 'salesman' && viewMode !== '3d') {
      setViewMode('3d')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, searchParams])

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
        {viewMode === '3d' ? <ThreeDViewer /> : <GridEditor />}
      </div>
      <ProductPickerModal />
    </>
  )
}
