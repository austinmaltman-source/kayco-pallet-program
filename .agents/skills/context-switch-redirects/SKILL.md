---
name: context-switch-redirects
description: Implement role/account/context switching in a multi-role app without leaving users stranded on routes their new context can't access. Use when adding role gating, account scoping, or any context switcher to a React Router app — gives a single-source-of-truth pattern that keeps the sidebar nav and the redirect guard in sync.
---

# Context-switch redirects

When an app has multiple personas, accounts, or contexts that the user can flip between in the sidebar, the most common bug is: the user switches context but stays on a URL their new context can't see. The page silently renders something stale, or — worse — exposes data the new context shouldn't have.

This skill captures the pattern PalletForge uses to make that bug impossible.

## The pattern

**One file owns the route-to-context mapping.** Both the navigation menu and the redirect guard read from it. They cannot drift.

### 1. Define the rules in one place

Create `src/lib/context-routes.ts` (or whatever fits the project):

```ts
import type { Role } from '../types'

interface RouteRule {
  match: (pathname: string) => boolean
  allowedRoles: Role[]
}

const ALL: Role[] = ['salesman', 'buyer', 'builder', 'manager']

export const ROUTE_RULES: RouteRule[] = [
  { match: (p) => p === '/', allowedRoles: ALL },
  { match: (p) => p.startsWith('/retailers'), allowedRoles: ALL },
  { match: (p) => p.startsWith('/catalog'), allowedRoles: ['buyer', 'builder', 'manager'] },
  { match: (p) => p === '/seasons', allowedRoles: ['manager'] },
  { match: (p) => p === '/builders', allowedRoles: ['builder', 'manager'] },
  // …
]

export function isRouteAllowedForRole(pathname: string, role: Role): boolean {
  for (const rule of ROUTE_RULES) {
    if (rule.match(pathname)) return rule.allowedRoles.includes(role)
  }
  return true  // unknown routes fall through; let the catch-all route handle them
}
```

### 2. Filter the sidebar nav with it

```tsx
const visibleNavItems = navItems.filter((item) => isRouteAllowedForRole(item.to, role))
```

Don't keep a parallel `roles?: Role[]` field on each nav item — that's the drift that causes bugs.

### 3. Guard the route with a useEffect at the layout level

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const role = useRoleStore((s) => s.role)

  useEffect(() => {
    if (!isRouteAllowedForRole(pathname, role)) {
      navigate('/', { replace: true })
    }
  }, [pathname, role, navigate])
  // …
}
```

This fires both when the user changes role *and* when they paste a forbidden URL. `replace: true` keeps the back button sane.

## Generalize beyond roles

The same pattern applies to any context the user can switch:

| Context | When the route becomes invalid |
|---|---|
| Active role | Route doesn't allow the new role |
| Active account / org | Route references resources from a different account |
| Active project / workspace | Route references resources from a different project |
| Active user (impersonation) | Pathname references the previous user's resources |

For each, watch the context value plus the pathname; if the current URL no longer makes sense, redirect to a sensible landing (`/` for role flips; the new context's home for account/project flips).

## When to invoke this skill

Trigger this guidance when:
- A user mentions building/extending a multi-role or multi-account app.
- A user reports "I switch roles and the page stays on something I shouldn't see" or similar.
- You're adding a sidebar role/account picker to a React Router app.
- You're editing a `useRoleStore` / `useAccountStore` / `useWorkspaceStore` and there's no central route rules file.

## What NOT to do

- Don't gate routes by checking the role inside individual page components — that's repetition that drifts.
- Don't only hide nav links and assume the user won't reach the route — they will, via back button, bookmarks, or external links.
- Don't redirect inside the component itself; do it at the layout level so it runs for every route.
- Don't forget to update the rules file when adding a new route — make it the diff that's harder to skip than the new page itself.

## Reference implementation

See:
- [src/lib/role-routes.ts](../../../src/lib/role-routes.ts) — rules + `isRouteAllowedForRole`
- [src/components/layout/app-layout.tsx](../../../src/components/layout/app-layout.tsx) — the redirect guard
- [src/components/Sidebar/sidebar.tsx](../../../src/components/Sidebar/sidebar.tsx) — nav filter

User feedback that motivated this pattern: "the most annoying bug — switching from Manager to Salesman while on `/builders` left me on a page my new role couldn't access."
