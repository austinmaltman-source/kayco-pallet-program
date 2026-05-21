import { ListChecks } from 'lucide-react'
import { useCatalogStore } from '../../stores/catalog-store'
import { useDisplayStore } from '../../stores/display-store'
import type { Rule } from '../../lib/rules/types'

export function RulesEditor() {
  const currentProject = useDisplayStore((state) => state.currentProject)
  const setPackingRules = useDisplayStore((state) => state.setPackingRules)
  const products = useCatalogStore((state) => state.products)

  if (!currentProject) return null

  const rules = currentProject.packingRules ?? []
  const hasLightOnTop = rules.some(
    (rule) => rule.kind === 'top-tier' && rule.strategy === 'lightest',
  )
  const capRule = rules.find(
    (rule): rule is Extract<Rule, { kind: 'capping' }> => rule.kind === 'capping',
  )
  const assortmentProductIds = currentProject.assortment.map((entry) => entry.productId)
  const assortmentProducts = products.filter((product) =>
    assortmentProductIds.includes(product.id),
  )

  const without = (kind: Rule['kind']) => rules.filter((rule) => rule.kind !== kind)

  return (
    <div className="absolute left-4 bottom-6 z-30 w-[280px] rounded-lg bg-white shadow-elevated border border-black/5 p-3">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks size={15} className="text-[#555]" />
        <p className="text-[12px] font-semibold text-[#171717]">Rules</p>
      </div>

      <label className="flex items-center justify-between gap-3 text-[12px] text-[#333]">
        Lightest cases top
        <input
          type="checkbox"
          checked={hasLightOnTop}
          onChange={(event) => {
            const next = without('top-tier')
            setPackingRules(
              event.target.checked
                ? [...next, { kind: 'top-tier', strategy: 'lightest' }]
                : next,
            )
          }}
        />
      </label>

      <label className="block text-[10px] uppercase tracking-wider text-[#777] mt-3 mb-1">
        Cap product
      </label>
      <select
        value={capRule?.productId ?? ''}
        onChange={(event) => {
          const next = without('capping')
          setPackingRules(
            event.target.value
              ? [...next, { kind: 'capping', productId: event.target.value, quantity: 1 }]
              : next,
          )
        }}
        className="w-full rounded-md border border-[#ddd] px-2 py-1.5 text-[12px] text-[#171717] bg-white"
      >
        <option value="">None</option>
        {assortmentProducts.map((product) => (
          <option key={product.id} value={product.id}>
            {product.kaycoItemNumber || product.upc || product.name}
          </option>
        ))}
      </select>
    </div>
  )
}
