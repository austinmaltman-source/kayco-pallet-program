import type { StateCreator } from 'zustand'
import { cancelPendingSettle } from '../../components/PalletDisplay/physics/settle'
import type { DisplayState, HistorySlice } from './types'
import { replaceProject } from './helpers'

export const createHistorySlice: StateCreator<
  DisplayState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  history: [],
  historyIndex: -1,

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
})
