import type { StateCreator } from 'zustand'
import type { PlacedProduct } from '../../types'
import { nextOrientation } from '../../lib/orientation-presets'
import { useCatalogStore } from '../catalog-store'
import { useRetailerStore } from '../retailer-store'
import { buildTierConfigs } from '../../lib/shelfCoordinates'
import type { DisplayState, PhysicsSlice } from './types'
import { buildPlacementShape, buildSleeveShape, commitProjectUpdate, withTransform } from './helpers'

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
  verticalDragMode: false,
  heldRotateToken: 0,
  heldGroupIds: [],

  spawnProduct: (product, options) => {
    const state = get()
    if (!state.currentProject) return undefined

    const allProducts = useCatalogStore.getState().products
    // The pallet shows ITEM measurements: a spawn is one physical unit of the
    // product. Only when the product has no usable unit dimensions do we fall
    // back to its sealed-case shape. Sleeve spawns place ONE sleeve/inner
    // pack (a case slice).
    const asSleeve =
      options?.asSleeve === true && (product.sleevesPerCase ?? 0) > 1
    const hasUnitDims =
      product.width > 0.2 && product.height > 0.2 && product.depth > 0.2
    const shape = asSleeve
      ? { dimensions: buildSleeveShape(product, allProducts), caseConfig: undefined }
      : hasUnitDims
        ? {
            dimensions: {
              width: product.width,
              height: product.height,
              depth: product.depth,
            },
            caseConfig: undefined,
          }
        : buildPlacementShape(product, allProducts)
    const { dimensions, caseConfig } = shape

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
      label: asSleeve ? `${product.name} (sleeve)` : product.name,
      sku: product.sku,
      category: product.category,
      imageUrl: product.imageUrl,
      modelUrl: asSleeve ? undefined : product.modelUrl,
      packaging: product.packaging,
      caseConfig,
      ...(asSleeve ? { subunit: 'sleeve' as const } : {}),
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
      selectedProductIds: [],
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
            selectedProductIds: state.selectedProductIds.filter(
              (id) => !returned.some((p) => p.id === id),
            ),
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

  movePlacements: (updates) => {
    const state = get()
    if (!state.currentProject || updates.length === 0) return

    const updateMap = new Map(updates.map((u) => [u.id, u.position]))
    let changed = false
    const placements = state.currentProject.placements.map((placement) => {
      const position = updateMap.get(placement.id)
      if (!position) return placement
      changed = true
      return {
        ...placement,
        position: [position[0], Math.max(0.5, position[1]), position[2]] as [
          number,
          number,
          number,
        ],
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

  setVerticalDragMode: (on) => set({ verticalDragMode: on }),

  toggleVerticalDragMode: () =>
    set((state) => ({ verticalDragMode: !state.verticalDragMode })),

  requestHeldRotate: () =>
    set((state) => ({ heldRotateToken: state.heldRotateToken + 1 })),

  setCarryPlacement: (placementId) => set({ carryPlacementId: placementId }),

  setDragging3D: (dragging) => set({ isDragging3D: dragging }),

  setHeldPlacement: (placementId) => set({ heldPlacementId: placementId }),

  setHeldGroup: (placementIds) => set({ heldGroupIds: placementIds }),

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
      selectedProductIds: state.selectedProductIds.filter((id) => id !== placementId),
      carryPlacementId:
        state.carryPlacementId === placementId ? null : state.carryPlacementId,
    })
  },

  // --- Batch (multi-selection) variants: one history entry per group op ---

  removePlacements: (placementIds) => {
    const state = get()
    if (!state.currentProject || placementIds.length === 0) return
    const ids = new Set(placementIds)

    const placements = state.currentProject.placements.filter(
      (placement) => !ids.has(placement.id),
    )
    if (placements.length === state.currentProject.placements.length) return

    const nextProject = {
      ...state.currentProject,
      placements,
      updatedAt: Date.now(),
    }

    set({
      ...commitProjectUpdate(state, nextProject),
      selectedProductId: ids.has(state.selectedProductId ?? '')
        ? null
        : state.selectedProductId,
      selectedProductIds: state.selectedProductIds.filter((id) => !ids.has(id)),
      carryPlacementId: ids.has(state.carryPlacementId ?? '')
        ? null
        : state.carryPlacementId,
    })
  },

  duplicatePlacements: (placementIds) => {
    const state = get()
    if (!state.currentProject || placementIds.length === 0) return
    const ids = new Set(placementIds)

    const copies: PlacedProduct[] = state.currentProject.placements
      .filter((placement) => ids.has(placement.id) && placement.position)
      .map((source) => ({
        ...structuredClone(source),
        id: crypto.randomUUID(),
        slotId: '',
        wall: undefined,
        tier: undefined,
        gridCol: undefined,
        colSpan: undefined,
        displayMode: undefined,
        position: [
          source.position![0],
          source.position![1] + source.height + 1,
          source.position![2],
        ] as [number, number, number],
      }))
    if (copies.length === 0) return

    const nextProject = {
      ...state.currentProject,
      placements: [...state.currentProject.placements, ...copies],
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  nudgePlacements: (placementIds, delta) => {
    const state = get()
    if (!state.currentProject || placementIds.length === 0) return
    const ids = new Set(placementIds)

    let changed = false
    const placements = state.currentProject.placements.map((placement) => {
      if (!ids.has(placement.id) || !placement.position) return placement
      changed = true
      const [x, y, z] = placement.position
      return {
        ...placement,
        position: [x + delta[0], Math.max(0.5, y + delta[1]), z + delta[2]] as [
          number,
          number,
          number,
        ],
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

  populateFromAssortment: () => {
    const state = get()
    if (!state.currentProject) return

    const assortment = state.currentProject.assortment ?? []
    const activeEntries = assortment.filter((e) => e.cases > 0)
    if (activeEntries.length === 0) return

    const allProducts = useCatalogStore.getState().products
    const productMap = new Map(allProducts.map((p) => [p.id, p]))

    // Heaviest first: bottom tiers get the heavy items.
    const sorted = [...activeEntries]
      .map((entry) => ({ ...entry, product: productMap.get(entry.productId) }))
      .filter((entry) => entry.product)
      .sort((a, b) => (b.product!.weight ?? 0) - (a.product!.weight ?? 0))
    if (sorted.length === 0) return

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
    const isHalf = state.currentProject.palletType === 'half'

    // Merchandised auto-fill, Spaceman-style: every item is unpacked into
    // INDIVIDUAL units (each its own selectable, movable body) standing
    // touching in facings x rows x layers formation. Half pallets face
    // front; full pallets are shopped from all four sides, so their items
    // wrap around the tray ring. Heavy items land on the low tiers.
    const GAP = 0.05
    // Inset from the outer edge. The retaining-lip collider occupies the
    // outer 0.42in of the tray, so anything under ~0.5 here starts the fill
    // already touching the lip and gets shoved on the first settle tick.
    const EDGE = 1
    // Individual bodies are the whole point, but the solver has limits.
    const MAX_UNITS = 280

    type Face = 'front' | 'right' | 'back' | 'left'
    const FACE_YAW: Record<Face, number> = {
      front: 0,
      right: Math.PI / 2,
      back: Math.PI,
      left: -Math.PI / 2,
    }

    interface UnitSpec {
      product: NonNullable<(typeof sorted)[number]['product']>
      tier: (typeof tiers)[number]
      face: Face
      sliceStart: number // local u where this item's slice begins
      sliceWidth: number
      packStart?: number // left edge after edge-to-edge packing
      unitW: number
      unitH: number
      unitD: number
      hasUnitDims: boolean
      facings: number
      rows: number
      layers: number
    }

    // Deal items bottom-up: chunk per tier, then round-robin across the
    // tier's faces so a full pallet fills all the way around.
    const faces: Face[] = isHalf ? ['front'] : ['front', 'right', 'back', 'left']
    const perTier = Math.ceil(sorted.length / tiers.length)
    const specs: UnitSpec[] = []

    tiers.forEach((tier, tierIndex) => {
      const group = sorted.slice(tierIndex * perTier, (tierIndex + 1) * perTier)
      if (group.length === 0) return

      // Split this tier's items across its faces. The rotation is offset by
      // tier so it does not restart at 'front' every level - otherwise a
      // three-items-per-tier assortment would never touch the fourth face.
      const byFace = new Map<Face, typeof group>()
      group.forEach((entry, index) => {
        const face = faces[(index + tierIndex) % faces.length]
        const list = byFace.get(face) ?? []
        list.push(entry)
        byFace.set(face, list)
      })

      byFace.forEach((faceItems, face) => {
        const alongWidth = face === 'front' || face === 'back'
        // Corners can only be claimed once. Front and back (the shopped
        // faces) get the full width; the side bands take the middle depth so
        // nothing double-books a corner and no shelf end sits empty.
        const span = isHalf
          ? tier.width - 2
          : alongWidth
            ? tier.width - 1
            : Math.max(tier.depth - tier.shelfDepth * 2 - 1, 8)
        const bandDepth = isHalf
          ? tier.depth - EDGE * 2
          : Math.max(tier.shelfDepth - 1, 4)
        const heightBudget = Math.max(tier.trayHeight - 0.6, 2)
        const sliceWidth = span / faceItems.length

        faceItems.forEach((entry, sliceIndex) => {
          const product = entry.product!
          const hasUnitDims =
            product.width > 0.2 && product.height > 0.2 && product.depth > 0.2
          let unitW = product.width
          let unitH = product.height
          let unitD = product.depth
          if (!hasUnitDims) {
            // No unit dimensions: the sealed case stands in as one "unit".
            const { dimensions } = buildPlacementShape(product, allProducts)
            unitW = dimensions.width
            unitH = dimensions.height
            unitD = dimensions.depth
          }

          const facings = hasUnitDims
            ? Math.max(1, Math.min(6, Math.floor((sliceWidth + GAP) / (unitW + GAP))))
            : 1
          const rows = hasUnitDims
            ? Math.max(
                1,
                Math.min(isHalf ? 3 : 2, Math.floor(bandDepth / (unitD + GAP))),
              )
            : 1
          const layers = hasUnitDims
            ? Math.max(1, Math.min(2, Math.floor(heightBudget / unitH)))
            : 1

          specs.push({
            product,
            tier,
            face,
            sliceStart: -span / 2 + sliceIndex * sliceWidth,
            sliceWidth,
            unitW,
            unitH,
            unitD,
            hasUnitDims,
            facings,
            rows,
            layers,
          })
        })
      })
    })

    // Pack each face-tier band edge to edge: hand out the leftover width as
    // extra facings (widest-gap first) so neighbouring items end up touching
    // instead of each floating in the middle of its own slice.
    const bands = new Map<string, UnitSpec[]>()
    specs.forEach((spec) => {
      const key = `${spec.tier.id}:${spec.face}`
      const list = bands.get(key) ?? []
      list.push(spec)
      bands.set(key, list)
    })
    bands.forEach((band) => {
      const span = band[0].sliceWidth * band.length
      const runWidth = () =>
        band.reduce(
          (sum, s) => sum + s.facings * s.unitW + (s.facings - 1) * GAP,
          0,
        ) +
        GAP * (band.length - 1)
      // Grow the item that would gain the most shelf presence, until the
      // next facing would not fit.
      for (let guard = 0; guard < 60; guard += 1) {
        const slack = span - runWidth()
        const candidates = band
          .filter((s) => s.hasUnitDims && s.facings < 8 && s.unitW + GAP <= slack)
          .sort((a, b) => a.facings * a.unitW - b.facings * b.unitW)
        if (candidates.length === 0) break
        candidates[0].facings += 1
      }
      // Pack contiguously, centering whatever run we ended up with.
      let cursor = -span / 2 + Math.max(0, (span - runWidth()) / 2)
      band.forEach((spec) => {
        const blockWidth = spec.facings * spec.unitW + (spec.facings - 1) * GAP
        spec.packStart = cursor
        cursor += blockWidth + GAP
      })
    })

    // Physics budget: trim depth first, then stacking, before ever cutting
    // an item's shelf presence entirely.
    const totalUnits = () =>
      specs.reduce((sum, s) => sum + s.facings * s.rows * s.layers, 0)
    if (totalUnits() > MAX_UNITS) specs.forEach((s) => (s.layers = 1))
    if (totalUnits() > MAX_UNITS) specs.forEach((s) => (s.rows = Math.min(s.rows, 1)))

    const placements: PlacedProduct[] = []
    specs.forEach((spec) => {
      const { product, tier, face } = spec
      const yaw = FACE_YAW[face]
      const quaternion: [number, number, number, number] = [
        0,
        Math.sin(yaw / 2),
        0,
        Math.cos(yaw / 2),
      ]
      const surfaceY = palletHeight + tier.yOffset + 1.05
      // Outer edge of this face's tray band, measured from pallet center.
      const outerEdge =
        face === 'front' || face === 'back' ? tier.depth / 2 : tier.width / 2
      const blockWidth = spec.facings * spec.unitW + (spec.facings - 1) * GAP
      const uBase =
        (spec.packStart ??
          spec.sliceStart + (spec.sliceWidth - blockWidth) / 2) +
        spec.unitW / 2

      const caseFallback = spec.hasUnitDims
        ? undefined
        : buildPlacementShape(product, allProducts).caseConfig

      for (let layer = 0; layer < spec.layers; layer += 1) {
        for (let row = 0; row < spec.rows; row += 1) {
          for (let facing = 0; facing < spec.facings; facing += 1) {
            const u = uBase + facing * (spec.unitW + GAP)
            const out = outerEdge - EDGE - spec.unitD / 2 - row * (spec.unitD + GAP)
            const x =
              face === 'front' || face === 'back'
                ? u
                : face === 'right'
                  ? out
                  : -out
            const z =
              face === 'front' ? out : face === 'back' ? -out : u
            placements.push({
              id: crypto.randomUUID(),
              sourceProductId: product.id,
              slotId: '',
              width: spec.unitW,
              height: spec.unitH,
              depth: spec.unitD,
              color: product.brandColor,
              label: product.name,
              sku: product.sku,
              category: product.category,
              imageUrl: product.imageUrl,
              modelUrl: product.modelUrl,
              packaging: product.packaging,
              caseConfig: caseFallback,
              quantity: 1,
              spawnAsleep: true,
              position: [x, surfaceY + layer * (spec.unitH + 0.02), z],
              quaternion,
            })
          }
        }
      }
    })

    const nextProject = {
      ...state.currentProject,
      placements,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },
})
