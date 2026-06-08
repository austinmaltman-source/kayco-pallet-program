import type { PlacedProduct } from '../../../types'
import { resolveProductDisplayPreset } from './productDisplayPresets'

export interface MerchBlockLayout {
  renderStyle: NonNullable<PlacedProduct['renderStyle']>
  facings: number
  rows: number
  layers: number
  merchGap: number
  rowStep: number
  layerStep: number
  blockWidth: number
  blockDepth: number
  blockHeight: number
  positions: Array<{
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }>
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function variation(
  index: number,
  preset: ReturnType<typeof resolveProductDisplayPreset>,
) {
  const seedA = Math.sin(index * 12.9898) * 43758.5453
  const seedB = Math.sin((index + 1) * 78.233) * 12345.6789
  return {
    x: (seedA - Math.floor(seedA) - 0.5) * preset.xJitter * 2,
    z: (seedB - Math.floor(seedB) - 0.5) * preset.zJitter * 2,
    y: ((seedA + seedB) % 1 - 0.5) * preset.yJitter * 2,
    yaw: (((seedA * 0.1) % 1) - 0.5) * preset.yawJitter * 2,
    pitch: (((seedB * 0.1) % 1) - 0.5) * preset.pitchJitter * 2,
  }
}

export function deriveMerchBlockLayout(
  product: Pick<
    PlacedProduct,
    | 'width'
    | 'height'
    | 'depth'
    | 'packaging'
    | 'caseConfig'
    | 'label'
    | 'sku'
    | 'category'
    | 'renderStyle'
    | 'facings'
    | 'rows'
    | 'layers'
    | 'merchGap'
  >,
  availableSpace: { width: number; height: number; depth: number },
): MerchBlockLayout {
  if (product.caseConfig || product.renderStyle === 'case') {
    return {
      renderStyle: 'case',
      facings: 1,
      rows: 1,
      layers: 1,
      merchGap: 0,
      rowStep: 0,
      layerStep: product.height,
      blockWidth: product.width,
      blockDepth: product.depth,
      blockHeight: product.height,
      positions: [{ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
    }
  }

  const packaging = product.packaging ?? 'box'
  const preset = resolveProductDisplayPreset(product)
  const defaultGap = product.merchGap ?? preset.gap
  const widthUsage = availableSpace.width * preset.widthFill
  const depthUsage = availableSpace.depth * preset.depthFill
  const heightUsage = availableSpace.height * preset.heightFill

  const maxFacings = Math.max(
    1,
    Math.floor((widthUsage + defaultGap) / (product.width + defaultGap)),
  )
  const facings = product.facings ?? clamp(maxFacings, 1, preset.facingsCap)

  const rowCompression = preset.rowCompression
  const rowStep = product.depth * rowCompression + defaultGap
  const maxRows = Math.max(
    1,
    Math.floor((depthUsage - product.depth) / Math.max(rowStep, 0.1)) + 1,
  )
  const rows = product.rows ?? clamp(maxRows, 1, preset.rowsCap)

  const layerStep = product.height * preset.layerCompression
  const maxLayers = Math.max(
    1,
    Math.floor((heightUsage - product.height) / Math.max(layerStep, 0.1)) + 1,
  )
  const layers = product.layers ?? clamp(maxLayers, 1, preset.layersCap)

  const renderStyle =
    product.renderStyle ??
    (packaging === 'bag'
      ? 'stepped-stack'
      : packaging === 'box'
        ? rows > 1 || layers > 1
          ? 'deep-stock'
          : 'facing-row'
        : 'facing-row')

  const blockWidth = facings * product.width + Math.max(0, facings - 1) * defaultGap
  const blockDepth = product.depth + Math.max(0, rows - 1) * rowStep
  const blockHeight = product.height + Math.max(0, layers - 1) * layerStep

  const startX = -blockWidth / 2 + product.width / 2
  const frontPackedOffset = Math.max(
    0,
    ((availableSpace.depth - blockDepth) / 2) * preset.frontPackRatio,
  )
  const startZ = blockDepth / 2 - product.depth / 2 + frontPackedOffset

  const positions = []

  for (let layer = 0; layer < layers; layer += 1) {
    for (let row = 0; row < rows; row += 1) {
      for (let facing = 0; facing < facings; facing += 1) {
        const index = layer * rows * facings + row * facings + facing
        const jitter = variation(index, preset)
        const x = startX + facing * (product.width + defaultGap) + jitter.x
        const z = startZ - row * rowStep + jitter.z
        const y = layer * layerStep + Math.max(0, jitter.y)
        const rotation: [number, number, number] =
          renderStyle === 'stepped-stack'
            ? [
                jitter.pitch +
                  row * preset.stackLeanPerRow +
                  layer * preset.stackLeanPerLayer,
                jitter.yaw,
                0,
              ]
            : [0, jitter.yaw, 0]
        const scale: [number, number, number] =
          renderStyle === 'stepped-stack'
            ? [1, 1 - layer * 0.01, 1]
            : [1, 1, 1]

        positions.push({
          position: [x, y, z] as [number, number, number],
          rotation,
          scale,
        })
      }
    }
  }

  return {
    renderStyle,
    facings,
    rows,
    layers,
    merchGap: defaultGap,
    rowStep,
    layerStep,
    blockWidth,
    blockDepth,
    blockHeight,
    positions,
  }
}
