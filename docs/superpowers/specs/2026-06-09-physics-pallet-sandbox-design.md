# Physics Pallet Sandbox - Design

Date: 2026-06-09
Status: Approved

## Goal

Replace the slot-grid, click-to-place 3D pallet viewer with a physics-based free-drag
gravity sandbox (Rapier via @react-three/rapier). Users pick up items with the mouse,
move them anywhere, and release them; items fall, collide, and settle on the pallet
deck, shelves, or other items. Volume fit is enforced physically, not by validation
warnings.

## Decisions

1. World shape: the tiered display structure stays, as fixed physics colliders.
   Items are dragged onto shelves and settle there or on other items.
2. 2D GridEditor: retired (deleted in the final phase).
3. Migration: existing slot placements auto-migrate on load to world transforms
   using the existing getShelfPosition math, then slot fields are dropped.
4. Case physics: hybrid. A case is one rigid body (cuboid sized by dimensionEngine);
   CaseItemGrid renders the units inside as visuals. Loose single units are
   individual bodies.
5. Rotation: 90 degree preset steps while held (R key or scroll), reusing
   orientation-presets.ts. Physics settles the item on release.
6. Pallet scope: full pallet first, half pallet (Kayco tower path) in a later phase.

## Architecture: world transforms as source of truth (Approach A)

PlacedProduct gains:

```ts
position: [number, number, number];   // world coords, inches
quaternion: [number, number, number, number];
```

Retired fields: slotId, wall, tier, gridCol, colSpan, displayMode, orientation index.

During interaction Rapier owns transforms. When bodies settle (sleep) after a
release, settled transforms are written back to display-store and persisted via the
existing localStorage wiring. On reload, bodies spawn asleep at saved transforms so
nothing moves. Undo/redo keeps the existing project-snapshot history.

No physics state is ever serialized; persistence stays plain JSON.

## Physics world

- Gravity [0, -386, 0] (inches per second squared; coordinate system is inches).
- Fixed colliders: pallet deck, each tier shelf platform (geometry from
  buildTierConfigs), side/back panels, ground plane, and an invisible ceiling at the
  retailer maxDisplayHeight (vertical overfill is physically impossible).
- Item bodies: dynamic RigidBody, cuboid collider from resolveProductDimensions,
  mass from resolveProductWeight.

## Interaction

- Grab: pointer-down raycasts to a body, switches it kinematic, disables orbit.
- Move: held item follows the cursor by raycasting against the scene and hovering
  about 0.5 inch above the hit surface (tracks up onto stacks and shelves).
  Shift drags on a vertical plane for explicit up/down. Height clamped below ceiling.
- Rotate: R or scroll while held cycles the 6 orientation presets.
- Release: body goes dynamic, falls, settles; settled transforms persist on sleep.
- Spawn: drag a product from the picker panel into the canvas, already held.
- Remove: select then Delete. Items settling fully off the pallet footprint are
  returned to the picker with a toast (horizontal overfill enforcement).

## Components (inside src/components/PalletDisplay/)

- physics/SandboxPhysics.tsx - Physics wrapper, gravity, pause control
- physics/FixedColliders.tsx - deck/shelves/panels/ceiling/ground colliders
- physics/ItemBody.tsx - RigidBody + cuboid collider wrapping ProductRenderer
- physics/useDragControls.ts - grab/follow/rotate/release state machine
- physics/settle.ts - sleep watching + write-back to store
- src/lib/placementMigration.ts - slot to transform conversion (wraps getShelfPosition)

## Reuse vs retire

Reused: dimensionEngine.ts, caseUtils.ts/CaseItemGrid, orientation-presets.ts,
buildTierConfigs (collider geometry), getShelfPosition (migration only).

Retired in final phase: GridEditor (2D), SlotIndicator, GhostProduct, slot-utils.ts,
colSpanCalculator.ts, placementSuggestions.ts, spatialValidator.ts except the total
weight check which becomes an advisory HUD chip.

## Error handling

- Rapier WASM load failure: error boundary with readable message.
- Bodies that never sleep: force-sleep after a 3 second settle timeout.
- NaN or exploded transforms: reject write-back, restore last good transform.

## Testing

- Vitest: migration math (slot to transform parity with getShelfPosition), store
  actions (spawn, upsertTransform, remove, undo/redo with transforms), collider
  sizing from dimensionEngine. Existing caseUtils tests stay.
- Manual click-through at each phase; npm run lint and npm run build per phase.

## Phases (committed and pushed at each boundary)

1. Physics scaffold - install rapier, wrap scene, fixed colliders, existing
   placements appear as sleeping bodies at migrated transforms.
2. Grab and drag - grab/move/rotate/release/settle loop, persistence, spawn from
   picker, delete.
3. Volume and fit - ceiling, off-pallet removal, weight HUD.
4. Unit-level rendering polish - CaseItemGrid inside bodies, hybrid singles,
   hover/selection effects.
5. Half pallet + retirement - colliders for the Kayco tower path, delete the 2D
   editor and slot modules, final test/lint/build sweep.

## Conventions

No em dashes or en dashes anywhere (code, comments, copy, commits). Plain hyphens.
Stack unchanged: Vite + React 19 + TS strict, zustand, localStorage persistence.
