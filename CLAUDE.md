# CLAUDE.md

## Working style

- Act without asking. The user trusts the agent to run routine Bash commands, edit files, install dependencies, restart the dev server, run lint/builds, and create commits without confirmation prompts. Reverse mistakes after the fact rather than slowing the loop with permission asks.
- Only pause to confirm when there's a genuine security or destructive concern: unfamiliar third-party scripts, secrets/credentials, sending data externally, force-pushing or destructive shared-infra ops.
- Skip the "Want me to…" question — just do it and tell the user what changed.
- For multi-phase rebuilds, commit + push at each phase boundary. The user prefers small, reviewable commits.
- When the user describes a "fundamental" change, batch clarifying questions and confirm a phased plan before coding.

## Domain quick reference

**Kayco Pallet Programs** (frontend `kayco-pallet-programs.pages.dev`, backend Worker `kayco-pallet-programs-api`) plans pallet programs for Kayco. Single-tenant, no auth — role picker only.
Data is shared via the Cloudflare Worker backend (`/api/state` on D1, last-write-wins per store key);
localStorage is the cache/offline fallback. See PROJECT.md "Shared state backend".

- **Roles:** `salesman | buyer | builder | manager`. One person can switch.
- **Pallet status workflow:** `draft → ready → in_build → built` (no shipped).
- **Confirm-by deadline:** 4 months before the season's `holidayDate`, rounded back to the previous Friday. Use `computeConfirmByDate` from [src/lib/deadline.ts](src/lib/deadline.ts).
- **Default labor:** Full $77.25, Half $64.37 — globally editable in `app-settings-store` (`defaultLaborCostFull`, `defaultLaborCostHalf`).
- **Default corrugate:** Full $126, Half $80 — globally editable in `app-settings-store` (`defaultCorrugateCostFull`, `defaultCorrugateCostHalf`). Added to labor as a per-pallet cost in margin math.
- **Items shown in UI as UPC + Kayco #** (with `Product.sku` as fallback only). Don't surface SKU directly.
- **Holiday is deprecated.** Season is the unit. Don't add Holiday-tagged UI.

## Architecture conventions (don't drift)

- **No early returns above hooks.** Stores hydrate a tick after first render on a hard page load, so a "not found" guard above a `useMemo`/`useEffect` crashes React with a hook-order error the moment data arrives. Guards go after the last hook. (Bit us twice: retailers-page, program-rollup-page.)
- **Stores:** zustand, one per concept under [src/stores/](src/stores/). Persistence is wired in [src/App.tsx](src/App.tsx) (`loadPersistedState` → `setX` on startup, `subscribe` → `localStorage.setItem` for writes). Follow this pattern for any new store. The display store is the exception: it's split into concern slices under [src/stores/display/](src/stores/display/) (`data`, `editor-ui`, `physics`, `history`) composed into one `useDisplayStore` in [display-store.ts](src/stores/display-store.ts). One shared state object — slices are organizational, so a new action goes in the slice that owns its concern; shared mutation helpers (`commitProjectUpdate`, `withTransform`, …) live in [display/helpers.ts](src/stores/display/helpers.ts).
- **Role-route gating:** [src/lib/role-routes.ts](src/lib/role-routes.ts) is the **single source of truth**. The Sidebar nav and AppLayout's redirect both consume it. Never duplicate role-permission logic elsewhere — extend the rules array. Action-level permissions (authorize items, delete a retailer, create a season) live in the same file as `canRoleDo(role, action)` — extend `ACTION_RULES`, don't write inline `role === 'manager'` checks for mutations.
- **Deletes cascade:** deleting a product or retailer goes through [src/lib/cascade-delete.ts](src/lib/cascade-delete.ts) (`cascadeDeleteProduct` / `cascadeDeleteRetailer`), which synchronously prunes placements, assortments, authorizations, pallets, and salesperson assignments. Never call the stores' `deleteProduct`/`deleteRetailer` directly from UI.
- **Status transitions:** pallet status moves are forward-any / one-step-back, enforced in `updateStatus`/`updateStatusFor` via [src/lib/pallet-status.ts](src/lib/pallet-status.ts). UI confirms backward moves and past-deadline pushes; don't bypass the store guard.
- **Context-switch redirects:** AppLayout watches role + pathname and redirects to `/` if the route isn't allowed for the current role. Apply this rule to any future context (active salesperson, current pallet, etc.) — never leave the user stranded on an invalid route after a switch.
- **Season sort:** every season dropdown sorts via [`compareSeasonsByHolidayDate`](src/stores/season-store.ts) (by `holidayDate` asc, undated last). Don't sort by name.
- **Shared UI primitives** — reuse, don't reinvent:
  - [`<StatusPill>`](src/components/Status/status-pill.tsx) — pallet status badges
  - [`<DeadlineChip>`](src/components/Deadline/deadline-chip.tsx) — countdown chips
  - [`<CommentsThread>`](src/components/Comments/comments-thread.tsx) — role-tagged comments per pallet
