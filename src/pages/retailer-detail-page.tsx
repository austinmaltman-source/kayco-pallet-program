import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  Building2,
  ChevronRight,
  Mail,
  Package,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useCatalogStore } from '../stores/catalog-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useDisplayStore } from '../stores/display-store'
import { useSalespersonStore } from '../stores/salesperson-store'
import { useSeasonStore } from '../stores/season-store'
import { useRoleHref } from '../lib/role-href'
import { canRoleDo } from '../lib/role-routes'
import { useRoleStore } from '../stores/role-store'
import { PalletWizard } from '../components/Wizard/PalletWizard'
import { StartProgramWizard } from '../components/StartProgramWizard'
import { KaycoAccountsPanel } from '../components/Retailers/kayco-accounts-panel'
import { useConfirm } from '../components/ConfirmDialog'
import { CommentCountBadge } from '../components/Comments/comment-count-badge'
import { cascadeDeleteRetailer } from '../lib/cascade-delete'
import type { WizardPalletConfig } from '../components/Wizard/wizardTypes'
import type { AuthorizedItem, DisplayProject, Holiday, Retailer } from '../types'

type Tab = 'pallets' | 'items' | 'contacts' | 'compliance'

const TABS: { value: Tab; label: string }[] = [
  { value: 'pallets', label: 'Pallets' },
  { value: 'items', label: 'Items' },
]

