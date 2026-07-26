# Kayco Pallet Program (PalletForge)

## Overview
PalletForge is a single-tenant pallet program management app for **Kayco**. Salesmen, buyers, builders, and managers use it to plan, build, and track holiday pallet programs for retailers - from picking items and authorized assortments to setting deadlines, queuing builds, and rolling up demand.

Not to be confused with the older 3D pallet *display builder* that used to live in this folder. That work is gone. This is the operational tool around running the program.

## Tech Stack
- **Vite 6** + React 19 + TypeScript (strict)
- **React Router v7** (client-side routing, no SSR)
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Zustand + Immer** for state, persisted to `localStorage` in [src/App.tsx](src/App.tsx)
- **Three.js / @react-three/fiber / drei** for the 3D pallet preview in the Start-a-program wizard
- **xlsx + exceljs** for program template import/export
- **Lucide** icons, **Motion** for animation, **clsx + tailwind-merge** for class composition
- **@google/genai** (Gemini) for AI features - key in `.env.local` as `GEMINI_API_KEY`
- **Vitest + Testing Library** for tests
- **No auth.** Role picker only (`salesman | buyer | builder | manager`).
- **Shared-state backend on Cloudflare** (Worker + D1). localStorage remains the
  local cache/offline fallback; see "Shared state backend" below.

## Hosting
- **Primary: Cloudflare Workers** - `https://palletforge.shop-smarter.workers.dev`.
  One Worker ([worker/index.ts](worker/index.ts), config [wrangler.jsonc](wrangler.jsonc)) serves the
  built SPA (assets binding, SPA fallback) plus `/api/state` (shared state on D1) and `/api/kayco`
  (sales API proxy). Deploy: `npm run cf:deploy`. NOT auto-deployed on push - deploy explicitly.
- **Legacy: Vercel** (config in [vercel.json](vercel.json)) - still auto-deploys `main`; has the
  Kayco proxy but NO `/api/state`, so it runs localStorage-only. Retire once Cloudflare is the home.

## Repo
- **`origin`** -> `github.com/austinmaltman-source/kayco-pallet-program` - active repo, push here
- **`clondin`** -> `github.com/Clondin/Pallet-Program-New-` - read-only backup of the original work. Don't push.
- Safety tag `pre-clondin-replace` on origin points at the prior origin state.

## Run / Build / Deploy
```bash
# Dev (port 3003, host 0.0.0.0)
npm run dev

# Type-check (no emit)
npm run lint

# Tests
npm test          # one-shot
npm run test:watch

# Production build / preview
npm run build
npm run preview

# Deploy
git push origin main   # Vercel auto-deploys on push
```

## Domain quick reference
- **Roles:** `salesman | buyer | builder | manager`. One person can switch between them.
- **Pallet status workflow:** `draft -> ready -> in_build -> built` (no shipped).
- **Confirm-by deadline:** 4 months before the season's `holidayDate`, rounded back to the previous Friday. Use `computeConfirmByDate` from [src/lib/deadline.ts](src/lib/deadline.ts).
- **Default labor cost:** Full $75, Half $50 - globally editable via `app-settings-store` (`defaultLaborCostFull`, `defaultLaborCostHalf`).
- **Items shown as UPC + Kayco #** in the UI (with `Product.sku` as a fallback only). Don't surface SKU directly.
- **Season is the unit** (not Holiday). Don't add Holiday-tagged UI.

## Project Structure
```
src/
  App.tsx                  # Router + role/persistence wiring
  main.tsx                 # Vite entry
  pages/                   # Top-level routed pages
    role-homes/            # Role-specific homepages (salesman, buyer, builder, manager)
    manager-views/         # Manager-only saved views
  components/
    layout/                # AppLayout, sidebar shell
    Sidebar/               # Nav (consumes role-routes)
    StartProgramWizard/    # New program flow with 3D pallet preview
    PalletCreationWizard/  # Generic pallet creator (accepts pinnedRetailerId / allowedRetailerIds)
    Wizard/                # Shared wizard primitives
    Catalog/ Assortment/ Retailers/ PendingRequests/ PalletDisplay/ Branding/ Comments/ Deadline/ Status/ Toolbar/ Editor/
  stores/                  # zustand stores: app-settings, catalog, display, inventory, retailer, role, salesperson, season
  lib/
    role-routes.ts         # SINGLE source of truth for which roles can hit which routes
    deadline.ts            # confirm-by-Friday math
    program-rollup.ts      # cross-program aggregation
    program-template-xlsx.ts # Excel import/export
    csv.ts                 # buildCsv + downloadCsv helpers
    dimensionEngine.ts shelfCoordinates.ts spatialSystem.ts slot-utils.ts  # pallet geometry math
    product-variants.ts assortment-utils.ts walmart-authorized.ts          # SKU + retailer rules
    inventory-info-import.ts inventory-info-loader.ts                       # inventory ingestion
  hooks/ types/ test/      # custom hooks, shared types, test setup
public/                    # static assets
```

## Pages and role access
Source of truth: [src/lib/role-routes.ts](src/lib/role-routes.ts).

| Route                | Allowed roles                  |
|----------------------|--------------------------------|
| `/` (role home)      | all                            |
| `/retailers/*`       | all (scoped for salesman)      |
| `/catalog/*`         | buyer, builder, manager        |
| `/seasons`           | manager                        |
| `/builders` (queue)  | builder, manager               |
| `/demand`            | buyer, manager                 |
| `/transfers`         | manager                        |
| `/assignments`       | manager                        |
| `/pallets`           | buyer, manager                 |
| `/views/*`           | manager                        |

