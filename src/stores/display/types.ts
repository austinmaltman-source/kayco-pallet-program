import type {
  AssortmentEntry,
  CameraPreset,
  DisplayBranding,
  DisplayProject,
  PalletType,
  PalletWizardConfig,
  PlacedProduct,
  Product,
  Retailer,
  Role,
  TrayFace,
} from '../../types'

// The display store is split into four concern-focused slices (see
// ./data-slice, ./editor-ui-slice, ./physics-slice, ./history-slice) that are
// composed into a single `useDisplayStore` in ../display-store.ts. They share
// one state object, so any slice can read or write any field — the split is
// organizational, not an isolation boundary.

// Pallet data + its lifecycle (create/select/delete/duplicate), metadata,
// assortment, comments, status, build log.
export interface DataSlice {
  projects: DisplayProject[]
  currentProject: DisplayProject | null
  lastUsedConfig: PalletWizardConfig | null

  setProjects: (projects: DisplayProject[]) => void
  createProject: (name: string, config: PalletWizardConfig, tierCount?: number) => DisplayProject
  deleteProject: (id: string) => void
  getActiveRetailer: () => Retailer | undefined
  getProject: (id: string) => DisplayProject | undefined
  getProjectsForRetailer: (retailerId: string) => DisplayProject[]
  selectProject: (id: string) => void
  setCurrentProject: (project: DisplayProject) => void
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
}

// Transient editor view state: what is selected/shown on the editor screen.
// None of this is persisted.
export interface EditorUiSlice {
  // Primary (last-clicked) selection — drives the single-item action pill and
  // every existing `=== selectedProductId` highlight check.
  selectedProductId: string | null
  // Full multi-selection set (always includes the primary). Shift/Cmd-click
  // toggles membership; group ops (delete/duplicate/nudge) act on this.
  selectedProductIds: string[]
  activeFace: TrayFace
  cameraPreset: CameraPreset
  isPickerOpen: boolean
  pickerSelectedProduct: Product | null

  // additive (shift/cmd-click) toggles the id in the set; a plain click on the
  // sole selection clears it, otherwise it becomes the single selection.
  selectProduct: (productId: string | null, additive?: boolean) => void
  setActiveFace: (face: TrayFace) => void
  setCameraPreset: (preset: CameraPreset) => void
  openPicker: () => void
  closePicker: () => void
  setPickerProduct: (product: Product | null) => void
  resetEditorUi: () => void
}

// Physics-sandbox interaction: transient drag/hold state plus the placement
// geometry manipulations driven by the 3D editor.
export interface PhysicsSlice {
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
  // Bumped to re-run the current camera preset animation (camera reset).
  cameraResetToken: number

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
  // Move a free placement by inches (keyboard nudge); clears slot fields.
  nudgePlacement: (placementId: string, delta: [number, number, number]) => void
  // Batch variants for multi-selection — each lands as ONE history entry so
  // undo reverses the whole group action, not item by item.
  removePlacements: (placementIds: string[]) => void
  duplicatePlacements: (placementIds: string[]) => void
  nudgePlacements: (placementIds: string[], delta: [number, number, number]) => void
  resetCamera: () => void
  setCarryPlacement: (placementId: string | null) => void
  setDragging3D: (dragging: boolean) => void
  setHeldPlacement: (placementId: string | null) => void
  clearOffPalletNotice: () => void
  rotateProduct: (placementId: string) => void
  removeProduct: (placementId: string) => void
  populateFromAssortment: () => void
}

// Undo/redo over the active project.
export interface HistorySlice {
  history: DisplayProject[]
  historyIndex: number

  undo: () => void
  redo: () => void
}

export type DisplayState = DataSlice & EditorUiSlice & PhysicsSlice & HistorySlice

// Shared shape used by physics-slice placement spawners.
export interface PlacementShape {
  dimensions: { width: number; height: number; depth: number }
  caseConfig: PlacedProduct['caseConfig']
}
