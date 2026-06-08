import { GripVertical, PackageOpen } from 'lucide-react'
import { useCatalogStore } from '../../stores/catalog-store'
import { useDisplayStore } from '../../stores/display-store'
import { getEffectiveCaseDimensions } from '../../lib/geometry/orientation'
import type { Product } from '../../types'

interface CaseTrayProps {
  draggingProductId: string | null
  onDragStart: (product: Product, pointer: { clientX: number; clientY: number }) => void
  onDragEnd: () => void
}

function itemCode(product: Product): string {
  const parts = [
    product.upc ? `UPC ${product.upc}` : null,
    product.kaycoItemNumber ? `Kayco #${product.kaycoItemNumber}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : product.sku
}

export function CaseTray({
  draggingProductId,
  onDragStart,
  onDragEnd,
}: CaseTrayProps) {
  const currentProject = useDisplayStore((state) => state.currentProject)
  const products = useCatalogStore((state) => state.products)

  if (!currentProject) return null

  const productMap = new Map(products.map((product) => [product.id, product]))
  const rows = currentProject.assortment
    .map((entry) => {
      const product = productMap.get(entry.productId)
      if (!product || entry.cases <= 0) return null
      const placedCases = currentProject.placements.reduce((sum, placement) => {
        if (placement.sourceProductId !== product.id) return sum
        return sum + (placement.quantity ?? 1)
      }, 0)
      const dimensions = getEffectiveCaseDimensions(product)
      return {
        product,
        totalCases: entry.cases,
        remainingCases: Math.max(0, entry.cases - placedCases),
        dimensions,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  return (
    <div
      data-case-tray
      className="absolute left-4 top-[132px] z-30 w-[286px] rounded-lg bg-white shadow-elevated border border-black/5 overflow-hidden"
    >
      <div className="px-3 py-3 border-b border-[#eee]">
        <p className="text-[12px] font-semibold text-[#171717]">Cases to place</p>
        <p className="mt-0.5 text-[11px] text-[#777]">Drag a case onto the pallet.</p>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2 space-y-1.5">
        {rows.map(({ product, totalCases, remainingCases, dimensions }) => {
          const disabled = remainingCases <= 0
          const dragging = draggingProductId === product.id
          return (
            <div
              key={product.id}
              onPointerDown={(event) => {
                if (disabled || event.button !== 0) return
                event.preventDefault()
                onDragStart(product, { clientX: event.clientX, clientY: event.clientY })
              }}
              onPointerCancel={onDragEnd}
              className={`group rounded-md border p-2.5 transition-colors ${
                disabled
                  ? 'border-[#eee] bg-[#fafafa] opacity-55'
                  : dragging
                    ? 'border-[#171717] bg-[#f8f8f8]'
                    : 'border-[#eee] bg-white hover:border-[#d8d8d8] cursor-grab active:cursor-grabbing'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-8 w-8 rounded-md bg-[#f5f5f5] flex items-center justify-center shrink-0">
                  <PackageOpen size={15} style={{ color: product.brandColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#171717] truncate">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#888] truncate">
                    {itemCode(product)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#777] tabular-nums">
                    <span>
                      <span className="font-semibold text-[#171717]">{remainingCases}</span>
                      {' / '}
                      {totalCases} left
                    </span>
                    <span>
                      {dimensions.width.toFixed(1)}" x {dimensions.depth.toFixed(1)}" x{' '}
                      {dimensions.height.toFixed(1)}"
                    </span>
                  </div>
                </div>
                <GripVertical
                  size={15}
                  className={`mt-1 shrink-0 ${disabled ? 'text-[#ddd]' : 'text-[#bbb] group-hover:text-[#777]'}`}
                />
              </div>
            </div>
          )
        })}

        {rows.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-[12px] text-[#777]">No cases in this pallet yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
