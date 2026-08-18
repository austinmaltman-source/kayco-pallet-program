import type { DisplayProject, Product } from '../../types'
import { getAppSettingsSnapshot } from '../app-settings-store'
import { useRetailerStore } from '../retailer-store'
import {
  resolveProductDimensions,
  calculateCaseDimensions,
} from '../../lib/dimensionEngine'
import { deriveCaseLayout } from '../../lib/caseLayout'
import { computePlacementTransform } from '../../lib/placementMigration'
import type { DisplayState, PlacementShape } from './types'

export function replaceProject(
  projects: DisplayProject[],
  nextProject: DisplayProject,
) {
  const existingIndex = projects.findIndex((project) => project.id === nextProject.id)
  if (existingIndex === -1) {
    return [...projects, nextProject]
  }

  return projects.map((project) =>
    project.id === nextProject.id ? nextProject : project,
  )
}

export function hydrateSelectionState() {
  const settings = getAppSettingsSnapshot()
  return {
    activeFace: settings.defaultFace,
    cameraPreset: settings.defaultCameraPreset,
  }
}

// Synthesize the physical shape a product takes on a pallet: its caseConfig
// (authored, or derived from unitsPerCase) and the resulting dimensions.
export function buildPlacementShape(
  product: Product,
  allProducts: Product[],
): PlacementShape {
  let dimensions = resolveProductDimensions(product, allProducts)
  let caseConfig = product.caseConfig

  if (
    !caseConfig &&
    (product.unitsPerCase ?? 0) > 1 &&
    product.width > 0 &&
    product.height > 0 &&
    product.depth > 0
  ) {
    const layout = deriveCaseLayout(product.unitsPerCase!)
    caseConfig = {
      unitProductId: product.id,
      layout,
      caseStyle: 'open-top' as const,
      innerPadding: 0.25,
      dividers: false,
    }
    dimensions = calculateCaseDimensions(
      { width: product.width, height: product.height, depth: product.depth, source: 'manual' },
      layout,
      0.25,
      false,
    )
  }

  return { dimensions, caseConfig }
}

// Physical shape of ONE sleeve/inner pack: the case sliced into
// sleevesPerCase boxes using the same grid heuristic as unit layouts, so a
// 12-sleeve case becomes a 4x3 grid of sleeve-slabs rather than paper-thin
// slices. Rendered as a plain box (no per-piece caseConfig).
export function buildSleeveShape(
  product: Product,
  allProducts: Product[],
): { width: number; height: number; depth: number } {
  const sleeves = product.sleevesPerCase ?? 0
  const { dimensions } = buildPlacementShape(product, allProducts)
  if (sleeves <= 1) return dimensions
  const layout = deriveCaseLayout(sleeves)
  return {
    width: Math.max(0.5, dimensions.width / layout.cols),
    depth: Math.max(0.5, dimensions.depth / layout.rows),
    height: Math.max(0.5, dimensions.height / layout.layers),
  }
}

// Stamp a slot-based placement with its world transform so the physics
// sandbox can spawn it as a rigid body. No-op for placements whose slot data
// cannot be resolved (their existing transform, if any, stays).
export function withTransform(
  placement: DisplayProject['placements'][number],
  project: DisplayProject,
): DisplayProject['placements'][number] {
  const retailer = useRetailerStore.getState().getRetailer(project.retailerId)
  const transform = computePlacementTransform(placement, {
    palletType: project.palletType,
    tierCount: project.tierCount,
    palletDimensions: retailer?.palletDimensions ?? { width: 48, depth: 40, height: 6 },
    maxDisplayHeight: retailer?.maxDisplayHeight ?? 60,
  })
  return transform ? { ...placement, ...transform } : placement
}

// Recompute transforms for every slot-based placement. Needed when the shelf
// geometry itself changes (tier count, pallet type).
export function refreshSlotTransforms(project: DisplayProject): DisplayProject {
  return {
    ...project,
    placements: project.placements.map((placement) =>
      withTransform(placement, project),
    ),
  }
}

// Apply a project mutation and push it onto the undo history. Pure over the
// passed state; returns the partial the caller spreads into set().
export function commitProjectUpdate(
  state: DisplayState,
  nextProject: DisplayProject,
) {
  const snapshot = structuredClone(nextProject)
  const nextHistory = state.history.slice(0, state.historyIndex + 1)
  nextHistory.push(snapshot)
  if (nextHistory.length > 50) nextHistory.shift()

  return {
    currentProject: nextProject,
    projects: replaceProject(state.projects, nextProject),
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
  }
}
