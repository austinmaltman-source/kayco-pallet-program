import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadProductImageMap } from '../../lib/product-images'
import { useDisplayStore } from '../../stores/display-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { commitProjectUpdate } from '../../stores/display/helpers'
import type { PalletType, PlacedProduct } from '../../types'
import { type BuilderContext, reflowForGeometry, respecProduct, surfacesFor } from '../../lib/builder/builder-model'
import { setSquishOverrides } from '../../lib/builder/case-spec'
import { normalizeDividers } from '../../lib/builder/display-spec'

// Store glue for the v2 builder: the active pallet, its geometry context and
// one `commit` that writes placements as a single undoable history entry
// (persisted + synced by the app's existing store subscriptions).
export function useBuilder() {
  const project = useDisplayStore((s) => s.currentProject)
  const historyIndex = useDisplayStore((s) => s.historyIndex)
  const historyLength = useDisplayStore((s) => s.history.length)
  const undo = useDisplayStore((s) => s.undo)
  const redo = useDisplayStore((s) => s.redo)
  const rawCatalog = useCatalogStore((s) => s.products)
  // Product photos straight from the image map as well, so the builder shows
  // real photos even before the catalog store has merged them in.
  const [imageMap, setImageMap] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    let alive = true
    void loadProductImageMap().then((m) => alive && setImageMap(m))
    return () => {
      alive = false
    }
  }, [])
  const catalog = useMemo(() => {
    if (!imageMap) return rawCatalog
    return rawCatalog.map((p) => {
      const url = !p.imageUrl && p.kaycoItemNumber ? imageMap[p.kaycoItemNumber.trim()] : undefined
      return url ? { ...p, imageUrl: url } : p
    })
  }, [rawCatalog, imageMap])
  const retailer = useRetailerStore((s) =>
    project ? s.getRetailer(project.retailerId) : undefined,
  )

  // Per-item squishable overrides feed case sizing (module-level registry).
  setSquishOverrides(project?.squishOverrides)

  const palletDims = retailer?.palletDimensions ?? { width: 48, depth: 40, height: 6 }
  const maxDisplayHeight = retailer?.maxDisplayHeight ?? 60
  const ctx: BuilderContext = useMemo(
    () => ({
      palletType: project?.palletType ?? 'full',
      tierCount: project?.tierCount ?? 4,
      palletHeight: palletDims.height,
      maxDisplayHeight,
      dividers: project?.cubbyDividers,
    }),
    [project?.palletType, project?.tierCount, palletDims.height, maxDisplayHeight, project?.cubbyDividers],
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
      const { placements, dropped } = reflowForGeometry(
        current.placements,
        { ...ctx, palletType, tierCount },
        catalog,
      )
      commit(placements, { palletType, tierCount })
      return dropped
    },
    [commit, ctx, catalog],
  )

  // Move / add / remove cubby dividers on one shelf (or several) in one
  // undoable step; products re-seat into the new cubbies.
  const setDividers = useCallback(
    (levels: number[], xs: number[]) => {
      const current = useDisplayStore.getState().currentProject
      if (!current) return [] as PlacedProduct[]
      const clean = normalizeDividers(xs)
      const cubbyDividers = { ...(current.cubbyDividers ?? {}) }
      levels.forEach((l) => {
        cubbyDividers[l] = clean
      })
      const { placements, dropped } = reflowForGeometry(current.placements, { ...ctx, dividers: cubbyDividers }, catalog)
      commit(placements, { cubbyDividers })
      return dropped
    },
    [commit, ctx, catalog],
  )

  const setSquish = useCallback(
    (productId: string, on: boolean) => {
      const current = useDisplayStore.getState().currentProject
      if (!current) return [] as PlacedProduct[]
      const squishOverrides = { ...(current.squishOverrides ?? {}), [productId]: on }
      setSquishOverrides(squishOverrides)
      const { placements, dropped } = respecProduct(current.placements, productId, ctx, catalog)
      commit(placements, { squishOverrides })
      return dropped
    },
    [commit, ctx, catalog],
  )

  return {
    setDividers,
    setSquish,
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
