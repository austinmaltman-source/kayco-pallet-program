import type { StateCreator } from 'zustand'
import type { DisplayProject } from '../../types'
import { getAppSettingsSnapshot } from '../app-settings-store'
import { useRetailerStore } from '../retailer-store'
import { cancelPendingSettle } from '../../components/PalletDisplay/physics/settle'
import { isAllowedTransition } from '../../lib/pallet-status'
import type { DataSlice, DisplayState } from './types'
import {
  commitProjectUpdate,
  hydrateSelectionState,
  refreshSlotTransforms,
  replaceProject,
} from './helpers'

export const createDataSlice: StateCreator<DisplayState, [], [], DataSlice> = (
  set,
  get,
) => ({
  projects: [],
  currentProject: null,
  lastUsedConfig: (() => {
    try {
      return JSON.parse(localStorage.getItem('lastUsedConfig') ?? 'null')
    } catch {
      localStorage.removeItem('lastUsedConfig')
      return null
    }
  })(),

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
      .projects.filter((project) => project.retailerId === retailerId)
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
      selectedProductIds: [],
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
      selectedProductIds: [],
      isPickerOpen: false,
      pickerSelectedProduct: null,
      ...hydrateSelectionState(),
    })
  },

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
      selectedProductIds: [],
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
              entry.productId === productId ? { ...entry, cases } : entry,
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
              entry.productId === productId ? { ...entry, cases } : entry,
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
})
