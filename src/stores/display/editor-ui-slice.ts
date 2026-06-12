import type { StateCreator } from 'zustand'
import type { DisplayState, EditorUiSlice } from './types'
import { hydrateSelectionState } from './helpers'

export const createEditorUiSlice: StateCreator<
  DisplayState,
  [],
  [],
  EditorUiSlice
> = (set) => ({
  selectedProductId: null,
  ...hydrateSelectionState(),
  isPickerOpen: false,
  pickerSelectedProduct: null,

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
})
