export type Rule =
  | {
      kind: 'tier-composition'
      tier: number
      productIds: string[]
    }
  | {
      kind: 'tier-sequencing'
      tier: number
      sortBy: 'weight-desc' | 'weight-asc' | 'name'
    }
  | {
      kind: 'top-tier'
      strategy: 'lightest' | 'smallest'
      productIds?: string[]
    }
  | {
      kind: 'capping'
      productId: string
      quantity: number
    }
  | {
      kind: 'block'
      productIds: string[]
    }
  | {
      kind: 'min-max-facings'
      productId: string
      min: number
      max: number
    }

export interface RuleWarning {
  ruleKind: Rule['kind']
  message: string
}
