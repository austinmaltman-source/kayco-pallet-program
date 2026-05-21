import type { Orientation3D, PalletSpec, Product } from '../../types'
import type { RuleWarning } from '../rules/types'

export interface PackBox {
  product: Product
  quantity: number
}

export interface PackInput {
  boxes: PackBox[]
  spec: PalletSpec
}

export interface PackOptions {
  pattern: 'column' | 'interlock' | 'pinwheel'
  respectFragile: boolean
  lightOnTop: boolean
  homogeneousLayers: boolean
}

export interface PackedPlacement {
  id: string
  productId: string
  x: number
  y: number
  z: number
  rotationDeg: 0 | 90 | 180 | 270
  orientation3D: Orientation3D
}

export interface UnplacedBox {
  productId: string
  productName: string
  reason: string
}

export interface PackResult {
  placements: PackedPlacement[]
  unplaced: UnplacedBox[]
  ruleWarnings?: RuleWarning[]
}

export interface ExtremePoint {
  x: number
  y: number
  z: number
}

export const DEFAULT_PACK_OPTIONS: PackOptions = {
  pattern: 'column',
  respectFragile: true,
  lightOnTop: true,
  homogeneousLayers: false,
}
