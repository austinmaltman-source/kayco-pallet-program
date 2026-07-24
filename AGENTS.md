# AGENTS.md

## Working style

- Act without asking. The user trusts the agent to run routine Bash commands, edit files, install dependencies, restart the dev server, run lint/builds, and create commits without confirmation prompts. Reverse mistakes after the fact rather than slowing the loop with permission asks.
- Only pause to confirm when there's a genuine security or destructive concern: unfamiliar third-party scripts, secrets/credentials, sending data externally, force-pushing or destructive shared-infra ops.
- Skip the "Want me to…" question — just do it and tell the user what changed.
- For multi-phase rebuilds, commit + push at each phase boundary. The user prefers small, reviewable commits.
- When the user describes a "fundamental" change, batch clarifying questions and confirm a phased plan before coding.

## Domain quick reference

PalletForge plans pallet programs for **Kayco**. Single-tenant, no auth — role picker only.

- **Roles:** `salesman | buyer | builder | manager`. One person can switch.
- **Pallet status workflow:** `draft → ready → in_build → built` (no shipped).
- **Confirm-by deadline:** 4 months before the season's `holidayDate`, rounded back to the previous Friday. Use `computeConfirmByDate` from [src/lib/deadline.ts](src/lib/deadline.ts).
- **Default labor:** Full $75, Half $50 — both globally editable in `app-settings-store` (`defaultLaborCostFull`, `defaultLaborCostHalf`).
- **Items shown in UI as UPC + Kayco #** (with `Product.sku` as fallback only). Don't surface SKU directly.
- **Holiday is deprecated.** Season is the unit. Don't add Holiday-tagged UI.

## Architecture conventions (don't drift)

- **Stores:** zustand, one per concept under [src/stores/](src/stores/). Persistence is wired in [src/App.tsx](src/App.tsx) (`loadPersistedState` → `setX` on startup, `subscribe` → `localStorage.setItem` for writes). Follow this pattern for any new store.
- **Role-route gating:** [src/lib/role-routes.ts](src/lib/role-routes.ts) is the **single source of truth**. The Sidebar nav and AppLayout's redirect both consume it. Never duplicate role-permission logic elsewhere — extend the rules array.
- **Context-switch redirects:** AppLayout watches role + pathname and redirects to `/` if the route isn't allowed for the current role. Apply this rule to any future context (active salesperson, current pallet, etc.) — never leave the user stranded on an invalid route after a switch.
- **Season sort:** every season dropdown sorts via [`compareSeasonsByHolidayDate`](src/stores/season-store.ts) (by `holidayDate` asc, undated last). Don't sort by name.
- **Shared UI primitives** — reuse, don't reinvent:
  - [`<StatusPill>`](src/components/Status/status-pill.tsx) — pallet status badges
  - [`<DeadlineChip>`](src/components/Deadline/deadline-chip.tsx) — countdown chips
  - [`<CommentsThread>`](src/components/Comments/comments-thread.tsx) — role-tagged comments per pallet
- **CSV exports:** use [`buildCsv` + `downloadCsv`](src/lib/csv.ts). Don't roll your own.
- **Visual style:** white cards on `#fafafa`, black accent `#171717` for primary buttons, `text-[10px] uppercase tracking-wider` for label captions, `tabular-nums` on numeric cells. Don't redesign without explicit ask.
- **Kayco sales data:** client code calls `/api/kayco/*` only - the key is injected by the Vite dev proxy ([vite.config.ts](vite.config.ts)) or the prod edge function ([api/kayco/[...path].ts](api/kayco/[...path].ts), Vercel env `KAYCO_API_KEY`). Per-customer item sales come from `/items/:id/accounts` summed over `Retailer.kaycoAccounts` (see [src/lib/kayco-sales.ts](src/lib/kayco-sales.ts)). Never build sales math on `/orders` - partial coverage, and `balance` is not line revenue. Details: PROJECT.md "Kayco sales data integration".

## Pallet creation wizard

[`<PalletCreationWizard>`](src/components/PalletCreationWizard/index.tsx) accepts:
- `pinnedRetailerId?: string` — locks the wizard to a single retailer (skips the retailer step).
- `allowedRetailerIds?: string[]` — filters the retailer step to a subset (used for salesman scoping).

When the active role is `salesman` and a salesperson is selected, pass `activeSalesperson.retailerIds` as `allowedRetailerIds` so the wizard only offers their retailers.

## Pages owned by which role

| Route | Allowed roles |
|---|---|
| `/` (Home) | all (renders role-specific home) |
| `/retailers/*` | all (filtered to salesperson's retailers when role=salesman) |
| `/catalog/*` | buyer, builder, manager |
| `/seasons` | manager |
| `/builders` (Build Queue) | builder, manager |
| `/demand` | buyer, manager |
| `/transfers` | manager |
| `/assignments` | manager |

Source of truth: [src/lib/role-routes.ts](src/lib/role-routes.ts).