- **CSV exports:** use [`buildCsv` + `downloadCsv`](src/lib/csv.ts). Don't roll your own.
- **Visual style:** white cards on `#fafafa`, black accent `#171717` for primary buttons, `text-[10px] uppercase tracking-wider` for label captions, `tabular-nums` on numeric cells. Don't redesign without explicit ask.
- **State sync:** never write a new store's data to localStorage only — mirror it through
  [src/lib/state-sync.ts](src/lib/state-sync.ts) (`schedulePush` in the subscription, hydrate via `readShared`
  in App.tsx, add the key to `SYNCED_KEYS` **and** the Worker's `STATE_KEYS` allowlist in worker/index.ts).
- **Kayco sales data:** client code calls `/api/kayco/*` only - the key is injected by the Vite dev proxy ([vite.config.ts](vite.config.ts)) or the prod edge function ([api/kayco/[...path].ts](api/kayco/[...path].ts), Vercel env `KAYCO_API_KEY`). Per-customer item sales come from `/items/:id/accounts` summed over `Retailer.kaycoAccountPatterns` (account-name prefixes, e.g. 'COSTCO' = every Costco DC) plus explicit `Retailer.kaycoAccounts` links (see [src/lib/kayco-sales.ts](src/lib/kayco-sales.ts)). Never build sales math on `/orders` - partial coverage, and `balance` is not line revenue. Details: PROJECT.md "Kayco sales data integration".

## Editor: 2D planogram + 3D physics (same placements, two views)

`/…/editor?view=2d` renders [`<PlanogramView>`](src/components/Editor/planogram-view.tsx),
a flat Spaceman-style elevation of one face; `?view=3d` renders the physics sandbox. Both edit
the SAME `PlacedProduct[]` — 2D is a projection, not a separate model. The switch lives in
[editor-page.tsx](src/pages/editor-page.tsx) and both views share `<PalletNavigator>` for face
selection.

- **Which face an item is on** = the edge it sits closest to (`faceOf` in planogram-view).
  Never classify by raw axis dominance: the far end of the front row has a large x and gets
  misfiled to the side, hiding it from the front elevation.
- 2D drags move items in the face plane and snap the released item to the nearest shelf
  surface; the batch lands as one `movePlacements` commit so undo reverses the whole move.

### 3D physics sandbox
([src/components/PalletDisplay/physics/](src/components/PalletDisplay/physics/)):

- **World units are inches**, gravity is `-386 in/s2` (`SandboxPhysics.tsx`). Y-up, origin at pallet center.
- **Source of truth:** `PlacedProduct.position` (bottom-center anchor) + `quaternion`, plain JSON in `display-store`. Never persist physics engine state. Legacy slot fields (`slotId`, `wall`, `tier`, `gridCol`) exist only so [placementMigration.ts](src/lib/placementMigration.ts) can convert old localStorage data on load.
- **Settle write-back:** bodies report transforms on sleep (`settle.ts`, debounced) -> `settlePlacements`. Rapier's sleep thresholds assume meters, so `DragManager` force-sleeps quiet bodies and clamps bystander velocity - don't remove the watchdog. Any store action that replaces the active placement set (undo/redo, project select/switch/delete) must call `cancelPendingSettle()` first or a stale settle wave clobbers the new state.
- **Held items** are kinematic via the `heldPlacementId` store field driving the RigidBody `type` prop. Never set body type only imperatively; a React re-render will revert it.
- **Suspense:** every item's visuals load inside the per-item boundary in `ItemBody`. Don't add a scene-wide Suspense that can remount rigid bodies.
- **Fit is physical:** colliders (deck, shelves, lips, max-height ceiling) enforce volume; items settling on the floor are returned to the catalog. The only advisory check is the total-weight HUD chip (`resolvePlacementWeight`).
- **Cases:** products with `unitsPerCase > 1` get a synthesized `caseConfig` (`buildPlacementShape` in display-store, `deriveCaseLayout`); units render via `CaseItemGrid` (GLB) or `PrimitiveCaseItemGrid` (no GLB). A case is one rigid body.
- When shelf geometry changes (tier count, pallet type), bump `wakeToken` so bodies wake and re-settle.
- **The pallet shows ITEM measurements, never case dims.** `populateFromAssortment` unpacks each
  program item into individual units (one rigid body per bottle/box) packed edge to edge, and a
  full pallet wraps all four faces (front/back take the full width, the side bands take the
  middle depth, so no corner is double-booked). Case dims are the fallback ONLY when a product
  has no usable unit dimensions. Same rule in `spawnProduct`.
- **Selection is a set:** `selectedProductIds` holds the multi-selection; `selectedProductId` is
  the primary/last-clicked and drives the action pill. `selectProduct(id, mode)` takes a
  `SelectMode`: `'single'` (plain click), `'toggle'` (cmd/ctrl — one unit in/out), `'same-product'`
  (shift — every placement of that product, the Spaceman "select all facings" gesture). Group ops
  use the batch store actions (`removePlacements`/`duplicatePlacements`/`nudgePlacements`/
  `movePlacements`) so each lands as one undo entry. Keep `selectedProductIds` consistent anywhere
  you reset `selectedProductId`.
- **Dragging is a horizontal slide, not a raycast onto whatever is under the cursor.** A grab
  records `planeY` (the pick-up height) and the item slides on that level plane; Shift-drag (or
  the touch Vertical toggle) changes height and updates `planeY`. Raycasting the scene instead
  makes items climb every shelf edge and neighbour they pass over, which is what made placement
  feel unpredictable. The fallback raycast filters on `userData.isItem` so a held item never
  perches on top of other product.
- **Bystanders are pinned during a drag.** While `isDragging3D`, every non-held body renders
  `type="fixed"` (see `isPinned` in ItemBody). Merchandised shelves are packed touching, so
  without this, moving one bottle shoves its neighbours off the shelf. Dragging a member of the
  multi-selection carries the whole set via `heldGroupIds`.
- **Never pass a fresh object literal as a RigidBody prop** (`userData={{…}}`). It churns the
  body and re-applies its `position` prop, which silently snaps dragged items back to where they
  started. Use a module-level constant. Cost me an afternoon.
- **ItemBody's teleport effect compares the store against the LAST APPLIED store value**, not
  against the live body pose. Comparing to the body re-teleports an item every time physics (or
  the user's hand) moves it away from a store value that has not been written back yet.
- **Auto-filled units carry `spawnAsleep`** so they spawn resting instead of waking hundreds of
  touching bodies in one frame. Keep the fill's `EDGE` inset clear of the retaining-lip collider
  (`SHELF_LIP_HEIGHT` in FixedColliders) or the first settle tick shoves the outer row off.
- **Editor input:** keyboard (arrows nudge, `D` duplicate, `Delete` remove, `C` camera reset, `R`/wheel rotate held, Shift-drag vertical) lives in `DragManager`; the click modifier for additive select is captured at pointer-down (`wasAdditiveClick`). Touch has no Shift/wheel, so the held-item HUD buttons in [three-d-viewer.tsx](src/components/Editor/three-d-viewer.tsx) route through the store via `verticalDragMode` (a flag DragManager reads each frame) and `heldRotateToken` (a counter DragManager watches). Camera reset re-runs the preset animation via `cameraResetToken`.

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