## Architecture conventions (don't drift)
- **Stores:** zustand, one per concept under [src/stores/](src/stores/). Persistence is wired in [src/App.tsx](src/App.tsx) (`loadPersistedState` -> `setX` on startup, `subscribe` -> `localStorage.setItem` for writes). Follow this pattern for any new store.
- **Role-route gating:** [src/lib/role-routes.ts](src/lib/role-routes.ts) is the single source of truth. Sidebar nav and AppLayout's redirect both consume it. Never duplicate role-permission logic elsewhere.
- **Context-switch redirects:** AppLayout watches role + pathname and redirects to `/` when the route isn't allowed for the current role. Apply the same rule to any new context (active salesperson, current pallet, etc.).
- **Season sort:** every season dropdown sorts via `compareSeasonsByHolidayDate` from [src/stores/season-store.ts](src/stores/season-store.ts) (by `holidayDate` asc, undated last). Don't sort by name.
- **Shared UI primitives** - reuse, don't reinvent:
  - [`<StatusPill>`](src/components/Status/status-pill.tsx) - pallet status badges
  - [`<DeadlineChip>`](src/components/Deadline/deadline-chip.tsx) - countdown chips
  - [`<CommentsThread>`](src/components/Comments/comments-thread.tsx) - role-tagged comments per pallet
- **CSV exports:** use [`buildCsv` + `downloadCsv`](src/lib/csv.ts).
- **Visual style:** white cards on `#fafafa`, black accent `#171717` for primary buttons, `text-[10px] uppercase tracking-wider` for label captions, `tabular-nums` on numeric cells. Don't redesign without an explicit ask.

## Environment
- `.env.local` (vite dev)
  - `GEMINI_API_KEY` - required for the Gemini-backed AI features
  - `KAYCO_API_KEY` - bearer key for the Kayco Sales Intelligence API (see below). Never commit it.
- `.dev.vars` (wrangler dev) - `KAYCO_API_KEY` again, for the local Worker. Gitignored.
- Cloudflare secrets: `KAYCO_API_KEY` (set via `wrangler secret put`).

## Shared state backend
The app's data (products, retailers, seasons, salespeople, inventory, pallets, app settings)
syncs through the Worker to **D1** (`palletforge`, table `app_state`: one JSON blob per store
key, last write wins). Client half: [src/lib/state-sync.ts](src/lib/state-sync.ts) + the hydration
wiring in [src/App.tsx](src/App.tsx).

- Startup: hydrate from `GET /api/state` (3.5s timeout), falling back to localStorage. Every
  store write mirrors to localStorage + a debounced `PUT /api/state/:key`.
- First-run import: keys missing on the server are seeded from the first browser that connects.
  An empty server value never beats non-empty local data (footgun guard in `readShared`).
- Tab refocus pulls server changes made elsewhere (`selectApplicableEntries` + apply).
- If `/api/state` is unreachable (vite dev without `npx wrangler dev`, Vercel, offline) the app
  silently runs localStorage-only, exactly like the pre-backend version.
- Local dev full stack: `npm run dev` + `npx wrangler dev` (vite proxies `/api/state` to :8787).
- D1 migrations live in [migrations/](migrations/); apply with
  `npx wrangler d1 migrations apply palletforge --local|--remote`.
- `DISABLE_HMR=true` in the shell disables Vite HMR (used in AI Studio to avoid agent-edit flicker)

## Kayco sales data integration
Per-item, per-customer sales shown in the program item picker come from the hosted
Kayco Sales Intelligence API (Cloudflare Worker; full reference incl. the key:
`../kayco-data-handoff.md` in the workspace root - that file is NOT in this repo).

- The client always calls **`/api/kayco/*`** - never the upstream URL directly:
  - Dev: Vite `server.proxy` in [vite.config.ts](vite.config.ts) injects `Authorization` from `.env.local`.
  - Prod: edge function [api/kayco/[...path].ts](api/kayco/[...path].ts) injects it from the
    Vercel env var `KAYCO_API_KEY` (set on Production + Preview). The key never reaches the bundle.
- Client lib: [src/lib/kayco-sales.ts](src/lib/kayco-sales.ts) (fetch + 12h localStorage cache +
  display-string parsing) and hook [src/hooks/useRetailerItemSales.ts](src/hooks/useRetailerItemSales.ts).
- Retailer -> customer mapping, two mechanisms (summed together, edited via
  [`<KaycoAccountsPanel>`](src/components/Retailers/kayco-accounts-panel.tsx) on the retailer
  Items tab or the "Sales accounts" modal in the program item picker):
  - `Retailer.kaycoAccountPatterns` - case-insensitive account-NAME prefixes; "COSTCO" auto-
    includes all 13 Costco DC accounts plus any future ones. Seeded in
    [src/lib/mock-data.ts](src/lib/mock-data.ts) for Walmart/Costco/ShopRite/Stop & Shop/Kroger
    and merged into persisted retailers that have no config (see `mergeRetailers` in App.tsx).
  - `Retailer.kaycoAccounts` (`{id, name}[]`) - explicit account links, for volume that ships
    under a different name (e.g. Meijer via KeHE distributor DCs).
- **Data gotchas (verified 2026-07-24):** use `/items/:id/accounts` for per-customer item sales -
  it reconciles against `/items/:id/accounts/:accountId/transactions`. Do NOT build on `/orders`:
  its order-line coverage is partial and `balance` is not line revenue. API item id = unpadded
  Kayco item number (`Product.kaycoItemNumber`).

## Tests
- `npm test` runs Vitest once; `npm run test:watch` for watch mode.
- Existing coverage lives next to the source (`*.test.ts(x)`) under [src/lib/](src/lib/), [src/stores/](src/stores/), [src/pages/](src/pages/). Add a test when changing risky math (deadlines, rollups, slot-utils, dimension engine) or import logic.

## See also
- [CLAUDE.md](CLAUDE.md) - working style + deeper domain notes for agents
