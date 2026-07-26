import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Package,
  PencilLine,
  Save,
  Scale,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import type { Brand, Holiday, Product } from '../types'
import { BRAND_COLORS } from '../lib/mock-data'
import { useCatalogStore } from '../stores/catalog-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useRoleHref } from '../lib/role-href'
import { useSmartBack } from '../lib/use-smart-back'
import { useConfirm } from '../components/ConfirmDialog'
import { cascadeDeleteProduct, describeProductReferences } from '../lib/cascade-delete'

const BRANDS: Brand[] = ['tuscanini', 'kedem', 'gefen', 'liebers', 'haddar', 'osem']
const HOLIDAYS: Holiday[] = ['rosh-hashanah', 'pesach', 'sukkos', 'none']
const HOLIDAY_LABELS: Record<string, string> = {
  'rosh-hashanah': 'Rosh Hashanah',
  pesach: 'Pesach',
  sukkos: 'Sukkos',
  none: 'Year-round',
}
const HOLIDAY_COLORS: Record<string, { color: string; bg: string }> = {
  'rosh-hashanah': { color: '#15803d', bg: '#f0fdf4' },
  pesach: { color: '#0a72ef', bg: '#eff6ff' },
  sukkos: { color: '#b45309', bg: '#fffbeb' },
  none: { color: '#666', bg: '#f5f5f5' },
}
const dimensionFields = ['width', 'height', 'depth', 'weight'] as const

type Tab = 'overview' | 'edit' | 'retailers' | 'related'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'edit', label: 'Edit Profile' },
  { value: 'retailers', label: 'Retailers' },
  { value: 'related', label: 'Related' },
]

function getSeasonality(product: Product) {
  if (product.holidayTags.length === 0) return 'Evergreen item with year-round merchandising flexibility.'
  if (product.holidayTags.length === 1) return `Seasonal driver aligned to ${HOLIDAY_LABELS[product.holidayTags[0]]}.`
  return `Cross-season item used across ${product.holidayTags.map((h) => HOLIDAY_LABELS[h]).join(' and ')}.`
}

function getStackingGuidance(product: Product) {
  if (product.weight >= 4) return 'Heavy case. Best suited for lower tiers or center-support positions.'
  if (product.height >= 10) return 'Tall case. Works best away from header sightlines and with stable neighboring items.'
  if (product.width <= 3) return 'Narrow footprint. Useful for filling gaps and balancing mixed-brand displays.'
  return 'Standard case. Flexible placement across most shelf tiers.'
}

