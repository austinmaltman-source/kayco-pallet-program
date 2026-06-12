import type { StateCreator } from 'zustand'
import type { PlacedProduct } from '../../types'
import { nextOrientation } from '../../lib/orientation-presets'
import { useCatalogStore } from '../catalog-store'
import { useRetailerStore } from '../retailer-store'
import { buildTierConfigs } from '../../lib/shelfCoordinates'
import type { DisplayState, PhysicsSlice } from './types'
import { buildPlacementShape, commitProjectUpdate, withTransform } from './helpers'

export const createPhysicsSlice: StateCreator<
  DisplayState,
  [],
  [],
  PhysicsSlice
> = (set, get) => ({
  carryPlacementId: null,
  isDragging3D: false,
  heldPlacementId: null,
  offPalletNotice: null,
  wakeToken: 0,
  cameraResetToken: 0,

  spawnProduct: (product) => {
    const state = get()
    if (!state.currentProject) return undefined

    const allProducts = useCatalogStore.getState().products
    // Pallet programs deal in cases: a single-unit product that knows its
    // case count places as a real case rendering every unit inside it.
    const { dimensions, caseConfig } = buildPlacementShape(product, allProducts)

    // Spawn in midair in front of the display; the drag manager picks it up
    // and follows the cursor immediately (carry mode).
    const placement: PlacedProduct = {
      id: crypto.randomUUID(),
      sourceProductId: product.id,
      slotId: '',
      width: dimensions.width,
      height: dimensions.height,
      depth: dimensions.depth,
      color: product.brandColor,
      label: product.name,
      sku: product.sku,
      category: product.category,
      imageUrl: product.imageUrl,
      modelUrl: product.modelUrl,
      packaging: product.packaging,
      caseConfig,
      quantity: 1,
      position: [0, 50, 30],
      quaternion: [0, 0, 0, 1],
    }

    const nextProject = {
      ...state.currentProject,
      placements: [...state.currentProject.placements, placement],
      updatedAt: Date.now(),
    }

    set({
      ...commitProjectUpdate(state, nextProject),
      carryPlacementId: placement.id,
      isPickerOpen: false,
      pickerSelectedProduct: null,
      selectedProductId: null,
    })

    return placement.id
  },

  settlePlacements: (updates) => {
    const state = get()
    if (!state.currentProject || updates.length === 0) return

    const updateMap = new Map(updates.map((update) => [update.id, update]))
    let changed = false

    // Items that settle on the floor fell (or were dropped) off the pallet:
    // return them to the catalog instead of persisting a floor position.
    // Two signals: anchor near the ground anywhere, or low and outside the
    // pallet footprint (a tipped-over item's anchor can sit a half-extent
    // above the floor, so a pure height test misses it).
    const retailer = useRetailerStore
      .getState()
      .getRetailer(state.currentProject.retailerId)
    const halfWidth = (retailer?.palletDimensions.width ?? 48) / 2 + 2
    const halfDepth = (retailer?.palletDimensions.depth ?? 40) / 2 + 2
    const isOffPallet = (position: [number, number, number]) => {
      const [x, y, z] = position
      if (!Number.isFinite(y)) return false
      if (y < 2) return true
      const outsideFootprint = Math.abs(x) > halfWidth || Math.abs(z) > halfDepth
      return outsideFootprint && y < 10
    }

    const returned: PlacedProduct[] = []
    const kept = state.currentProject.placements.filter((placement) => {
      const update = updateMap.get(placement.id)
      if (!update) return true
      if (!isOffPallet(update.position)) return true
      returned.push(placement)
      updateMap.delete(placement.id)
      return false
    })
    if (returned.length > 0) changed = true

    const placements = kept.map((placement) => {
      const update = updateMap.get(placement.id)
      if (!update) return placement

      // Skip writes that are within noise of the stored transform so a
      // body's spawn-time auto-sleep does not strip its slot data or spam
      // the undo history.
      if (placement.position && placement.quaternion) {
        const [px, py, pz] = placement.position
        const [ux, uy, uz] = update.position
        const positionClose =
          Math.abs(px - ux) < 0.05 &&
          Math.abs(py - uy) < 0.05 &&
          Math.abs(pz - uz) < 0.05
        const [qx, qy, qz, qw] = placement.quaternion
        const [vx, vy, vz, vw] = update.quaternion
        const dot = Math.abs(qx * vx + qy * vy + qz * vz + qw * vw)
        if (positionClose && dot > 0.99995) return placement
      }

      // Reject blown-up physics states; keep the last good transform.
      const values = [...update.position, ...update.quaternion]
      if (values.some((value) => !Number.isFinite(value)) || update.position[1] < -10) {
        return placement
      }

      changed = true
      // The item physically moved: world transform is now its only truth.
      return {
        ...placement,
        position: update.position,
        quaternion: update.quaternion,
        slotId: '',
        wall: undefined,
        tier: undefined,
        gridCol: undefined,
        colSpan: undefined,
        displayMode: undefined,
      }
    })

    if (!changed) return

    set({
      ...commitProjectUpdate(state, {
        ...state.currentProject,
        placements,
        updatedAt: Date.now(),
      }),
      ...(returned.length > 0
        ? {
            offPalletNotice: {
              label:
                returned.length === 1
                  ? returned[0].label
                  : `${returned.length} items`,
              at: Date.now(),
            },
            selectedProductId: returned.some(
              (p) => p.id === state.selectedProductId,
            )
              ? null
              : state.selectedProductId,
            carryPlacementId: returned.some(
              (p) => p.id === state.carryPlacementId,
            )
              ? null
              : state.carryPlacementId,
          }
        : {}),
    })
  },

  duplicatePlacement: (placementId) => {
    const state = get()
    if (!state.currentProject) return

    const source = state.currentProject.placements.find(
      (placement) => placement.id === placementId,
    )
    if (!source || !source.position) return

    // Spawn the copy just above the original so it falls and stacks.
    const copy: PlacedProduct = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      slotId: '',
      wall: undefined,
      tier: undefined,
      gridCol: undefined,
      colSpan: undefined,
      displayMode: undefined,
      position: [
        source.position[0],
        source.position[1] + source.height + 1,
        source.position[2],
      ],
    }

    const nextProject = {
      ...state.currentProject,
      placements: [...state.currentProject.placements, copy],
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  nudgePlacement: (placementId, delta) => {
    const state = get()
    if (!state.currentProject) return

    let changed = false
    const placements = state.currentProject.placements.map((placement) => {
      if (placement.id !== placementId || !placement.position) return placement
      changed = true
      const [x, y, z] = placement.position
      return {
        ...placement,
        position: [x + delta[0], Math.max(0.5, y + delta[1]), z + delta[2]] as [
          number,
          number,
          number,
        ],
        // The item moved off its slot-derived spot: world transform is now
        // its only truth (same contract as settlePlacements).
        slotId: '',
        wall: undefined,
        tier: undefined,
        gridCol: undefined,
        colSpan: undefined,
        displayMode: undefined,
      }
    })
    if (!changed) return

    set(
      commitProjectUpdate(state, {
        ...state.currentProject,
        placements,
        updatedAt: Date.now(),
      }),
    )
  },

  resetCamera: () =>
    set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),

  setCarryPlacement: (placementId) => set({ carryPlacementId: placementId }),

  setDragging3D: (dragging) => set({ isDragging3D: dragging }),

  setHeldPlacement: (placementId) => set({ heldPlacementId: placementId }),

  clearOffPalletNotice: () => set({ offPalletNotice: null }),

  rotateProduct: (placementId) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      placements: state.currentProject.placements.map((placement) => {
        if (placement.id !== placementId) return placement

        // Free (physics) placement: step the quaternion 90 degrees around
        // the world up axis and let the body re-settle.
        const isFree =
          placement.position &&
          placement.quaternion &&
          placement.wall === undefined &&
          !placement.slotId
        if (isFree) {
          const [qx, qy, qz, qw] = placement.quaternion!
          const half = Math.PI / 4
          const yawX = 0
          const yawY = Math.sin(half)
          const yawZ = 0
          const yawW = Math.cos(half)
          // quaternion multiply: yaw * q
          const nx = yawW * qx + yawX * qw + yawY * qz - yawZ * qy
          const ny = yawW * qy - yawX * qz + yawY * qw + yawZ * qx
          const nz = yawW * qz + yawX * qy - yawY * qx + yawZ * qw
          const nw = yawW * qw - yawX * qx - yawY * qy - yawZ * qz
          return {
            ...placement,
            quaternion: [nx, ny, nz, nw] as [number, number, number, number],
          }
        }

        return withTransform(
          { ...placement, orientation: nextOrientation(placement.orientation) },
          state.currentProject!,
        )
      }),
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  removeProduct: (placementId) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      placements: state.currentProject.placements.filter(
        (placement) => placement.id !== placementId,
      ),
      updatedAt: Date.now(),
    }

    set({
      ...commitProjectUpdate(state, nextProject),
      selectedProductId:
        state.selectedProductId === placementId ? null : state.selectedProductId,
      carryPlacementId:
        state.carryPlacementId === placementId ? null : state.carryPlacementId,
    })
  },

  populateFromAssortment: () => {
    const state = get()
    if (!state.currentProject) return

    const assortment = state.currentProject.assortment ?? []
    const activeEntries = assortment.filter((e) => e.cases > 0)
    if (activeEntries.length === 0) return

    const allProducts = useCatalogStore.getState().products
    const productMap = new Map(allProducts.map((p) => [p.id, p]))

    // Sort by weight descending — heaviest first
    const sorted = [...activeEntries]
      .map((entry) => ({ ...entry, product: productMap.get(entry.productId) }))
      .filter((entry) => entry.product)
      .sort((a, b) => (b.product!.weight ?? 0) - (a.product!.weight ?? 0))

    const tierCount = state.currentProject.tierCount
    const retailer = useRetailerStore
      .getState()
      .getRetailer(state.currentProject.retailerId)
    const tiers = buildTierConfigs(
      tierCount,
      retailer?.maxDisplayHeight ?? 60,
      state.currentProject.palletType,
    )
    const palletHeight = retailer?.palletDimensions.height ?? 6

    // Weight-based tier assignment:
    // Tier 1 (bottom) = heavy items, tier N (top) = lightest, rest between.
    const placements: PlacedProduct[] = []

    const HEAVY_THRESHOLD = 1.5 // lbs - anything above goes on tier 1
    const LIGHT_THRESHOLD = 0.6 // lbs - anything below goes on top tier

    const heavy: typeof sorted = []
    const mid: typeof sorted = []
    const light: typeof sorted = []

    for (const entry of sorted) {
      const w = entry.product!.weight ?? 0
      if (w >= HEAVY_THRESHOLD) heavy.push(entry)
      else if (w <= LIGHT_THRESHOLD) light.push(entry)
      else mid.push(entry)
    }

    const assignments: Array<{ product: typeof sorted[0]['product']; tier: number }> = []

    for (const entry of heavy) {
      assignments.push({ product: entry.product, tier: 1 })
    }
    for (const entry of light) {
      assignments.push({ product: entry.product, tier: tierCount })
    }
    const midTierStart = 2
    const midTierEnd = Math.max(midTierStart, tierCount - 1)
    const midTierCount = midTierEnd - midTierStart + 1
    for (let i = 0; i < mid.length; i++) {
      const tier = midTierStart + (i % midTierCount)
      assignments.push({ product: mid[i].product, tier })
    }

    // Lay items out left-to-right along each tier's front tray as free
    // physics placements; gravity settles them when the scene loads.
    const GAP = 0.75
    const cursors = new Map<number, number>()

    for (const { product, tier: tierId } of assignments) {
      if (!product) continue
      const tier = tiers.find((t) => t.id === tierId)
      if (!tier) continue

      const { dimensions, caseConfig } = buildPlacementShape(product, allProducts)
      if (dimensions.height > tier.trayHeight + 0.5) continue // too tall for this tier

      const startX = -tier.width / 2 + 1
      const cursor = cursors.get(tierId) ?? startX
      if (cursor + dimensions.width > tier.width / 2 - 1) continue // tier full
      cursors.set(tierId, cursor + dimensions.width + GAP)

      const surfaceY = palletHeight + tier.yOffset + 1
      const frontZ = tier.depth / 2 - dimensions.depth / 2 - 1

      placements.push({
        id: crypto.randomUUID(),
        sourceProductId: product.id,
        slotId: '',
        width: dimensions.width,
        height: dimensions.height,
        depth: dimensions.depth,
        color: product.brandColor,
        label: product.name,
        sku: product.sku,
        category: product.category,
        imageUrl: product.imageUrl,
        modelUrl: product.modelUrl,
        packaging: product.packaging,
        caseConfig,
        quantity: 1,
        position: [cursor + dimensions.width / 2, surfaceY, frontZ],
        quaternion: [0, 0, 0, 1],
      })
    }

    const nextProject = {
      ...state.currentProject,
      placements,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },
})