const TIER_LABEL: Record<string, { text: string; color: string }> = {
  enterprise: { text: 'Enterprise', color: '#7c3aed' },
  premium: { text: 'Premium', color: '#0a72ef' },
  standard: { text: 'Standard', color: '#666' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  authorized: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  discontinued: { bg: 'bg-[#f5f5f5]', text: 'text-[#999]', dot: 'bg-[#ccc]' },
  compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'action-required': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  'pending-review': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-[#f5f5f5]', text: 'text-[#999]', dot: 'bg-[#ccc]' },
}

const ITEM_STATUS_OPTIONS: AuthorizedItem['status'][] = [
  'authorized',
  'pending',
  'discontinued',
]

function formatHoliday(holiday: Holiday) {
  if (holiday === 'none') return 'Everyday'
  return holiday
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function fmtMoney(v: number) {
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: v >= 1000 ? 0 : 2,
  })
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function StatusBadge({ status, onClick }: { status: string; onClick?: () => void }) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.inactive
  const className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${className} hover:brightness-95 transition-all cursor-pointer`}
        title="Click to toggle"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {status.replace(/-/g, ' ')}
      </button>
    )
  }
  return (
    <span className={className}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status.replace(/-/g, ' ')}
    </span>
  )
}

function PalletCard({ pallet, retailerId }: { pallet: DisplayProject; retailerId: string }) {
  const navigate = useNavigate()
  const roleHref = useRoleHref()

  const palletQty = pallet.quantity ?? 1
  const itemCount = pallet.assortment.length
  const casesPerPallet = pallet.assortment.reduce((sum, entry) => sum + entry.cases, 0)
  const totalCases = casesPerPallet * palletQty

  return (
    <div
      onClick={() => navigate(roleHref(`/retailers/${retailerId}/pallets/${pallet.id}`))}
      className="group bg-white shadow-card rounded-lg p-4 hover:shadow-elevated transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-semibold text-[#171717]">{pallet.name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-medium text-[#888] capitalize">
              {pallet.palletType}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#ccc] group-hover:text-[#0a72ef] transition-colors mt-1" />
      </div>

      <div className="flex items-center gap-4 mt-4 text-[11px] text-[#999]">
        <span className="tabular-nums">{palletQty} pallet{palletQty === 1 ? '' : 's'}</span>
        <span className="tabular-nums">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
        <span className="tabular-nums">{totalCases} case{totalCases === 1 ? '' : 's'}</span>
        <CommentCountBadge count={pallet.comments?.length} />
        <span className="ml-auto tabular-nums">{formatDate(pallet.updatedAt)}</span>
      </div>
    </div>
  )
}

function OverviewTab({
  retailer,
  pallets,
}: {
  retailer: Retailer
  pallets: DisplayProject[]
}) {
  const products = useCatalogStore((state) => state.products)

  const metrics = useMemo(() => {
    const priceByProduct = new Map<string, number>()
    for (const item of retailer.authorizedItems) {
      if (typeof item.casePrice === 'number') {
        priceByProduct.set(item.productId, item.casePrice)
      }
    }
    const costByProduct = new Map<string, number>()
    for (const product of products) {
      if (typeof product.caseCost === 'number') {
        costByProduct.set(product.id, product.caseCost)
      }
    }

    let revenue = 0
    let materialCost = 0
    let labor = 0
    let corrugate = 0
    let totalCases = 0
    let totalPallets = 0
    let pricedCases = 0
    let costedCases = 0

    for (const pallet of pallets) {
      const qty = pallet.quantity ?? 1
      totalPallets += qty
      if (typeof pallet.laborCost === 'number') {
        labor += pallet.laborCost * qty
      }
      if (typeof pallet.corrugateCost === 'number') {
        corrugate += pallet.corrugateCost * qty
      }
      for (const entry of pallet.assortment) {
        if (entry.cases <= 0) continue
        const cases = entry.cases * qty
        totalCases += cases
        const price = priceByProduct.get(entry.productId)
        const cost = costByProduct.get(entry.productId)
        if (typeof price === 'number') {
          revenue += price * cases
          pricedCases += cases
        }
        if (typeof cost === 'number') {
          materialCost += cost * cases
          costedCases += cases
        }
      }
    }

    const cost = materialCost + labor + corrugate
    const marginDollars = revenue - cost
    const marginPct = revenue > 0 ? (marginDollars / revenue) * 100 : null
    const avgPrice = pricedCases > 0 ? revenue / pricedCases : null
    const avgCost = costedCases > 0 ? materialCost / costedCases : null

    return {
      revenue,
      cost,
      materialCost,
      labor,
      corrugate,
      marginDollars,
      marginPct,
      avgPrice,
      avgCost,
      totalCases,
      totalPallets,
    }
  }, [retailer.authorizedItems, products, pallets])

  if (pallets.length === 0) {
    return null
  }

  const hero = [
    { label: 'Revenue', value: fmtMoney(metrics.revenue) },
    { label: 'Cost', value: fmtMoney(metrics.cost) },
    {
      label: 'Margin',
      value: fmtMoney(metrics.marginDollars),
      tone: metrics.marginDollars < 0 ? 'negative' : 'positive',
    },
    {
      label: 'Margin %',
      value: metrics.marginPct === null ? '—' : `${metrics.marginPct.toFixed(1)}%`,
      tone:
        metrics.marginPct === null
          ? 'neutral'
          : metrics.marginPct < 0
            ? 'negative'
            : 'positive',
    },
  ] as const

  const breakdown = [
    {
      label: 'Avg case price',
      value: metrics.avgPrice === null ? '—' : fmtMoney(metrics.avgPrice),
    },
    {
      label: 'Avg case cost',
      value: metrics.avgCost === null ? '—' : fmtMoney(metrics.avgCost),
    },
    { label: 'Material cost', value: fmtMoney(metrics.materialCost) },
    { label: 'Labor cost', value: fmtMoney(metrics.labor) },
    { label: 'Corrugate cost', value: fmtMoney(metrics.corrugate) },
    { label: 'Total cases', value: metrics.totalCases.toLocaleString() },
    { label: 'Total pallets', value: metrics.totalPallets.toLocaleString() },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {hero.map((stat) => (
          <div key={stat.label} className="bg-white shadow-card rounded-xl px-5 py-5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#999]">
              {stat.label}
            </p>
            <p
              className={`text-[24px] font-semibold tabular-nums tracking-tight mt-1 ${
                'tone' in stat && stat.tone === 'negative'
                  ? 'text-red-600'
                  : 'text-[#171717]'
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white shadow-card rounded-xl">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[13px] font-semibold text-[#171717]">Breakdown</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3">
          {breakdown.map((row, i) => (
            <div
              key={row.label}
              className="px-5 py-4"
              style={
                i % 3 !== 0
                  ? { boxShadow: '-1px 0 0 0 rgba(0,0,0,0.04)' }
                  : undefined
              }
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#bbb]">
                {row.label}
              </p>
              <p className="text-[15px] font-semibold text-[#171717] tabular-nums mt-1">
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AddAuthorizedItemModal({
  retailer,
  open,
  onClose,
}: {
  retailer: Retailer
  open: boolean
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const products = useCatalogStore((state) => state.products)
  const addAuthorizedItem = useRetailerStore((state) => state.addAuthorizedItem)

  const availableProducts = useMemo(() => {
    const existingIds = new Set(retailer.authorizedItems.map((item) => item.productId))
    const query = search.trim().toLowerCase()

    return products
      .filter((product) => !existingIds.has(product.id))
      .filter((product) => {
        if (!query) return true
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          product.brand.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
        )
      })
      .sort(
        (left, right) =>
          left.brand.localeCompare(right.brand) || left.name.localeCompare(right.name),
      )
  }, [products, retailer.authorizedItems, search])

  if (!open) return null

  function handleAdd(productId: string) {
    const product = products.find((candidate) => candidate.id === productId)
    if (!product) return

    addAuthorizedItem(retailer.id, {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      brand: product.brand,
      status: 'authorized',
      authorizedDate: getTodayDateString(),
    })
    setSearch('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[720px] mx-4 max-h-[80vh] flex flex-col shadow-elevated rounded-lg overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-[#171717]">Add Item</h3>
            <p className="text-[12px] text-[#888] mt-1">
              Search the catalog and add an item to {retailer.name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close add item modal"
            className="p-1 rounded-md hover:bg-[#f5f5f5] text-[#ccc] hover:text-[#888] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, SKU, brand, or category..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#fafafa] text-[13px] shadow-border rounded-md placeholder:text-[#aaa] focus:ring-2 focus:ring-[#0a72ef]/20 focus:outline-none focus:shadow-none"
            />
          </div>
          <p className="text-[11px] text-[#999] mt-2">
            {availableProducts.length} products available to add
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
          {availableProducts.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[#888]">
              No products match your search or all catalog items have already been added.
            </div>
          ) : (
            availableProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-4 rounded-lg border border-[#f0f0f0] px-4 py-3"
              >
                <div
                  className="w-1.5 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: product.brandColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-[#171717] truncate">
                      {product.name}
                    </p>
                    <span className="text-[10px] uppercase tracking-wide text-[#999]">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-[#999] font-mono">
                      {product.upc || product.kaycoItemNumber
                        ? [
                            product.upc && `UPC ${product.upc}`,
                            product.kaycoItemNumber && `Kayco #${product.kaycoItemNumber}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : product.sku}
                    </span>
                    <span className="text-[11px] text-[#777] capitalize">{product.brand}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(product.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#171717] text-white text-[12px] font-medium hover:bg-[#333] transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ItemsTab({ retailer }: { retailer: Retailer }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const updateAuthorizedItemStatus = useRetailerStore(
    (state) => state.updateAuthorizedItemStatus,
  )
  const removeAuthorizedItem = useRetailerStore((state) => state.removeAuthorizedItem)
  const products = useCatalogStore((state) => state.products)
  const catalogById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const items = useMemo(() => {
    const statusOrder = new Map(ITEM_STATUS_OPTIONS.map((status, index) => [status, index]))
    return [...retailer.authorizedItems].sort(
      (left, right) =>
        (statusOrder.get(left.status) ?? 99) - (statusOrder.get(right.status) ?? 99) ||
        left.brand.localeCompare(right.brand) ||
        left.productName.localeCompare(right.productName),
    )
  }, [retailer.authorizedItems])

  const pendingCount = items.filter((item) => item.status === 'pending').length
  const approveAllPending = () => {
    items
      .filter((item) => item.status === 'pending')
      .forEach((item) =>
        updateAuthorizedItemStatus(retailer.id, item.productId, 'authorized'),
      )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-[12px] text-[#888]">
            Manage retailer-specific assortment authorization and status.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <button
              onClick={approveAllPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 transition-colors"
            >
              Approve all ({pendingCount})
            </button>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      <div className="bg-white shadow-card rounded-lg overflow-hidden">
        <div
          className="grid grid-cols-[minmax(0,1.3fr)_140px_180px] gap-4 px-5 py-3 text-[10px] font-medium uppercase tracking-wider text-[#bbb]"
          style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.04)' }}
        >
          <span>Product</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Package className="w-6 h-6 text-[#ccc] mx-auto mb-2" />
            <p className="text-[13px] font-medium text-[#171717]">No items yet</p>
            <p className="text-[12px] text-[#888] mt-1">
              Add catalog products to build this retailer&apos;s authorized assortment.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const product = catalogById.get(item.productId)
            const rawBrand = product?.brandCode || product?.brand || item.brand
            const brandLabel =
              !rawBrand || rawBrand === 'other'
                ? '—'
                : rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1)
            return (
            <div
              key={`${item.productId}-${item.sku}`}
              className="grid grid-cols-[minmax(0,1.3fr)_140px_180px] gap-4 px-5 py-3 items-center hover:bg-[#fafafa] transition-colors"
              style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.03)' }}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#171717] truncate">
                  {item.productName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#999] font-mono">
                    {product?.kaycoItemNumber ?? item.sku}
                  </span>
                  <span className="text-[#ddd]">·</span>
                  <span className="text-[11px] text-[#777]">{brandLabel}</span>
                </div>
              </div>
              <div>
                {item.status === 'authorized' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Authorized
                  </span>
                )}
                {item.status === 'pending' && (
                  <button
                    onClick={() =>
                      updateAuthorizedItemStatus(retailer.id, item.productId, 'authorized')
                    }
                    title="Click to approve"
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Pending — click to approve
                  </button>
                )}
                {item.status === 'discontinued' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#f5f5f5] text-[#666] text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#999]" />
                    Discontinued
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {item.status === 'authorized' && (
                  <button
                    onClick={() =>
                      updateAuthorizedItemStatus(retailer.id, item.productId, 'discontinued')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium text-[#555] shadow-border hover:bg-[#fafafa] transition-colors"
                  >
                    Discontinue
                  </button>
                )}
                <button
                  onClick={() => removeAuthorizedItem(retailer.id, item.productId)}
                  aria-label={`Remove ${item.productName}`}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#999] hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            )
          })
        )}
      </div>

      <div className="bg-white shadow-card rounded-lg mt-6">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[13px] font-semibold text-[#171717]">
            Kayco sales accounts
          </h3>
          <p className="text-[12px] text-[#888] mt-0.5">
            Per-item sales in the program item picker are scoped to these accounts.
          </p>
        </div>
        <div className="px-5 py-4">
          <KaycoAccountsPanel retailer={retailer} />
        </div>
      </div>

      <AddAuthorizedItemModal
        retailer={retailer}
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </>
  )
}

function ContactsTab({ retailer }: { retailer: Retailer }) {
  return (
    <div className="bg-white shadow-card rounded-lg overflow-hidden">
      {retailer.contacts.map((contact, i) => (
        <div
          key={contact.id}
          className="flex items-center gap-5 px-5 py-4"
          style={i > 0 ? { boxShadow: '0 -1px 0 0 rgba(0,0,0,0.04)' } : undefined}
        >
          <div className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center shrink-0">
            <span className="text-[12px] font-semibold text-[#888]">
              {contact.name.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-[#171717]">{contact.name}</p>
              {contact.isPrimary && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#0a72ef]/10 text-[#0a72ef]">Primary</span>
              )}
            </div>
            <p className="text-[11px] text-[#888] mt-0.5">{contact.title}</p>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-[#555] shrink-0">
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-[#0a72ef] transition-colors">
              <Mail className="w-3.5 h-3.5" />
              {contact.email}
            </a>
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#bbb]" />
              {contact.phone}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ComplianceTab({ retailer }: { retailer: Retailer }) {
  return (
    <div className="bg-white shadow-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_120px_120px_100px] gap-4 px-5 py-3 text-[10px] font-medium uppercase tracking-wider text-[#bbb]" style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.04)' }}>
        <span>Requirement</span>
        <span>Last Audit</span>
        <span>Next Audit</span>
        <span className="text-right">Status</span>
      </div>

      {retailer.compliance.map((record) => (
        <div
          key={record.id}
          className="grid grid-cols-[1fr_120px_120px_100px] gap-4 px-5 py-3.5 items-center"
          style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.03)' }}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#171717] truncate">{record.requirement}</p>
            {record.notes && (
              <p className="text-[11px] text-[#999] mt-0.5 truncate">{record.notes}</p>
            )}
          </div>
          <p className="text-[12px] text-[#555]">{record.lastAuditDate}</p>
          <p className="text-[12px] text-[#555]">{record.nextAuditDate}</p>
          <div className="text-right">
            <StatusBadge status={record.status} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RetailerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const roleHref = useRoleHref()
  const role = useRoleStore((state) => state.role)
  const updateRetailer = useRetailerStore((state) => state.updateRetailer)
  const retailer = useRetailerStore((state) => state.getRetailer(id ?? ''))
  const salespeople = useSalespersonStore((state) => state.salespeople)
  const seasons = useSeasonStore((state) => state.seasons)
  const projects = useDisplayStore((state) => state.projects)
  const { confirm, dialog: confirmDialog } = useConfirm()
  const pallets = useMemo(
    () => projects.filter((p) => p.retailerId === (id ?? '')).sort((a, b) => b.updatedAt - a.updatedAt),
    [projects, id],
  )
  const [activeTab, setActiveTab] = useState<Tab>('pallets')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [startProgramOpen, setStartProgramOpen] = useState(false)
  const createProject = useDisplayStore((state) => state.createProject)
  // Programs are identified by seasonId (each Season is one program); legacy
  // pallets without a seasonId fall back to their Holiday family.
  const seasonOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string }>()
    for (const pallet of pallets) {
      if (pallet.seasonId) {
        const seasonRecord = seasons.find((s) => s.id === pallet.seasonId)
        if (!byKey.has(pallet.seasonId)) {
          byKey.set(pallet.seasonId, {
            key: pallet.seasonId,
            label: seasonRecord?.name ?? 'Season',
          })
        }
      } else if (pallet.season !== 'none') {
        if (!byKey.has(pallet.season)) {
          byKey.set(pallet.season, {
            key: pallet.season,
            label: formatHoliday(pallet.season),
          })
        }
      } else if (!byKey.has('none')) {
        // Pallets without a season still belong to a program - the same
        // "Everyday" group the salesman home links to via /program/none.
        byKey.set('none', { key: 'none', label: 'Everyday' })
      }
    }
    return Array.from(byKey.values())
  }, [pallets, seasons])

  const programCards = useMemo(() => {
    return seasonOptions.map((option) => {
      const palletsInProgram = pallets.filter((p) =>
        p.seasonId ? p.seasonId === option.key : p.season === option.key,
      )
      let totalCases = 0
      let halfUnits = 0
      let fullUnits = 0
      const pickedSet = new Set<string>()
      let lastUpdated = 0
      for (const p of palletsInProgram) {
        const qty = p.quantity ?? 1
        if (p.palletType === 'half') halfUnits += qty
        if (p.palletType === 'full') fullUnits += qty
        for (const entry of p.assortment) {
          totalCases += entry.cases * qty
          pickedSet.add(entry.productId)
        }
        p.selectedProductIds?.forEach((id) => pickedSet.add(id))
        if (p.updatedAt > lastUpdated) lastUpdated = p.updatedAt
      }
      return {
        key: option.key,
        label: option.label,
        itemCount: pickedSet.size,
        totalCases,
        palletUnits: halfUnits + fullUnits,
        halfUnits,
        fullUnits,
        lastUpdated,
      }
    })
  }, [seasonOptions, pallets])

  const handleDeleteProgram = async () => {
    if (!retailer) return
    const ok = await confirm({
      title: `Delete "${retailer.name}"?`,
      description:
        pallets.length > 0
          ? `This program and ${pallets.length} pallet${pallets.length === 1 ? '' : 's'} under it will be removed, and salespeople will be unassigned from it. This cannot be undone.`
          : 'This cannot be undone.',
      confirmLabel: 'Delete program',
      destructive: true,
    })
    if (!ok) return
    cascadeDeleteRetailer(retailer.id)
    navigate(roleHref('/retailers'), { replace: true })
  }

  const handleWizardComplete = (config: WizardPalletConfig) => {
    const project = createProject(
      config.name,
      {
        palletType: config.type === 'custom' ? 'full' : config.type,
        season: 'none',
        retailerId: id ?? '',
      },
      config.display.tierCount,
    )
    setWizardOpen(false)
    navigate(roleHref(`/retailers/${id}/pallets/${project.id}`))
  }

  const tierCfg = TIER_LABEL[retailer?.tier ?? 'standard']

  const authorizedCount = retailer?.authorizedItems.filter((i) => i.status === 'authorized').length ?? 0

  const assignedSalespeople = useMemo(
    () =>
      retailer
        ? salespeople.filter((sp) => sp.retailerIds.includes(retailer.id))
        : [],
    [salespeople, retailer],
  )
  const salesmanLabel =
    assignedSalespeople.length > 0
      ? assignedSalespeople.map((sp) => sp.name).join(', ')
      : 'No salesman assigned'

  if (!retailer) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Building2 className="w-10 h-10 text-[#ccc] mb-3" />
        <h3 className="text-[15px] font-semibold text-[#333]">Program not found</h3>
        <button
          onClick={() => navigate(roleHref('/retailers'))}
          className="mt-3 px-4 py-1.5 text-[13px] font-medium text-[#0a72ef] hover:bg-[#0a72ef]/5 rounded-md transition-colors"
        >
          Back to Programs
        </button>
      </div>
    )
  }

  return (
    <div className="px-10 py-10 max-w-[1400px]">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate(roleHref('/retailers'))}
        className="flex items-center gap-1.5 text-[#999] hover:text-[#171717] text-[12px] font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Programs
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-display text-[#171717]">
              {retailer.name}
            </h1>
            <StatusBadge
              status={retailer.status}
              onClick={
                canRoleDo(role, 'toggleRetailerStatus')
                  ? () =>
                      updateRetailer(retailer.id, {
                        status: retailer.status === 'active' ? 'inactive' : 'active',
                      })
                  : undefined
              }
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-[12px] text-[#888]">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {salesmanLabel}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {authorizedCount} SKUs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canRoleDo(role, 'deleteRetailer') && (
            <button
              onClick={handleDeleteProgram}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium text-[#c0392b] hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
          {(() => {
            const blockedForSalesman =
              role === 'salesman' && retailer.status === 'inactive'
            const useStartProgram = role === 'salesman'
            return (
              <button
                onClick={() =>
                  useStartProgram
                    ? setStartProgramOpen(true)
                    : setWizardOpen(true)
                }
                disabled={blockedForSalesman}
                title={
                  blockedForSalesman
                    ? 'This program is inactive — ask your manager to reactivate it before building.'
                    : undefined
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[13px] font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                {useStartProgram ? 'Start a program' : 'New Pallet'}
              </button>
            )
          })()}
        </div>
      </div>

      {/* Program financials */}
      {role === 'manager' && (
        <div className="mb-8">
          <OverviewTab retailer={retailer} pallets={pallets} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-6" style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}>
        {TABS.map((tab) => {
          const label =
            tab.value === 'pallets' && role === 'salesman' ? 'Programs' : tab.label
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                activeTab === tab.value ? 'text-[#171717]' : 'text-[#999] hover:text-[#555]'
              }`}
            >
              {label}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#171717] rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'pallets' && (
        <>
          {pallets.length === 0 ? (
            <div className="bg-white shadow-card rounded-lg py-16 text-center">
              <Boxes className="w-7 h-7 text-[#ccc] mx-auto mb-3" />
              <p className="text-[14px] font-medium text-[#171717]">No pallets yet</p>
              <p className="text-[12px] text-[#888] mt-1 mb-5">
                {role === 'salesman'
                  ? `Pitch a season program to ${retailer.name}, then start it here.`
                  : `Create the first pallet for ${retailer.name}`}
              </p>
              <button
                onClick={() =>
                  role === 'salesman'
                    ? setStartProgramOpen(true)
                    : setWizardOpen(true)
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#171717] text-white text-[12px] font-medium hover:bg-[#333] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {role === 'salesman' ? 'Start a program' : 'New Pallet'}
              </button>
            </div>
          ) : role === 'salesman' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {programCards.map((card) => (
                <Link
                  key={card.key}
                  to={roleHref(`/retailers/${id}/program/${card.key}`)}
                  className="group bg-white shadow-card rounded-xl px-5 py-4 hover:shadow-elevated transition-all flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#171717] truncate">
                      {card.label}
                    </h3>
                    <p className="text-[12px] text-[#888] mt-1 tabular-nums">
                      <span className="font-medium text-[#171717]">{card.itemCount}</span>
                      {' items · '}
                      <span className="font-medium text-[#171717]">{card.totalCases}</span>
                      {' cases · '}
                      <span className="font-medium text-[#171717]">{card.palletUnits}</span>
                      {' pallets'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      {card.halfUnits > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="font-semibold tabular-nums">{card.halfUnits}</span>
                          Half
                        </span>
                      )}
                      {card.fullUnits > 0 && (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="font-semibold tabular-nums">{card.fullUnits}</span>
                          Full
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#bbb] group-hover:text-[#555] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <>
              {seasonOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-[12px] text-[#888]">Program summary:</span>
                  {seasonOptions.map((option) => (
                    <Link
                      key={option.key}
                      to={roleHref(`/retailers/${id}/program/${option.key}`)}
                      className="text-[12px] font-medium text-[#0a72ef] hover:underline"
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {pallets.map((pallet) => (
                  <PalletCard key={pallet.id} pallet={pallet} retailerId={retailer.id} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'items' && <ItemsTab retailer={retailer} />}

      <PalletWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
      <StartProgramWizard
        open={startProgramOpen}
        onClose={() => setStartProgramOpen(false)}
        pinnedRetailerId={retailer.id}
      />
      {confirmDialog}
    </div>
  )
}