export function ProductDetailPage() {
  const roleHref = useRoleHref()
  const smartBack = useSmartBack()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { id } = useParams()
  const navigate = useNavigate()
  const product = useCatalogStore((s) => s.getProduct(id ?? ''))
  const products = useCatalogStore((s) => s.products)
  const updateProduct = useCatalogStore((s) => s.updateProduct)
  const retailers = useRetailerStore((s) => s.retailers)

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isEditing, setIsEditing] = useState(false)

  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    upc: product?.upc ?? '',
    kaycoItemNumber: product?.kaycoItemNumber ?? '',
    buyer: product?.buyer ?? '',
    caseCost: product?.caseCost?.toString() ?? '',
    brand: product?.brand ?? ('tuscanini' as Brand),
    category: product?.category ?? '',
    width: product?.width ?? 0,
    height: product?.height ?? 0,
    depth: product?.depth ?? 0,
    weight: product?.weight ?? 0,
    holiday: product?.holidayTags[0] ?? ('none' as string),
  }))

  const retailerCoverage = useMemo(() => {
    if (!product) return []
    return retailers
      .map((r) => {
        const item = r.authorizedItems.find((ai) => ai.productId === product.id)
        return item ? { retailer: r, item } : null
      })
      .filter(Boolean)
  }, [product, retailers]) as {
    retailer: (typeof retailers)[number]
    item: (typeof retailers)[number]['authorizedItems'][number]
  }[]

  const relatedProducts = useMemo(() => {
    if (!product) return []

    const SIZE_RE = /\d+(?:\.\d+)?\s*(?:oz|ml|l|lb|lbs|g|kg|gal|qt|pt|ct|pk|pack|count)\b/gi

    const extractSizes = (text: string) => {
      const matches = text.toLowerCase().match(SIZE_RE) ?? []
      return new Set(matches.map((m) => m.replace(/\s+/g, '')))
    }

    const tokenize = (text: string) =>
      text
        .toLowerCase()
        .replace(SIZE_RE, ' ')
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 && !/^\d+$/.test(token))

    const sourceSizes = extractSizes(product.name)
    const sourceTokens = new Set(tokenize(product.name))

    const candidates = products.filter((c) => {
      if (c.id === product.id) return false
      if (c.brand !== product.brand) return false
      if (sourceSizes.size > 0) {
        const candidateSizes = extractSizes(c.name)
        if (candidateSizes.size === 0) return false
        let sizeMatches = false
        for (const size of sourceSizes) {
          if (candidateSizes.has(size)) {
            sizeMatches = true
            break
          }
        }
        if (!sizeMatches) return false
      }
      return true
    })

    const scored = candidates.map((c) => {
      const tokens = tokenize(c.name)
      let shared = 0
      for (const token of tokens) {
        if (sourceTokens.has(token)) shared += 1
      }
      const sameCategory = c.category === product.category ? 1 : 0
      return { product: c, shared, sameCategory }
    })

    return scored
      .sort(
        (a, b) =>
          b.shared - a.shared ||
          b.sameCategory - a.sameCategory ||
          a.product.name.localeCompare(b.product.name),
      )
      .slice(0, 20)
      .map((entry) => entry.product)
  }, [product, products])


  useEffect(() => {
    if (!product) return
    setForm({
      name: product.name, sku: product.sku,
      upc: product.upc ?? '', kaycoItemNumber: product.kaycoItemNumber ?? '',
      buyer: product.buyer ?? '',
      caseCost: product.caseCost?.toString() ?? '',
      brand: product.brand,
      category: product.category, width: product.width, height: product.height,
      depth: product.depth, weight: product.weight,
      holiday: product.holidayTags[0] ?? 'none',
    })
    setIsEditing(false)
  }, [product])

  if (!product) {
    return (
      <div className="px-10 py-16 max-w-5xl mx-auto">
        <div className="bg-white shadow-card rounded-lg p-10 text-center">
          <Package className="w-8 h-8 text-[#ccc] mx-auto mb-4" />
          <h2 className="text-[17px] font-semibold text-[#171717]">Product not found</h2>
          <p className="text-[13px] text-[#888] mt-2 mb-5">This product may have been deleted.</p>
          <button
            onClick={() => smartBack(roleHref('/catalog'))}
            className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-[#555] shadow-border bg-white rounded-md hover:bg-[#fafafa] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      </div>
    )
  }

  const brandColor = BRAND_COLORS[product.brand]
  const primaryHoliday = product.holidayTags[0] ?? 'none'
  const holidayStyle = HOLIDAY_COLORS[primaryHoliday] ?? HOLIDAY_COLORS.none

  const handleReset = () => {
    setForm({
      name: product.name, sku: product.sku,
      upc: product.upc ?? '', kaycoItemNumber: product.kaycoItemNumber ?? '',
      buyer: product.buyer ?? '',
      caseCost: product.caseCost?.toString() ?? '',
      brand: product.brand,
      category: product.category, width: product.width, height: product.height,
      depth: product.depth, weight: product.weight,
      holiday: product.holidayTags[0] ?? 'none',
    })
    setIsEditing(false)
  }

  const handleSave = () => {
    const holidayTags = form.holiday === 'none' ? [] : [form.holiday as Holiday]
    const parsedCaseCost = form.caseCost.trim() === '' ? undefined : parseFloat(form.caseCost)
    updateProduct(product.id, {
      name: form.name, sku: form.sku,
      upc: form.upc.trim() || undefined,
      kaycoItemNumber: form.kaycoItemNumber.trim() || undefined,
      buyer: form.buyer.trim() || undefined,
      caseCost: typeof parsedCaseCost === 'number' && !isNaN(parsedCaseCost) ? parsedCaseCost : undefined,
      brand: form.brand,
      brandColor: BRAND_COLORS[form.brand], category: form.category,
      width: form.width, height: form.height, depth: form.depth,
      weight: form.weight, holidayTags,
    })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${product.name}" from the catalog?`,
      description: describeProductReferences(product.id),
      confirmLabel: 'Delete product',
      destructive: true,
    })
    if (!ok) return
    cascadeDeleteProduct(product.id)
    navigate(roleHref('/catalog'))
  }

  const inputClass = 'w-full px-4 py-3 rounded-md shadow-border bg-white disabled:bg-[#fafafa] disabled:text-[#888] focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/20 focus:shadow-none text-[13px]'

  return (
    <div className="px-10 py-0 max-w-[1200px] mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#fafafa] pt-8 pb-0">
        {/* Breadcrumb */}
        <button
          onClick={() => smartBack(roleHref('/catalog'))}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#888] hover:text-[#171717] transition-colors mb-5"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>

        {/* Header Bar */}
        <div className="flex items-start justify-between gap-6 mb-0">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-[24px] font-semibold tracking-display text-[#171717] truncate">
                {product.name}
              </h1>
              <span
                className="shrink-0 px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wider"
                style={{ backgroundColor: brandColor + '12', color: brandColor }}
              >
                {product.brand}
              </span>
              <span
                className="shrink-0 px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wider"
                style={{ backgroundColor: holidayStyle.bg, color: holidayStyle.color }}
              >
                {HOLIDAY_LABELS[primaryHoliday]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-[#888] flex-wrap">
              {product.upc && (
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />UPC {product.upc}
                </span>
              )}
              {product.kaycoItemNumber && (
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />Kayco #{product.kaycoItemNumber}
                </span>
              )}
              {!product.upc && !product.kaycoItemNumber && (
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />{product.sku}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium text-red-500 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 mt-6 -mb-px" style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                activeTab === tab.value
                  ? 'text-[#171717]'
                  : 'text-[#888] hover:text-[#555]'
              }`}
            >
              {tab.label}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#171717] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-8 pb-12">
        {/* ===== Overview Tab ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Dimension cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Width', value: `${product.width}"`, icon: ArrowUpRight },
                { label: 'Height', value: `${product.height}"`, icon: ArrowUpRight },
                { label: 'Depth', value: `${product.depth}"`, icon: ArrowUpRight },
                { label: 'Weight', value: `${product.weight} lb`, icon: Scale },
              ].map((item) => (
                <div key={item.label} className="bg-white shadow-card rounded-lg px-5 py-5">
                  <item.icon className="w-3.5 h-3.5 text-[#ccc] mb-3" />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#999]">{item.label}</p>
                  <p className="text-[20px] font-semibold text-[#171717] mt-1 tabular-nums tracking-tight-sm">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Snapshot + Seasonality row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white shadow-card rounded-lg p-6">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#999] mb-4">Snapshot</p>
                <div className="space-y-3">
                  {[
                    { label: 'Retailers', value: String(retailerCoverage.length) },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between gap-3">
                      <span className="text-[#888] text-[13px]">{r.label}</span>
                      <span className="text-[#171717] font-medium text-[13px] tabular-nums">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white shadow-card rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-[#999]" />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#999]">Seasonality</p>
                </div>
                <p className="text-[13px] text-[#555] leading-relaxed">{getSeasonality(product)}</p>
              </div>
            </div>

            {/* Placement Guidance */}
            <div className="bg-white shadow-card rounded-lg p-6">
              <h3 className="text-[15px] font-semibold text-[#171717] tracking-tight-sm mb-4">Placement Guidance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Shelf Guidance', text: getStackingGuidance(product) },
                  { label: 'Seasonal Positioning', text: getSeasonality(product) },
                ].map((g) => (
                  <div key={g.label} className="bg-[#fafafa] rounded-md px-4 py-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#999] mb-1.5">{g.label}</p>
                    <p className="text-[12px] text-[#555] leading-relaxed">{g.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== Edit Profile Tab ===== */}
        {activeTab === 'edit' && (
          <div className="max-w-3xl">
            <div className="bg-white shadow-card rounded-lg p-8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#171717] tracking-tight-sm">Product Profile</h2>
                  <p className="text-[12px] text-[#888] mt-1">Core product data and merchandising metadata.</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-[#171717] rounded-md hover:bg-[#333] transition-colors">
                      <PencilLine className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : (
                    <>
                      <button onClick={handleReset}
                        className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-[#555] shadow-border bg-white rounded-md hover:bg-[#fafafa] transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button onClick={handleSave}
                        className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-[#171717] rounded-md hover:bg-[#333] transition-colors">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: 'Product Name', key: 'name', mono: false },
                  { label: 'SKU', key: 'sku', mono: true },
                  { label: 'UPC', key: 'upc', mono: true },
                  { label: 'Kayco Item #', key: 'kaycoItemNumber', mono: true },
                  { label: 'Buyer', key: 'buyer', mono: false },
                  { label: 'Case Cost ($)', key: 'caseCost', mono: true },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#999] mb-2">{f.label}</label>
                    <input type="text" disabled={!isEditing} value={(form as unknown as Record<string, string>)[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className={`${inputClass} ${f.mono ? 'font-mono' : ''}`} />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[#999] mb-2">Brand</label>
                  <select disabled={!isEditing} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value as Brand })}
                    className={`${inputClass} capitalize`}>
                    {BRANDS.map((b) => <option key={b} value={b} className="capitalize">{b}</option>)}
                  </select>
                </div>
                {dimensionFields.map((field) => (
                  <div key={field}>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#999] mb-2">
                      {field === 'weight' ? 'Weight (lb)' : `${field.charAt(0).toUpperCase() + field.slice(1)} (in)`}
                    </label>
                    <input type="number" step="0.1" disabled={!isEditing} value={form[field]}
                      onChange={(e) => setForm({ ...form, [field]: parseFloat(e.target.value) || 0 })}
                      className={`${inputClass} tabular-nums`} />
                  </div>
                ))}

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[#999] mb-2">Holiday</label>
                  <div className="flex flex-wrap gap-2">
                    {HOLIDAYS.map((h) => (
                      <button key={h} type="button" disabled={!isEditing}
                        onClick={() => setForm({ ...form, holiday: h })}
                        className={`px-3 py-2 rounded-md text-[12px] font-medium transition-colors ${
                          form.holiday === h ? 'bg-[#171717] text-white' : 'bg-[#f5f5f5] text-[#555]'
                        } disabled:opacity-60`}>
                        {HOLIDAY_LABELS[h]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Retailers Tab ===== */}
        {activeTab === 'retailers' && (
          <div className="max-w-3xl">
            <div className="bg-white shadow-card rounded-lg p-6">
              <div className="flex items-center gap-2 mb-5">
                <Building2 className="w-4 h-4 text-[#999]" />
                <h3 className="text-[15px] font-semibold text-[#171717] tracking-tight-sm">Retailer Coverage</h3>
                <span className="ml-auto text-[12px] text-[#888] tabular-nums">{retailerCoverage.length} retailer{retailerCoverage.length !== 1 ? 's' : ''}</span>
              </div>
              {retailerCoverage.length === 0 ? (
                <div className="bg-[#fafafa] rounded-md px-5 py-8 text-center">
                  <Building2 className="w-6 h-6 text-[#ccc] mx-auto mb-3" />
                  <p className="text-[13px] text-[#888]">Not yet authorized in any retailer accounts.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {retailerCoverage.map(({ retailer, item }) => (
                    <div key={retailer.id} className="shadow-border rounded-md px-5 py-4 hover:bg-[#fafafa] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[14px] font-medium text-[#171717]">{retailer.name}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#888]">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                              item.status === 'authorized' ? 'bg-green-50 text-green-700' :
                              item.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{item.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Related Tab ===== */}
        {activeTab === 'related' && (
          <div className="max-w-3xl">
            <div className="bg-white shadow-card rounded-lg p-6">
              <div className="flex items-center gap-2 mb-5">
                <CalendarDays className="w-4 h-4 text-[#999]" />
                <h3 className="text-[15px] font-semibold text-[#171717] tracking-tight-sm">Related Products</h3>
                <span className="ml-auto text-[12px] text-[#888] tabular-nums">{relatedProducts.length} match{relatedProducts.length !== 1 ? 'es' : ''}</span>
              </div>
              {relatedProducts.length === 0 ? (
                <div className="bg-[#fafafa] rounded-md px-5 py-8 text-center">
                  <Package className="w-6 h-6 text-[#ccc] mx-auto mb-3" />
                  <p className="text-[13px] text-[#888]">No related products found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedProducts.map((r) => (
                    <button key={r.id} onClick={() => navigate(roleHref(`/catalog/${r.id}`))}
                      className="w-full text-left shadow-border rounded-md px-5 py-4 hover:bg-[#fafafa] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[14px] font-medium text-[#171717]">{r.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
                              style={{ backgroundColor: BRAND_COLORS[r.brand] + '12', color: BRAND_COLORS[r.brand] }}
                            >
                              {r.brand}
                            </span>
                            <span className="text-[12px] text-[#888]">{r.brandCode ?? r.brand}</span>
                          </div>
                        </div>
                        <span className="text-[12px] text-[#bbb] tabular-nums whitespace-nowrap">{r.width}" × {r.height}" × {r.depth}"</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  )
}
