import { create } from 'zustand'
import type { Role } from '../types'
import { safeSetItem } from '../lib/safe-storage'

const ROLE_STORAGE_KEY = 'palletforge-active-role'
const SALESPERSON_STORAGE_KEY = 'palletforge-active-salesperson-id'

const VALID_ROLES: Role[] = ['salesman', 'buyer', 'builder', 'manager']

function loadInitialRole(): Role {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY)
    if (stored && VALID_ROLES.includes(stored as Role)) return stored as Role
  } catch {
    // ignore
  }
  return 'manager'
}

function loadInitialSalespersonId(): string | null {
  try {
    return localStorage.getItem(SALESPERSON_STORAGE_KEY)
  } catch {
    return null
  }
}

interface RoleState {
  role: Role
  activeSalespersonId: string | null
  setRole: (role: Role) => void
  setActiveSalespersonId: (id: string | null) => void
}

export const useRoleStore = create<RoleState>((set) => ({
  role: loadInitialRole(),
  activeSalespersonId: loadInitialSalespersonId(),
  setRole: (role) => {
    try {
      safeSetItem(ROLE_STORAGE_KEY, role)
    } catch {
      // ignore
    }
    set({ role })
  },
  setActiveSalespersonId: (id) => {
    try {
      if (id) safeSetItem(SALESPERSON_STORAGE_KEY, id)
      else localStorage.removeItem(SALESPERSON_STORAGE_KEY)
    } catch {
      // ignore
    }
    set({ activeSalespersonId: id })
  },
}))

export const ROLE_LABELS: Record<Role, string> = {
  salesman: 'Salesman',
  buyer: 'Buyer',
  builder: 'Builder',
  manager: 'Manager',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  salesman: 'Build pallets for your retailers',
  buyer: 'Watch demand and swings across programs',
  builder: 'Pull cases and assemble pallets',
  manager: 'Coordinate the whole program',
}
