import type { Role } from '../types'

interface RouteRule {
  match: (pathname: string) => boolean
  allowedRoles: Role[]
}

const ALL: Role[] = ['salesman', 'buyer', 'builder', 'manager']

export const ROUTE_RULES: RouteRule[] = [
  { match: (p) => p === '/', allowedRoles: ALL },
  { match: (p) => p === '/retailers' || p.startsWith('/retailers/'), allowedRoles: ALL },
  // catalog: salesman doesn't get the master catalog browser
  {
    match: (p) => p === '/catalog' || p.startsWith('/catalog/'),
    allowedRoles: ['buyer', 'builder', 'manager'],
  },
  { match: (p) => p === '/seasons', allowedRoles: ['manager'] },
  { match: (p) => p === '/builders', allowedRoles: ['builder', 'manager'] },
  { match: (p) => p === '/demand', allowedRoles: ['buyer', 'manager'] },
  { match: (p) => p === '/transfers', allowedRoles: ['manager'] },
  { match: (p) => p === '/assignments', allowedRoles: ['manager'] },
  { match: (p) => p === '/pallets', allowedRoles: ['buyer', 'manager'] },
  { match: (p) => p.startsWith('/views/'), allowedRoles: ['manager'] },
]

// Action-level permissions. UI copy may still branch on role for wording,
// but anything that gates a mutation belongs here so route and action rules
// live in one place.
const ACTION_RULES = {
  createSeason: ['manager'],
  // Managers authorize items directly; everyone else files a pending request.
  authorizeItems: ['manager'],
  deleteRetailer: ['manager'],
  toggleRetailerStatus: ['manager'],
} satisfies Record<string, Role[]>

export type RoleAction = keyof typeof ACTION_RULES

export function canRoleDo(role: Role | null, action: RoleAction): boolean {
  if (!role) return false
  return (ACTION_RULES[action] as readonly Role[]).includes(role)
}

export function isRouteAllowedForRole(pathname: string, role: Role): boolean {
  // The pallet detail/editor are nested under /retailers/* so they're already covered.
  for (const rule of ROUTE_RULES) {
    if (rule.match(pathname)) return rule.allowedRoles.includes(role)
  }
  // Unknown routes fall through as allowed; HomeRedirect handles unknown via /
  return true
}
