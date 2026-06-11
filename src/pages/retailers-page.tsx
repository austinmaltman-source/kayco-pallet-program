import { useState, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Building2,
  ArrowUpDown,
} from 'lucide-react'
import { useRetailerStore } from '../stores/retailer-store'
import { useDisplayStore } from '../stores/display-store'
import { useRoleStore } from '../stores/role-store'
import { RetailerCard } from '../components/Retailers/retailer-card'
import { RetailerForm } from '../components/Retailers/retailer-form'
import { useConfirm } from '../components/ConfirmDialog'
import { cascadeDeleteRetailer, countRetailerPallets } from '../lib/cascade-delete'
import type { Retailer, RetailerStatus } from '../types'

const STATUS_FILTERS: { value: RetailerStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

type SortKey = 'pallets' | 'name' | 'items'

export function RetailersPage() {
  const { retailers, addRetailer, updateRetailer } = useRetailerStore()
  const projects = useDisplayStore((state) => state.projects)
  const role = useRoleStore((state) => state.role)
  const activeSalesperson = null
  const navigate = useNavigate()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRetailerId, setEditingRetailerId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RetailerStatus | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortKey>('pallets')

  const editingRetailer = editingRetailerId
    ? retailers.find((r) => r.id === editingRetailerId) ?? null
    : null

  const filteredRetailers = useMemo(() => {
    let result = [...retailers]

    if (activeSalesperson) {
      const allowed = new Set(activeSalesperson.retailerIds)
      result = result.filter((r) => allowed.has(r.id))
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.headquartersCity.toLowerCase().includes(q) ||
          r.headquartersState.toLowerCase().includes(q) ||
          r.accountManager.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)

    const palletCountByRetailer = new Map<string, number>()
    for (const project of projects) {
      palletCountByRetailer.set(
        project.retailerId,
        (palletCountByRetailer.get(project.retailerId) ?? 0) + 1,
      )
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'pallets':
          return (
            (palletCountByRetailer.get(b.id) ?? 0) -
            (palletCountByRetailer.get(a.id) ?? 0)
          )
        case 'name': return a.name.localeCompare(b.name)
        case 'items': return b.authorizedItems.length - a.authorizedItems.length
        default: return 0
      }
    })
    return result
  }, [retailers, projects, searchQuery, statusFilter, sortBy, activeSalesperson])

  function handleAdd() {
    setEditingRetailerId(null)
    setIsFormOpen(true)
  }

  function handleEdit(id: string) {
    setEditingRetailerId(id)
    setIsFormOpen(true)
  }

  async function handleDelete(id: string) {
    const retailer = retailers.find((r) => r.id === id)
    if (!retailer) return
    const palletCount = countRetailerPallets(id)
    const ok = await confirm({
      title: `Delete "${retailer.name}"?`,
      description:
        palletCount > 0
          ? `This program and its ${palletCount} pallet${palletCount === 1 ? '' : 's'} will be removed, and salespeople will be unassigned from it. This cannot be undone.`
          : 'This program will be removed and salespeople will be unassigned from it. This cannot be undone.',
      confirmLabel: 'Delete program',
      destructive: true,
    })
    if (!ok) return
    cascadeDeleteRetailer(id)
  }

  function handleSave(data: Omit<Retailer, 'id'> & { id?: string }) {
    if (data.id) {
      const { id, ...updates } = data
      updateRetailer(id, updates)
    } else {
      addRetailer({ ...data, id: `ret-${Date.now()}` } as Retailer)
    }
    setIsFormOpen(false)
    setEditingRetailerId(null)
  }

  function handleCancel() {
    setIsFormOpen(false)
    setEditingRetailerId(null)
  }

  function handleCardClick(id: string) {
    navigate(`/${role}/retailers/${id}`)
  }

  // The salesman home already lists every assigned retailer with their
  // programs underneath, so this directory view is redundant for that role.
  // Must stay below every hook call so the hook order never changes.
  if (role === 'salesman') {
    return <Navigate to="/salesman" replace />
  }

  const isSalesman = false
  const isManager = role === 'manager'
  const headerLabel = 'Programs'
  const headerCount = `${retailers.length} ${retailers.length === 1 ? 'program' : 'programs'}`

  return (
    <div className={`${isSalesman ? 'px-8 py-10 max-w-[1280px] mx-auto' : 'px-10 py-10 max-w-[1600px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[28px] font-semibold tracking-display text-[#171717]">
            {headerLabel}
          </h2>
          <p className="text-[13px] text-[#888] mt-1">{headerCount}</p>
        </div>
        {isManager && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-[#171717] hover:bg-[#333] rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Program
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search retailers..."
            className="w-full pl-9 pr-4 py-2 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none placeholder:text-[#aaa]"
          />
        </div>

        <div className="flex items-center shadow-ring rounded-md overflow-hidden">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3.5 py-[7px] text-[12px] font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-[#171717] text-white'
                  : 'bg-white text-[#666] hover:bg-[#fafafa]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3 text-[#999]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-[12px] font-medium text-[#555] bg-transparent border-none focus:outline-none cursor-pointer"
          >
            <option value="pallets">Pallets</option>
            <option value="name">Name</option>
            <option value="items">Items</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filteredRetailers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-lg shadow-card flex items-center justify-center mb-4 bg-white">
            <Building2 className="w-5 h-5 text-[#ccc]" />
          </div>
          <p className="text-[14px] font-medium text-[#555]">No programs found</p>
          <p className="text-[12px] text-[#999] mt-1">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first program to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRetailers.map((retailer) => (
            <RetailerCard
              key={retailer.id}
              retailer={retailer}
              onClick={handleCardClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {isFormOpen && (
        <RetailerForm retailer={editingRetailer} onSave={handleSave} onCancel={handleCancel} />
      )}
      {confirmDialog}
    </div>
  )
}
