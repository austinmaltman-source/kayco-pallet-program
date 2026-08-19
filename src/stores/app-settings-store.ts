import { create } from 'zustand'
import { safeSetItem } from '../lib/safe-storage'
import type {
  Brand,
  CameraPreset,
  DisplayEnvironment,
  Holiday,
  PalletType,
  TrayFace,
  UnitSystem,
  ViewMode,
} from '../types'

const APP_SETTINGS_STORAGE_KEY = 'palletforge-app-settings'

export interface AppSettings {
  // General
  companyName: string
  defaultBrand: Brand | ''
  unitSystem: UnitSystem

  // Pallet Defaults
  defaultPalletType: PalletType
  defaultTierCount: number
  defaultHoliday: Holiday
  defaultLipColor: string

  // Editor
  defaultViewMode: ViewMode
  defaultFace: TrayFace
  defaultCameraPreset: CameraPreset
  editorGridColumns: number

  // 3D Viewer
  show3DSlotGrid: boolean
  show3DHeader: boolean
  displayEnvironment: DisplayEnvironment

  // Data
  autoSaveProject: boolean
  // 3D editor: fill an empty pallet from the program assortment on open.
  autoFill3DOnOpen: boolean

  // Builder - per-pallet costs, used for margin math
  defaultLaborCostFull: number
  defaultLaborCostHalf: number
  defaultCorrugateCostFull: number
  defaultCorrugateCostHalf: number
}

const DEFAULT_SETTINGS: AppSettings = {
  // General
  companyName: '',
  defaultBrand: '',
  unitSystem: 'imperial',

  // Pallet Defaults
  defaultPalletType: 'full',
  defaultTierCount: 4,
  defaultHoliday: 'none',
  defaultLipColor: '#1E3A8A',

  // Editor
  defaultViewMode: '2d',
  defaultFace: 'front',
  defaultCameraPreset: 'isometric',
  editorGridColumns: 6,

  // 3D Viewer
  show3DSlotGrid: true,
  show3DHeader: true,
  displayEnvironment: 'retail',

  // Data
  autoSaveProject: true,
  autoFill3DOnOpen: false,

  // Builder
  defaultLaborCostFull: 77.25,
  defaultLaborCostHalf: 64.37,
  defaultCorrugateCostFull: 126,
  defaultCorrugateCostHalf: 80,
}

function clampGridColumns(value: number) {
  return Math.min(8, Math.max(4, Math.round(value)))
}

function clampTierCount(value: number) {
  return Math.min(6, Math.max(2, Math.round(value)))
}

function sanitizeSettings(
  partial?: (Partial<AppSettings> & { defaultLaborCost?: number }) | null,
): AppSettings {
  // Migrate old single `defaultLaborCost` to the new pair if present.
  const legacyLabor =
    typeof partial?.defaultLaborCost === 'number' ? partial.defaultLaborCost : null
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    editorGridColumns: clampGridColumns(
      partial?.editorGridColumns ?? DEFAULT_SETTINGS.editorGridColumns
    ),
    defaultTierCount: clampTierCount(
      partial?.defaultTierCount ?? DEFAULT_SETTINGS.defaultTierCount
    ),
    defaultLaborCostFull:
      partial?.defaultLaborCostFull ??
      legacyLabor ??
      DEFAULT_SETTINGS.defaultLaborCostFull,
    defaultLaborCostHalf:
      partial?.defaultLaborCostHalf ??
      (legacyLabor != null ? Math.round(legacyLabor * (50 / 75)) : DEFAULT_SETTINGS.defaultLaborCostHalf),
    defaultCorrugateCostFull:
      partial?.defaultCorrugateCostFull ?? DEFAULT_SETTINGS.defaultCorrugateCostFull,
    defaultCorrugateCostHalf:
      partial?.defaultCorrugateCostHalf ?? DEFAULT_SETTINGS.defaultCorrugateCostHalf,
  }
}

function readPersistedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return sanitizeSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    localStorage.removeItem(APP_SETTINGS_STORAGE_KEY)
    return DEFAULT_SETTINGS
  }
}

function persistSettings(settings: AppSettings) {
  safeSetItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

interface AppSettingsState {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  resetSettings: () => void
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: readPersistedSettings(),
  updateSettings: (updates) =>
    set((state) => {
      const settings = sanitizeSettings({ ...state.settings, ...updates })
      persistSettings(settings)
      return { settings }
    }),
  resetSettings: () =>
    set(() => {
      persistSettings(DEFAULT_SETTINGS)
      return { settings: DEFAULT_SETTINGS }
    }),
}))

export function getAppSettingsSnapshot() {
  return useAppSettingsStore.getState().settings
}

export { APP_SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS }
