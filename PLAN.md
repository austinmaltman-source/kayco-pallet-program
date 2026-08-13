# PLAN.md — Spaceman-grade Pallet Builder

> **Goal:** make PalletForge a true 3D pallet planner — drop real Kayco cases onto a real pallet, with real dimensions, weights, orientation rules, collision detection, retailer-spec compliance, and auto-pack. NIQ Spaceman, but for club-store / Walmart pallet displays.
>
> **Audience:** Codex. Phases ship independently. Commit + push at every phase boundary. No phase touches the next phase's files.
>
> **What already exists** (do NOT rebuild):
> - `three`, `@react-three/fiber`, `@react-three/drei` are installed.
> - Full 3D tree under [src/components/PalletDisplay/](src/components/PalletDisplay/): `Pallet`, `Tier`, `PlacedProducts`, `GhostProduct`, `SlotIndicator`, `ShelfLip`, `HeaderTopper`, plus materials (wood, cardboard, slot) and product renderers (`CaseShell`, `TexturedBoxProduct`, `BasicBoxProduct`, `GlbProductModel`, `MerchBlockRenderer`).
> - `Product` schema with `width / height / depth / weight / unitsPerCase / packaging / caseConfig` in [src/types/index.ts](src/types/index.ts).
> - `PlacedProduct` with slot-grid placement (`tier`, `gridCol`, `colSpan`, `orientation` index into `ORIENTATION_PRESETS`).
> - Validation w/ suggestions (`FullValidationResult`, `PlacementSuggestion`).
> - `ORIENTATION_PRESETS` (0-5 rotations).
> - Display store with placement actions in [src/stores/display-store.ts](src/stores/display-store.ts).
> - Camera presets, environments, hover effects, ghost preview.
>
> **Reference research:** see chat transcript "NIQ Spaceman Research Report — for PalletForge" (2026-05-21). Key citations: binpackingjs (https://github.com/olragon/binpackingjs), 3D-bin-packing reference design (https://github.com/jerry800416/3D-bin-packing), EasyCargo UX (https://www.easycargo3d.com/en/3d-pallet-loading-calculator/), Extreme-Point paper (Crainic/Perboli/Tadei 2008), Costco/Sam's/BJ's pallet specs.

---

## Phase 1 — Data model upgrade (Spaceman-grade product + pallet attributes)

**Why this first:** every later phase (placement validation, auto-pack, rules engine, KPIs) reads from the data model. Lock it down before writing math.

### Files
- [src/types/index.ts](src/types/index.ts) — extend `Product`, `PlacedProduct`, add `PalletSpec`, `PalletKPIs`, `OrientationRule`, `StackRule`.
- [src/lib/retailer-specs.ts](src/lib/retailer-specs.ts) — **NEW**. Hard-coded specs per retailer (Costco 48x40, no-overhang, 58" max in-store / 52" double-stack, 2500 lb, primary face 48"; Sam's 60" / 52", 2100 lb; BJ's primary face 40", 2500 lb, CHEP/PECO/iGPS only; Walmart same as Sam's).
- [src/stores/product-store.ts](src/stores/product-store.ts) — migration shim: any product missing new fields gets sensible defaults (stackable: true, fragile: false, allowedOrientations: all, maxStackLoadLb: weight × 10).
- [src/lib/excel-template.ts](src/lib/excel-template.ts) — XLSX import/export columns for new fields. Backwards compatible — missing columns = defaults.

### Schema additions

Add to `Product`:
```ts
// Stacking & orientation
allowedOrientations: Array<'upright' | 'on-side' | 'on-end' | 'inverted'> // default ['upright']
stackable: boolean              // can anything sit on top of this case
fragile: boolean                // warn if anything stacks on it
crushable: boolean              // hard-block if anything stacks on it
maxStackLoadLb?: number         // load this case can bear from above
nestingPercent?: number         // 0-100, how much identical cases nest into each other
// Case vs single unit (single = optional)
caseWidth?: number              // when omitted, width/depth/height ARE the case
caseDepth?: number
caseHeight?: number
caseWeight?: number
// Display
shelfReadyTray: boolean         // tray-style case (open top, retail-ready)
heroImageUrl?: string           // packshot used for texture mapping
```

Add new types:
```ts
export interface PalletSpec {
  id: 'gma-48x40' | 'half-48x20' | 'quarter-24x20' | 'custom'
  widthIn: number
  depthIn: number
  baseHeightIn: number          // pallet thickness (~6")
  maxLoadLb: number
  maxHeightIn: number           // includes pallet
  noOverhang: boolean
  underhangMaxIn: number
  primaryFaceIn: 40 | 48        // which face is shoppable
  retailerPreset?: 'costco' | 'sams' | 'walmart' | 'bjs'
}

export interface PalletKPIs {
  cubeUtilizationPct: number
  weightUtilizationPct: number
  footprintUtilizationPct: number  // per-tier average
  totalCases: number
  totalUnits: number
  totalWeightLb: number
  heightUsedIn: number
  warnings: PalletWarning[]
}

export type PalletWarning =
  | { kind: 'overweight'; tier: number; lb: number; maxLb: number }
  | { kind: 'overhang'; placementId: string; overhangIn: number }
  | { kind: 'overheight'; usedIn: number; maxIn: number }
  | { kind: 'crush'; placementId: string; loadAboveLb: number; maxLoadLb: number }
  | { kind: 'unsupported'; placementId: string; supportPct: number }
  | { kind: 'fragile-under-heavy'; placementId: string }
```

Extend `PlacedProduct` to support **free-form** placement in addition to slot-grid:
```ts
// Free-form (added — coexists with slot-grid)
position?: { x: number; y: number; z: number }   // inches, origin = pallet front-left bottom
rotationDeg?: number                              // 0 / 90 / 180 / 270 around Y
orientation3D?: 'upright' | 'on-side' | 'on-end' | 'inverted'
caseStackHeight?: number                          // for auto-stacked column (N cases tall)
```

### Acceptance criteria
- `npm run build` passes with strict TS.
- Existing pallets render unchanged (defaults preserved).
- XLSX template round-trip preserves all new fields.
- `getRetailerSpec('costco')` returns the documented spec.

### Commit
`feat(data): Spaceman-grade product + pallet schema (orientations, stack rules, retailer specs)`

---

## Phase 2 — Free-form 3D placement with real collision + stability

**Why:** slot-grid is good for novice mode but limits 1-up Spaceman-style precision. Add a "Precision" mode that places cases at arbitrary `(x, z)` on a tier with AABB collision detection and support-surface checks. Keep slot-grid as the default "Easy" mode.

### Files
- [src/lib/geometry/aabb.ts](src/lib/geometry/aabb.ts) — **NEW**. `boxFromPlacement`, `intersects(a, b)`, `contains(container, box)`, `overhangAmount(box, pallet)`.
- [src/lib/geometry/orientation.ts](src/lib/geometry/orientation.ts) — **NEW**. Given a product + orientation, return effective `(w, d, h)`. Validates against `allowedOrientations`.
- [src/lib/geometry/stability.ts](src/lib/geometry/stability.ts) — **NEW**. `supportSurfacePct(box, supportingBoxes)` — ratio of bottom face supported by surfaces below. Threshold 80% = stable, <80% = warning.
- [src/lib/geometry/crush.ts](src/lib/geometry/crush.ts) — **NEW**. Walk the stack above each box, sum weights, compare to `maxStackLoadLb`. Surface warnings.
- [src/components/PalletDisplay/PlacementController.tsx](src/components/PalletDisplay/PlacementController.tsx) — **NEW**. R3F overlay that handles pointer raycast onto tier surfaces, snaps to grid (toggleable), and emits `(x, z, rotationDeg)`. Replaces nothing — sits alongside existing `SlotIndicator`.
- [src/components/PalletDisplay/DragHandle.tsx](src/components/PalletDisplay/DragHandle.tsx) — **NEW**. Drei `<TransformControls>` wrapper for selected placement; locks Y to tier surface; constrains rotation to 90° increments.
- [src/stores/display-store.ts](src/stores/display-store.ts) — add `placementMode: 'slot' | 'freeform'`, `setPlacementMode`, `movePlacement(id, position, rotationDeg)`, `validateAllPlacements()` returning `PalletKPIs`.

### Acceptance criteria
- In Freeform mode, dragging a case shows red ghost + reason when:
  - it intersects another case (`intersects` true)
  - it overhangs the pallet (`overhangAmount > 0` and `pallet.noOverhang`)
  - its support surface is <80%
  - the case below has `crushable: true` or aggregated load > `maxStackLoadLb`
  - its `orientation3D` isn't in `allowedOrientations`
- Drop only commits if all hard errors clear; warnings still allow drop.
- `validateAllPlacements()` returns a populated `PalletKPIs` block; no warnings on an empty pallet.

### Commit
`feat(3d): freeform placement with AABB collision, support-surface + crush checks`

---

## Phase 3 — Auto-pack (Extreme-Point First-Fit Decreasing)

**Why:** "Build me a pallet of these 50 SKUs" is the highest-value Spaceman-Automation analog. EP-FFD is the industry-standard heuristic and a known-good port target.

### Files
- [src/lib/packing/types.ts](src/lib/packing/types.ts) — **NEW**. `PackInput`, `PackBox`, `PackResult`, `PackOptions` (`pattern: 'column' | 'interlock' | 'pinwheel'`, `respectFragile: boolean`, `lightOnTop: boolean`, `homogeneousLayers: boolean`).
- [src/lib/packing/extremePoints.ts](src/lib/packing/extremePoints.ts) — **NEW**. Extreme-point list maintenance per the Crainic/Perboli/Tadei 2008 paper.
- [src/lib/packing/epffd.ts](src/lib/packing/epffd.ts) — **NEW**. The packer. Sort boxes by volume desc (with fragile/crushable tiebreakers); for each, evaluate every extreme point under every allowed orientation; pick the placement that minimizes "merit" (z first, then y, then x — bottom-front-left bias); update EP list; reject if any constraint fails (overhang, weight, crush). Output: list of `(productId, x, y, z, rotationDeg, orientation3D)` plus an `unplaced[]` list with reasons.
- [src/lib/packing/patterns.ts](src/lib/packing/patterns.ts) — **NEW**. Column-stack (identity), interlock (alternate 90° per layer), pinwheel (corner rotation). Applied post-hoc to homogeneous-layer outputs.
- [src/lib/packing/__tests__/epffd.test.ts](src/lib/packing/__tests__/epffd.test.ts) — **NEW**. Per CLAUDE.md "Tests" rule (parsers + business math). Tiny hand-checked fixtures: (1) 4 identical 10x10x10 cases into a 20x20x40 pallet -> all placed; (2) heavy fragile + light stackable -> heavy on bottom; (3) overhang forbidden -> overhanging case in `unplaced[]` w/ reason.
- [src/components/Editor/AutoPackButton.tsx](src/components/Editor/AutoPackButton.tsx) — **NEW**. Editor UI: "Auto-pack" button + options modal (pattern, respect fragile, light on top, homogeneous layers), preview + confirm. Replaces existing placements only on confirm.
- [src/stores/display-store.ts](src/stores/display-store.ts) — `runAutoPack(options)` action.

### Acceptance criteria
- Tests pass.
- Auto-pack on a sample assortment (5+ SKUs) returns a valid placement that satisfies all Phase 2 collision/support/crush checks.
- "Light on top" honors `weight` ordering: max delta of 20% between any case and the case immediately below.
- Unplaced cases show in a side panel with human-readable reason ("Exceeds pallet height by 4 in" / "No orientation fits remaining space").

### Commit
`feat(pack): EP-FFD auto-pack with column/interlock/pinwheel patterns + stability rules`

---

## Phase 4 — Retailer compliance + KPI panel

**Why:** the Spaceman wedge is space-to-sales + warnings. Surface them.

### Files
- [src/components/Editor/CompliancePanel.tsx](src/components/Editor/CompliancePanel.tsx) — **NEW**. Reads active `PalletSpec` + `PalletKPIs`. Shows: pallet height vs retailer max (progress bar with red zone), total weight vs max, cube utilization, footprint utilization per tier, case count, unit count, warnings list. One-click "Fix" suggestions where derivable (e.g., "Remove top tier — would bring height under Costco 58 in").
- [src/components/Editor/RetailerSpecPicker.tsx](src/components/Editor/RetailerSpecPicker.tsx) — **NEW**. Dropdown of presets (Costco / Sam's / Walmart / BJ's / custom). Wired through the display project so existing pallets get their retailer's preset by default.
- [src/lib/kpis.ts](src/lib/kpis.ts) — **NEW**. Pure functions: `computeKPIs(placements, spec, products) => PalletKPIs`. Single source of truth — Phase 2's `validateAllPlacements` calls into this; the panel reads its output.
- [src/lib/__tests__/kpis.test.ts](src/lib/__tests__/kpis.test.ts) — **NEW**. Reconciliation tests against a hand-checked 6-case fixture per CLAUDE.md business-math rule.

### Acceptance criteria
- Tests pass.
- Switching retailer preset re-validates and reflects new max height / weight in the panel.
- Every warning links to the offending placement (click warning -> camera focuses + highlights).

### Commit
`feat(kpis): retailer compliance panel with cube/weight utilization + warning links`

---

## Phase 5 — Rules engine (Spaceman-Automation-lite)

**Why:** Kayco runs multi-SKU pallets (Tuscanini snacks, Kedem juices, etc.). Rules let merchandisers express tier composition without dragging every case by hand.

### Files
- [src/lib/rules/types.ts](src/lib/rules/types.ts) — **NEW**. `Rule` discriminated union: `tier-composition` (which products on which tier), `tier-sequencing` (left-to-right sort key), `top-tier` (lightest / smallest), `capping` (always cap with SKU X), `block` (group SKUs as contiguous block), `min-max-facings` (per SKU).
- [src/lib/rules/apply.ts](src/lib/rules/apply.ts) — **NEW**. Rule application pipeline: filter products per tier, sort within tier, pass into Phase 3 packer with constraints. Returns rule-conformant `PackInput`.
- [src/components/Editor/RulesEditor.tsx](src/components/Editor/RulesEditor.tsx) — **NEW**. Form to author rules per pallet template.
- [src/lib/rules/__tests__/apply.test.ts](src/lib/rules/__tests__/apply.test.ts) — **NEW**. Per-rule fixture tests.

### Acceptance criteria
- Tests pass.
- A pallet with "tuna on bottom, snacks middle, candles top, cap with sample pack" rules produces a packing that respects all four.
- Rule conflicts (e.g., "smallest on top" + "candles on top" when candles are largest) surface a clear warning instead of silently dropping one rule.

### Commit
`feat(rules): tier composition + sequencing + capping rules feeding the packer`

---

## Phase 6 (deferred) — PSA import

Bring Kayco's existing Spaceman / Blue Yonder product master in without re-keying. PSA is a binary format; no good OSS reader. Realistic options: (a) ship a guided XLSX export-from-Spaceman path, (b) license Blue Yonder Planogram SDK, (c) reverse-engineer a partial parser. **Decide based on Kayco's actual data source after Phase 5 lands.** Until then, keep the XLSX template as the only import path.

---

## Cross-cutting rules for Codex

- **Strict TS, no `any`.** Use discriminated unions for `Rule`, `PalletWarning`, `PackResult` outcomes.
- **No new design language.** White cards on `#fafafa`, black accent `#171717`, `text-[10px] uppercase tracking-wider` captions, `tabular-nums`. See [CLAUDE.md](CLAUDE.md) for the visual contract.
- **Don't break existing pallets.** Defaults on every new field so old `DisplayProject` records keep rendering.
- **No mock data.** All units inches & pounds. All math in pure functions under [src/lib/](src/lib/).
- **Tests are mandatory** for Phase 1 XLSX round-trip, Phase 3 packer, Phase 4 KPIs, Phase 5 rules — these are exactly the "risky-by-default" categories from CLAUDE.md.
- **Commit + push at each phase boundary**, then pause for user review before starting the next phase. Per CLAUDE.md working-style rule.
- **No em dashes / en dashes in code, copy, or commits.** Hyphens only.
- **Verify before "done":** `npm run build`, `npm test`, then drive the editor in a browser on `:3003` and exercise the golden path for that phase.
- **Existing 3D components in [src/components/PalletDisplay/](src/components/PalletDisplay/) are the foundation.** Extend them. Don't fork.

## Phase ordering rationale

Phases 1-4 are the MVP — by the end of Phase 4 the app can do everything Spaceman does for pallets, plus things Spaceman doesn't (true 3D, retailer-spec presets). Phases 5-6 are leverage features and can wait for user feedback after the MVP ships.
