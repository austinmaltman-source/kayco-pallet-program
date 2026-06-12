import { create } from 'zustand'
import type { DisplayState } from './display/types'
import { createDataSlice } from './display/data-slice'
import { createEditorUiSlice } from './display/editor-ui-slice'
import { createPhysicsSlice } from './display/physics-slice'
import { createHistorySlice } from './display/history-slice'

// One store composed from four concern-focused slices (see src/stores/display/).
// The split is organizational — every slice shares this single state object,
// so existing `useDisplayStore(selector)` call sites are unaffected.
export const useDisplayStore = create<DisplayState>()((...a) => ({
  ...createDataSlice(...a),
  ...createEditorUiSlice(...a),
  ...createPhysicsSlice(...a),
  ...createHistorySlice(...a),
}))

export type { DisplayState }
