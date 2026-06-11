import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '../../types'
import { ProductRow } from './product-row'
import { AddProductForm } from './add-product-form'
import { useConfirm } from '../ConfirmDialog'
import { cascadeDeleteProduct, describeProductReferences } from '../../lib/cascade-delete'

const PAGE_SIZE = 10

interface ProductTableProps {
  products: Product[]
  showAddForm: boolean
  onCloseAddForm: () => void
}

export function ProductTable({ products, showAddForm, onCloseAddForm }: ProductTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const { confirm, dialog: confirmDialog } = useConfirm()

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: `Delete "${product.name}" from the catalog?`,
      description: describeProductReferences(product.id),
      confirmLabel: 'Delete product',
      destructive: true,
    })
    if (!ok) return
    cascadeDeleteProduct(product.id)
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIdx = (safeCurrentPage - 1) * PAGE_SIZE
  const endIdx = Math.min(startIdx + PAGE_SIZE, products.length)
  const pageProducts = products.slice(startIdx, endIdx)

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="bg-white shadow-card rounded-lg overflow-hidden">
      {confirmDialog}
      <table className="w-full">
        <thead>
          <tr style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}>
            {[
              'Product',
              'Item #',
              'UPC',
              'Brand',
              'Buyer',
              'Pack',
              'Case $',
              'Dimensions',
              'Weight',
              'Actions',
            ].map((h, i, arr) => (
              <th
                key={h}
                className={`px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#999] ${
                  i === arr.length - 1 ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showAddForm && <AddProductForm onClose={onCloseAddForm} />}
          {pageProducts.map((product) => (
            <ProductRow key={product.id} product={product} onDelete={handleDelete} />
          ))}
          {pageProducts.length === 0 && !showAddForm && (
            <tr>
              <td colSpan={11} className="px-5 py-16 text-center text-[13px] text-[#999]">
                No products found matching your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-5 py-3" style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.06)' }}>
        <span className="text-[11px] text-[#999]">
          Showing {products.length > 0 ? startIdx + 1 : 0}–{endIdx} of {products.length}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-md hover:bg-[#fafafa] text-[#999] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {pageNumbers.map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-7 h-7 rounded-md text-[11px] font-medium transition-colors ${
                num === safeCurrentPage
                  ? 'bg-[#171717] text-white'
                  : 'text-[#666] hover:bg-[#f5f5f5]'
              }`}
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-md hover:bg-[#fafafa] text-[#999] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
