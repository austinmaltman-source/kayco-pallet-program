import type { PalletWarning } from '../../types'
import type { AABB } from './aabb'
import { horizontalOverlapArea } from './aabb'

export function computeCrushWarnings(boxes: AABB[], tolerance = 0.05): PalletWarning[] {
  const warnings: PalletWarning[] = []

  for (const lower of boxes) {
    const loadAboveLb = boxes.reduce((sum, upper) => {
      if (upper.placementId === lower.placementId) return sum
      const restsAbove = upper.min.y >= lower.max.y - tolerance
      if (!restsAbove) return sum
      return horizontalOverlapArea(lower, upper) > 0 ? sum + upper.weightLb : sum
    }, 0)

    if (loadAboveLb <= 0) continue

    if (lower.crushable) {
      warnings.push({
        kind: 'crush',
        placementId: lower.placementId,
        loadAboveLb,
        maxLoadLb: 0,
      })
      continue
    }

    if (lower.fragile && loadAboveLb > lower.weightLb * 1.2) {
      warnings.push({
        kind: 'fragile-under-heavy',
        placementId: lower.placementId,
      })
    }

    if (
      lower.maxStackLoadLb !== undefined &&
      loadAboveLb > lower.maxStackLoadLb
    ) {
      warnings.push({
        kind: 'crush',
        placementId: lower.placementId,
        loadAboveLb,
        maxLoadLb: lower.maxStackLoadLb,
      })
    }
  }

  return warnings
}
