import { create } from 'zustand'
import {
  AssortmentEntry,
  DisplayProject,
  PlacedProduct,
  Product,
  CameraPreset,
  DisplayBranding,
  TrayFace,
  PalletType,
  PalletWizardConfig,
  Retailer,
  Role,
} from '../types'
import { getAppSettingsSnapshot } from './app-settings-store'
import { nextOrientation } from '../lib/orientation-presets'
import { useRetailerStore } from './retailer-store'
import { useCatalogStore } from './catalog-store'
import {
  resolveProductDimensions,
  calculateCaseDimensions,
} from '../lib/dimensionEngine'
import { buildTierConfigs } from '../lib/shelfCoordinates'
import { deriveCaseLayout } from '../lib/caseLayout'
import { computePlacementTransform } from '../lib/placementMigration'
import { cancelPendingSettle } from '../components/PalletDisplay/physics/settle'
import { isAllowedTransition } from '../lib/pallet-status'

interface DisplayState {
  projects: DisplayProject[]
  currentProject: DisplayProject | null
  selectedProductId: string | null
  activeFace: TrayFace
  cameraPreset: CameraPreset
  isPickerOpen: boolean
  pickerSelectedProduct: Product | null
  history: DisplayProject[]
  historyIndex: number
  lastUsedConfig: PalletWizardConfig | null
  // Physics sandbox interaction state (not persisted)
  carryPlacementId: string | null
  isDragging3D: boolean
  // Placement currently held by the cursor; its body renders kinematic so
  // React re-renders cannot flip it back to dynamic mid-drag.
  heldPlacementId: string | null
  // Set when an item settles on the floor and is returned to the catalog.
  offPalletNotice: { label: string; at: number } | null
  // Bumped when shelf geometry changes (tier count, pallet type) so the
  // physics scene wakes every body and items re-settle on the new shape.
  wakeToken: number

  setProjects: (projects: DisplayProject[]) => void
  createProject: (name: string, config: PalletWizardConfig, tierCount?: number) => DisplayProject
  deleteProject: (id: string) => void
  getActiveRetailer: () => Retailer | undefined
  getProject: (id: string) => DisplayProject | undefined
  getProjectsForRetailer: (retailerId: string) => DisplayProject[]
  selectProject: (id: string) => void
  setCurrentProject: (project: DisplayProject) => void
  // Spawn a free (physics) placement carried by the cursor until placed.
  spawnProduct: (product: Product) => string | undefined
  // Write physics-settled transforms back; clears slot fields on moved items.
  settlePlacements: (
    updates: {
      id: string
      position: [number, number, number]
      quaternion: [number, number, number, number]
    }[],
  ) => void
  // Clone a free placement just above the original so it falls and stacks.
  duplicatePlacement: (placementId: string) => void
  setCarryPlacement: (placementId: string | null) => void
  setDragging3D: (dragging: boolean) => void
  setHeldPlacement: (placementId: string | null) => void
  clearOffPalletNotice: () => void
  rotateProduct: (placementId: string) => void
  removeProduct: (placementId: string) => void
  selectProduct: (productId: string | null) => void
  setActiveFace: (face: TrayFace) => void
  setCameraPreset: (preset: CameraPreset) => void
  updateBranding: (branding: Partial<DisplayBranding>) => void
  updateLipColor: (color: string) => void
  updateTierCount: (count: number) => void
  setPalletType: (type: PalletType) => void
  updateName: (name: string) => void
  updateHoliday: (holiday: DisplayProject['holiday']) => void
  updateSeasonId: (seasonId: string | null) => void
  updateBuildLocation: (location: DisplayProject['buildLocation']) => void
  updateLaborCost: (cost: number | null) => void
  updateStatus: (status: DisplayProject['status']) => void
  updateStatusFor: (palletId: string, status: DisplayProject['status']) => void
  appendBuildLog: (palletId: string, entry: { date: string; built: number; note?: string }) => void
  removeBuildLogEntry: (palletId: string, index: number) => void
  setBuildLocationFor: (palletId: string, location: DisplayProject['buildLocation']) => void
  duplicateProject: (sourceId: string, overrides: { name: string; seasonId: string | null }) => DisplayProject | null
  addComment: (palletId: string, comment: { authorRole: Role; authorName?: string; text: string }) => void
  removeComment: (palletId: string, commentId: string) => void
  updateAssortment: (productId: string, cases: number) => void
  updateAssortmentForProject: (projectId: string, productId: string, cases: number) => void
  setAssortment: (assortment: AssortmentEntry[]) => void
  setSelectedProductIdsForProject: (projectId: string, productIds: string[]) => void
  mergeProgramAssortment: (
    plan: {
      projectId: string
      entries: { productId: string; cases: number }[]
    }[],
  ) => void
  updateShipByDate: (date: number | undefined) => void
  updateQuantity: (quantity: number) => void
  updateQuantityForProject: (projectId: string, quantity: number) => void
  populateFromAssortment: () => void
  openPicker: () => void
  closePicker: () => void
  setPickerProduct: (product: Product | null) => void
  resetEditorUi: () => void
  undo: () => void
  redo: () => void
}

