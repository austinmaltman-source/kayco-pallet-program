import type { PackInput } from '../packing/types'
import type { Rule, RuleWarning } from './types'

export interface RuleApplicationResult {
  input: PackInput
  warnings: RuleWarning[]
}

function productVolume(box: PackInput['boxes'][number]): number {
  return (
    (box.product.caseWidth ?? box.product.width) *
    (box.product.caseDepth ?? box.product.depth) *
    (box.product.caseHeight ?? box.product.height)
  )
}

export function applyRulesToPackInput(input: PackInput, rules: Rule[]): RuleApplicationResult {
  const warnings: RuleWarning[] = []
  let boxes = [...input.boxes]

  for (const rule of rules) {
    switch (rule.kind) {
      case 'min-max-facings':
        boxes = boxes.map((box) =>
          box.product.id === rule.productId
            ? {
                ...box,
                quantity: Math.max(rule.min, Math.min(rule.max, box.quantity)),
              }
            : box,
        )
        break
      case 'capping': {
        const existing = boxes.find((box) => box.product.id === rule.productId)
        if (!existing) {
          warnings.push({
            ruleKind: rule.kind,
            message: `Cap product ${rule.productId} is not in the pack input.`,
          })
          break
        }
        boxes = boxes.map((box) =>
          box.product.id === rule.productId
            ? { ...box, quantity: Math.max(box.quantity, rule.quantity) }
            : box,
        )
        break
      }
      case 'block': {
        const order = new Map(rule.productIds.map((productId, index) => [productId, index]))
        boxes = [...boxes].sort((a, b) => {
          const aOrder = order.get(a.product.id) ?? Number.MAX_SAFE_INTEGER
          const bOrder = order.get(b.product.id) ?? Number.MAX_SAFE_INTEGER
          return aOrder - bOrder
        })
        break
      }
      case 'tier-composition': {
        const missing = rule.productIds.filter(
          (productId) => !boxes.some((box) => box.product.id === productId),
        )
        if (missing.length > 0) {
          warnings.push({
            ruleKind: rule.kind,
            message: `Tier ${rule.tier} references ${missing.length} product that is not in the assortment.`,
          })
        }
        break
      }
      case 'tier-sequencing':
        boxes = [...boxes].sort((a, b) => {
          if (rule.sortBy === 'name') return a.product.name.localeCompare(b.product.name)
          if (rule.sortBy === 'weight-asc') return a.product.weight - b.product.weight
          return b.product.weight - a.product.weight
        })
        break
      case 'top-tier':
        boxes = [...boxes].sort((a, b) => {
          if (rule.strategy === 'smallest') return productVolume(b) - productVolume(a)
          return b.product.weight - a.product.weight
        })
        break
    }
  }

  const topTierRules = rules.filter((rule) => rule.kind === 'top-tier')
  if (topTierRules.length > 1) {
    warnings.push({
      ruleKind: 'top-tier',
      message: 'Multiple top-tier rules are active. The last sort order wins.',
    })
  }

  const compositionProductIds = new Set(
    rules
      .filter((rule): rule is Extract<Rule, { kind: 'tier-composition' }> =>
        rule.kind === 'tier-composition',
      )
      .flatMap((rule) => rule.productIds),
  )
  const topTierProductRules = rules.filter(
    (rule): rule is Extract<Rule, { kind: 'top-tier' }> =>
      rule.kind === 'top-tier' && Boolean(rule.productIds?.length),
  )
  for (const rule of topTierProductRules) {
    const conflicts = rule.productIds?.filter(
      (productId) => !compositionProductIds.has(productId),
    )
    if (conflicts && conflicts.length > 0 && compositionProductIds.size > 0) {
      warnings.push({
        ruleKind: rule.kind,
        message: `${conflicts.length} top-tier product conflicts with tier composition rules.`,
      })
    }
  }

  return {
    input: {
      ...input,
      boxes,
    },
    warnings,
  }
}
