import { useCallback, useMemo } from 'react'
import { useDisplayStore } from '../../stores/display-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { commitProjectUpdate } from '../../stores/display/helpers'
import type { PalletType, PlacedProduct } from '../../types'
import { type BuilderContext, reflowForGeometry, surfacesFor } from '../../lib/builder/builder-model'

// Store glue for the v2 builder: the active pallet, its geometry context and
// one `commit` that writes placements as a single undoable history entry
// (persisted + synced by the app's existing store subscriptions).
export function useBuilder() {
  const project = useDisplayStore((s) => s.currentProject)
  const historyIndex = useDisplayStore((s) => s.historyIndex)
  const historyLength = useDisplayStore((s) => s.history.length)
  const undo = useDisplayStore((s) => s.undo)
  const redo = useDisplayStore((s) => s.redo)
  const catalog = useCatalogStore((s) => s.products)
  const retailer = useRetailerStore((s) =>
    project ? s.getRetailer(project.retailerId) : undefined,
  )

  const palletDims = retailer?.palletDimensions ?? { width: 48, depth: 40, height: 6 }
  const maxDisplayHeight = retailer?.maxDisplayHeight ?? 60
  const ctx: BuilderContext = useMemo(
    () => ({
      palletType: project?.palletType ?? 'full',
      tierCount: project?.tierCount ?? 4,
      palletHeight: palletDims.height,
      maxDisplayHeight,
    }),
    [project?.palletType, project?.tierCount, palletDims.height, maxDisplayHeight],
  )
  const surfaces = useMemo(() => surfacesFor(ctx), [ctx])

  const commit = useCallback((placements: PlacedProduct[], extra: Partial<NonNullable<typeof project>> = {}) => {
    useDisplayStore.setState((state) => {
      if (!state.currentProject) return {}
      return commitProjectUpdate(state, {
        ...state.currentProject,
        ...extra,
        placements,
        updatedAt: Date.now(),
      })
    })
  }, [])

  // Switch half/full or the shelf count in ONE undoable step, re-seating the
  // cases on the new shelves. Returns the cases that no longer fit anywhere.
  const changeGeometry = useCallback(
    (next: { palletType?: PalletType; tierCount?: number }) => {
      const state = useDisplayStore.getState()
      const current = state.currentProject
      if (!current) return [] as PlacedProduct[]
      const palletType = next.palletType ?? current.palletType
      const tierCount = Math.min(6, Math.max(2, next.tierCount ?? current.tierCount))
      const { placements, dropped } = reflowForGeometry(current.placements, {
        ...ctx,
        palletType,
        tierCount,
      })
      commit(placements, { palletType, tierCount })
      return dropped
    },
    [commit, ctx],
  )

  return {
    project,
    retailer,
    catalog,
    ctx,
    surfaces,
    palletDims,
    maxDisplayHeight,
    commit,
    changeGeometry,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < historyLength - 1,
  }
}