function replaceProject(projects: DisplayProject[], nextProject: DisplayProject) {
  const existingIndex = projects.findIndex((project) => project.id === nextProject.id)
  if (existingIndex === -1) {
    return [...projects, nextProject]
  }

  return projects.map((project) =>
    project.id === nextProject.id ? nextProject : project
  )
}

function hydrateSelectionState() {
  const settings = getAppSettingsSnapshot()
  return {
    activeFace: settings.defaultFace,
    cameraPreset: settings.defaultCameraPreset,
  }
}

// Synthesize the physical shape a product takes on a pallet: its caseConfig
// (authored, or derived from unitsPerCase) and the resulting dimensions.
function buildPlacementShape(product: Product, allProducts: Product[]) {
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

// Stamp a slot-based placement with its world transform so the physics
// sandbox can spawn it as a rigid body. No-op for placements whose slot data
// cannot be resolved (their existing transform, if any, stays).
function withTransform(
  placement: PlacedProduct,
  project: DisplayProject,
): PlacedProduct {
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
function refreshSlotTransforms(project: DisplayProject): DisplayProject {
  return {
    ...project,
    placements: project.placements.map((placement) =>
      withTransform(placement, project),
    ),
  }
}

function commitProjectUpdate(state: DisplayState, nextProject: DisplayProject) {
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

export const useDisplayStore = create<DisplayState>((set, get) => ({
  projects: [],
  currentProject: null,
  selectedProductId: null,
  ...hydrateSelectionState(),
  isPickerOpen: false,
  pickerSelectedProduct: null,
  history: [],
  historyIndex: -1,
  lastUsedConfig: (() => {
    try {
      return JSON.parse(localStorage.getItem('lastUsedConfig') ?? 'null')
    } catch {
      localStorage.removeItem('lastUsedConfig')
      return null
    }
  })(),
  carryPlacementId: null,
  isDragging3D: false,
  heldPlacementId: null,
  offPalletNotice: null,
  wakeToken: 0,

  setProjects: (projects) => {
    const currentProject = projects[0] ?? null
    set({
      projects,
      currentProject,
      history: currentProject ? [structuredClone(currentProject)] : [],
      historyIndex: currentProject ? 0 : -1,
      ...hydrateSelectionState(),
    })
  },

  createProject: (name, config, tierCount = 4) => {
    const settings = getAppSettingsSnapshot()
    const project: DisplayProject = {
      id: crypto.randomUUID(),
      name,
      retailerId: config.retailerId,
      holiday: config.season,
      season: config.season,
      seasonId: config.seasonId ?? null,
      buildLocation: null,
      laborCost:
        config.palletType === 'half'
          ? settings.defaultLaborCostHalf
          : settings.defaultLaborCostFull,
      status: 'draft',
      tierCount,
      palletType: config.palletType,
      lipColor: settings.defaultLipColor,
      branding: {
        lipText: config.season === 'none' ? '' : 'ALL YOUR HOLIDAY NEEDS',
        lipTextColor: '#FFFFFF',
        headerText: '',
        headerTextColor: '#FFFFFF',
      },
      placements: [],
      assortment: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    localStorage.setItem('lastUsedConfig', JSON.stringify(config))

    set((state) => ({
      projects: [...state.projects, project],
      currentProject: project,
      lastUsedConfig: config,
      activeFace: settings.defaultFace,
      cameraPreset: settings.defaultCameraPreset,
      history: [structuredClone(project)],
      historyIndex: 0,
    }))

    return project
  },

  deleteProject: (id) => {
    cancelPendingSettle()
    set((state) => {
      const projects = state.projects.filter((project) => project.id !== id)
      const currentProject =
        state.currentProject?.id === id ? (projects[0] ?? null) : state.currentProject
      return {
        projects,
        currentProject,
        history: currentProject ? [structuredClone(currentProject)] : [],
        historyIndex: currentProject ? 0 : -1,
      }
    })
  },

  getActiveRetailer: () => {
    const project = get().currentProject
    if (!project) return undefined
    return useRetailerStore.getState().getRetailer(project.retailerId)
  },

  getProject: (id) => get().projects.find((project) => project.id === id),

  getProjectsForRetailer: (retailerId) =>
    get()
      .projects
      .filter((project) => project.retailerId === retailerId)
      .sort((a, b) => b.updatedAt - a.updatedAt),

  selectProject: (id) => {
    const project = get().projects.find((entry) => entry.id === id)
    if (!project) return
    cancelPendingSettle()

    set({
      currentProject: project,
      history: [structuredClone(project)],
      historyIndex: 0,
      selectedProductId: null,
      isPickerOpen: false,
      pickerSelectedProduct: null,
      ...hydrateSelectionState(),
    })
  },

  setCurrentProject: (project) => {
    cancelPendingSettle()
    set({
      currentProject: project,
      projects: replaceProject(get().projects, project),
      history: [structuredClone(project)],
      historyIndex: 0,
      selectedProductId: null,
      isPickerOpen: false,
      pickerSelectedProduct: null,
      ...hydrateSelectionState(),
    })
  },

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
        (placement) => placement.id !== placementId
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

  selectProduct: (productId) =>
    set({
      selectedProductId: productId,
      pickerSelectedProduct: null,
    }),

  setActiveFace: (face) =>
    set({
      activeFace: face,
      pickerSelectedProduct: null,
    }),

  setCameraPreset: (preset) => set({ cameraPreset: preset }),

  updateBranding: (branding) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      branding: { ...state.currentProject.branding, ...branding },
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateLipColor: (color) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      lipColor: color,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateTierCount: (count) => {
    const state = get()
    if (!state.currentProject) return

    const clamped = Math.min(6, Math.max(2, count))
    // Legacy slot placements above the new top tier are dropped; free
    // (physics) placements are kept - waking the scene lets anything left
    // hanging in the air fall and re-settle on the new shape.
    const validPlacements = state.currentProject.placements.filter((placement) => {
      const tierId = parseInt(placement.slotId.split('-')[0], 10)
      if (Number.isNaN(tierId)) return true
      return tierId <= clamped
    })

    const nextProject = refreshSlotTransforms({
      ...state.currentProject,
      tierCount: clamped,
      placements: validPlacements,
      updatedAt: Date.now(),
    })

    set({
      ...commitProjectUpdate(state, nextProject),
      wakeToken: state.wakeToken + 1,
    })
  },

  setPalletType: (type) => {
    const state = get()
    if (!state.currentProject) return

    // Legacy slot placements on walls a half pallet does not have are
    // dropped; free (physics) placements are kept - the woken scene dumps
    // anything the new shape cannot support and returns it to the catalog.
    const placements =
      type === 'half'
        ? state.currentProject.placements.filter((placement) => {
            const slotIndex = parseInt(placement.slotId.split('-')[1], 10)
            if (Number.isNaN(slotIndex)) return true
            return slotIndex < 1000
          })
        : state.currentProject.placements

    const nextProject = refreshSlotTransforms({
      ...state.currentProject,
      palletType: type,
      placements,
      updatedAt: Date.now(),
    })

    set({
      ...commitProjectUpdate(state, nextProject),
      activeFace: type === 'half' ? 'front' : state.activeFace,
      selectedProductId: null,
      wakeToken: state.wakeToken + 1,
    })
  },

  updateName: (name) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      name,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateHoliday: (holiday) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      holiday,
      season: holiday,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateSeasonId: (seasonId) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      seasonId,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateBuildLocation: (location) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      buildLocation: location,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateLaborCost: (cost) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      laborCost: cost,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateStatus: (status) => {
    const state = get()
    if (!state.currentProject) return
    if (
      status === state.currentProject.status ||
      !isAllowedTransition(state.currentProject.status, status)
    )
      return

    const nextProject = {
      ...state.currentProject,
      status,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateStatusFor: (palletId, status) => {
    const state = get()
    const target = state.projects.find((p) => p.id === palletId)
    if (!target) return
    if (status === target.status || !isAllowedTransition(target.status, status)) return

    const nextProject = {
      ...target,
      status,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  appendBuildLog: (palletId, entry) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== palletId) return project
        const buildLog = [...(project.buildLog ?? []), entry]
        return { ...project, buildLog, updatedAt: Date.now() }
      })
      const currentProject =
        state.currentProject?.id === palletId
          ? projects.find((p) => p.id === palletId) ?? state.currentProject
          : state.currentProject
      return { projects, currentProject }
    })
  },

  removeBuildLogEntry: (palletId, index) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== palletId) return project
        const buildLog = (project.buildLog ?? []).filter((_, i) => i !== index)
        return { ...project, buildLog, updatedAt: Date.now() }
      })
      const currentProject =
        state.currentProject?.id === palletId
          ? projects.find((p) => p.id === palletId) ?? state.currentProject
          : state.currentProject
      return { projects, currentProject }
    })
  },

  setBuildLocationFor: (palletId, location) => {
    set((state) => {
      const projects = state.projects.map((project) =>
        project.id === palletId
          ? { ...project, buildLocation: location, updatedAt: Date.now() }
          : project,
      )
      const currentProject =
        state.currentProject?.id === palletId
          ? projects.find((p) => p.id === palletId) ?? state.currentProject
          : state.currentProject
      return { projects, currentProject }
    })
  },

  duplicateProject: (sourceId, overrides) => {
    const state = get()
    const source = state.projects.find((p) => p.id === sourceId)
    if (!source) return null
    const now = Date.now()
    const clone: DisplayProject = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: overrides.name,
      seasonId: overrides.seasonId,
      status: 'draft',
      buildLog: [],
      buildLocation: null,
      comments: [],
      createdAt: now,
      updatedAt: now,
      placements: source.placements.map((placement) => ({
        ...placement,
        id: crypto.randomUUID(),
      })),
    }
    set((current) => ({
      projects: [...current.projects, clone],
    }))
    return clone
  },

  addComment: (palletId, comment) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== palletId) return project
        const next = {
          ...project,
          comments: [
            ...(project.comments ?? []),
            {
              id: crypto.randomUUID(),
              authorRole: comment.authorRole,
              authorName: comment.authorName,
              text: comment.text,
              createdAt: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        }
        return next
      })
      const currentProject =
        state.currentProject?.id === palletId
          ? projects.find((p) => p.id === palletId) ?? state.currentProject
          : state.currentProject
      return { projects, currentProject }
    })
  },

  removeComment: (palletId, commentId) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== palletId) return project
        return {
          ...project,
          comments: (project.comments ?? []).filter((c) => c.id !== commentId),
          updatedAt: Date.now(),
        }
      })
      const currentProject =
        state.currentProject?.id === palletId
          ? projects.find((p) => p.id === palletId) ?? state.currentProject
          : state.currentProject
      return { projects, currentProject }
    })
  },

  updateAssortment: (productId, cases) => {
    const state = get()
    if (!state.currentProject) return

    const existing = state.currentProject.assortment
    const nextAssortment =
      cases > 0
        ? existing.some((entry) => entry.productId === productId)
          ? existing.map((entry) =>
              entry.productId === productId ? { ...entry, cases } : entry
            )
          : [...existing, { productId, cases }]
        : existing.filter((entry) => entry.productId !== productId)

    const nextProject = {
      ...state.currentProject,
      assortment: nextAssortment,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateAssortmentForProject: (projectId, productId, cases) => {
    const state = get()
    const target = state.projects.find((p) => p.id === projectId)
    if (!target) return

    const existing = target.assortment
    const nextAssortment =
      cases > 0
        ? existing.some((entry) => entry.productId === productId)
          ? existing.map((entry) =>
              entry.productId === productId ? { ...entry, cases } : entry
            )
          : [...existing, { productId, cases }]
        : existing.filter((entry) => entry.productId !== productId)

    const nextProject = {
      ...target,
      assortment: nextAssortment,
      updatedAt: Date.now(),
    }

    if (state.currentProject?.id === projectId) {
      set(commitProjectUpdate(state, nextProject))
    } else {
      set({ projects: replaceProject(state.projects, nextProject) })
    }
  },

  setAssortment: (assortment) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      assortment,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  setSelectedProductIdsForProject: (projectId, productIds) => {
    const state = get()
    const target = state.projects.find((p) => p.id === projectId)
    if (!target) return

    const dedup = Array.from(new Set(productIds))
    const allowed = new Set(dedup)
    // Drop any cases for unpicked items so we don't carry phantom quantities.
    const nextAssortment = target.assortment.filter((entry) =>
      allowed.has(entry.productId),
    )
    const nextProject = {
      ...target,
      selectedProductIds: dedup,
      assortment: nextAssortment,
      updatedAt: Date.now(),
    }

    if (state.currentProject?.id === projectId) {
      set(commitProjectUpdate(state, nextProject))
    } else {
      set({ projects: replaceProject(state.projects, nextProject) })
    }
  },

  mergeProgramAssortment: (plan) => {
    const state = get()
    const now = Date.now()
    let nextProjects = state.projects
    let nextCurrent = state.currentProject
    for (const { projectId, entries } of plan) {
      const target = nextProjects.find((p) => p.id === projectId)
      if (!target) continue
      // Override cases for items in the plan; leave everything else alone.
      const overrideMap = new Map(entries.map((e) => [e.productId, e.cases]))
      const existingAssortment = target.assortment
      const updatedExisting = existingAssortment
        .map((entry) =>
          overrideMap.has(entry.productId)
            ? { ...entry, cases: overrideMap.get(entry.productId)! }
            : entry,
        )
        .filter((entry) => entry.cases > 0)
      const existingIds = new Set(existingAssortment.map((e) => e.productId))
      for (const e of entries) {
        if (!existingIds.has(e.productId) && e.cases > 0) {
          updatedExisting.push({ productId: e.productId, cases: e.cases })
        }
      }
      const existingPicks = target.selectedProductIds
        ? new Set(target.selectedProductIds)
        : new Set(existingAssortment.map((e) => e.productId))
      for (const e of entries) existingPicks.add(e.productId)
      const updated = {
        ...target,
        assortment: updatedExisting,
        selectedProductIds: Array.from(existingPicks),
        updatedAt: now,
      }
      nextProjects = replaceProject(nextProjects, updated)
      if (nextCurrent?.id === projectId) nextCurrent = updated
    }
    set({ projects: nextProjects, currentProject: nextCurrent })
  },

  updateShipByDate: (date) => {
    const state = get()
    if (!state.currentProject) return

    const nextProject = {
      ...state.currentProject,
      shipByDate: date,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateQuantity: (quantity) => {
    const state = get()
    if (!state.currentProject) return

    const next = Math.max(1, Math.floor(quantity))
    const nextProject = {
      ...state.currentProject,
      quantity: next,
      updatedAt: Date.now(),
    }

    set(commitProjectUpdate(state, nextProject))
  },

  updateQuantityForProject: (projectId, quantity) => {
    const state = get()
    const target = state.projects.find((p) => p.id === projectId)
    if (!target) return

    const next = Math.max(1, Math.floor(quantity))
    const nextProject = {
      ...target,
      quantity: next,
      updatedAt: Date.now(),
    }

    if (state.currentProject?.id === projectId) {
      set(commitProjectUpdate(state, nextProject))
    } else {
      set({ projects: replaceProject(state.projects, nextProject) })
    }
  },

  populateFromAssortment: () => {
    const state = get()
    if (!state.currentProject) return

    const assortment = state.currentProject.assortment ?? []
    const activeEntries = assortment.filter(e => e.cases > 0)
    if (activeEntries.length === 0) return

    const allProducts = useCatalogStore.getState().products
    const productMap = new Map(allProducts.map(p => [p.id, p]))

    // Sort by weight descending — heaviest first
    const sorted = [...activeEntries]
      .map(entry => ({ ...entry, product: productMap.get(entry.productId) }))
      .filter(entry => entry.product)
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

    const HEAVY_THRESHOLD = 1.5  // lbs - anything above goes on tier 1
    const LIGHT_THRESHOLD = 0.6  // lbs - anything below goes on top tier

    const heavy: typeof sorted = []
    const mid: typeof sorted = []
    const light: typeof sorted = []

    for (const entry of sorted) {
      const w = entry.product!.weight ?? 0
      if (w >= HEAVY_THRESHOLD) heavy.push(entry)
      else if (w <= LIGHT_THRESHOLD) light.push(entry)
      else mid.push(entry)
    }

    const assignments: Array<{ product: typeof sorted[0]['product'], tier: number }> = []

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

  openPicker: () => set({ isPickerOpen: true }),

  closePicker: () => set({ isPickerOpen: false }),

  setPickerProduct: (product) => set({ pickerSelectedProduct: product }),

  resetEditorUi: () =>
    set({
      selectedProductId: null,
      isPickerOpen: false,
      pickerSelectedProduct: null,
      carryPlacementId: null,
      isDragging3D: false,
    }),

  undo: () => {
    const { history, historyIndex, projects } = get()
    if (historyIndex <= 0) return
    cancelPendingSettle()

    const nextHistoryIndex = historyIndex - 1
    const nextProject = structuredClone(history[nextHistoryIndex])

    set({
      currentProject: nextProject,
      projects: replaceProject(projects, nextProject),
      historyIndex: nextHistoryIndex,
      selectedProductId: null,
    })
  },

  redo: () => {
    const { history, historyIndex, projects } = get()
    if (historyIndex >= history.length - 1) return
    cancelPendingSettle()

    const nextHistoryIndex = historyIndex + 1
    const nextProject = structuredClone(history[nextHistoryIndex])

    set({
      currentProject: nextProject,
      projects: replaceProject(projects, nextProject),
      historyIndex: nextHistoryIndex,
      selectedProductId: null,
    })
  },
}))
