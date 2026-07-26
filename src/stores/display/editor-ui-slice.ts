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
  selectedProductIds: [],
  ...hydrateSelectionState(),
  isPickerOpen: false,
  pickerSelectedProduct: null,

  selectProduct: (productId, additive = false) =>
    set((state) => {
      if (productId === null) {
        return {
          selectedProductId: null,
          selectedProductIds: [],
          pickerSelectedProduct: null,
        }
      }
      if (additive) {
        const has = state.selectedProductIds.includes(productId)
        const ids = has
          ? state.selectedProductIds.filter((id) => id !== productId)
          : [...state.selectedProductIds, productId]
        return {
          selectedProductIds: ids,
          // Primary follows the just-clicked item; when removing, fall back to
          // whatever remains (or nothing).
          selectedProductId: has ? ids[ids.length - 1] ?? null : productId,
          pickerSelectedProduct: null,
        }
      }
      // Plain click: deselect if it's already the sole selection, else select
      // just this one.
      const isSole =
        state.selectedProductId === productId && state.selectedProductIds.length <= 1
      return isSole
        ? { selectedProductId: null, selectedProductIds: [], pickerSelectedProduct: null }
        : {
            selectedProductId: productId,
            selectedProductIds: [productId],
            pickerSelectedProduct: null,
          }
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
      selectedProductIds: [],
      isPickerOpen: false,
      pickerSelectedProduct: null,
      carryPlacementId: null,
      isDragging3D: false,
    }),
})
