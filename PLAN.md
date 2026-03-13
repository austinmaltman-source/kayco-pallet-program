# Pallet Builder Redesign - Simplified 2D Editor

## Context
The current UI is too cluttered and the 3D viewport is broken (zoom bouncing, scroll doesn't work, can't orbit). Redesign to a clean 2D shelf grid editor with customer-based product catalogs. The 3D scene files stay in the codebase but are NOT used in the layout.

## Tech Stack (unchanged)
- Next.js 15 (App Router) + React + TypeScript
- Zustand + Immer (state management)
- Tailwind CSS (styling)
- Radix UI (accessible primitives)
- jsPDF (PDF export)
- PapaParse + xlsx (CSV/Excel import)

## New Layout

```
+----------------------------------------------------------+
| Kayco Holiday Pallet Program       [Save] [JSON] [PDF]   |
+----------------------------------------------------------+
|                    |                                      |
| CUSTOMER SELECTOR  |     2D SHELF GRID EDITOR             |
| [Kroger|Meijer|HT] |                                      |
|                    |     [Front] [Back] [Left] [Right]     |
| PRODUCT CATALOG    |                                      |
| (search bar)       |  Row 4  [____][____][____][____]     |
| (draggable cards)  |  Row 3  [____][____][____][____]     |
|                    |  Row 2  [____][____][____][____]     |
|                    |  Row 1  [____][____][____][____]     |
|                    |                                      |
+----------------------------------------------------------+
```

- **Header**: App title + minimal save/export buttons
- **Left sidebar (~320px)**: Customer selector pills at top, then product catalog (search + draggable product cards)
- **Main area**: 2D shelf grid editor showing one wall at a time, wall tabs above the grid

## What to DELETE from AppShell (don't import, don't render)
- Program mode toggle (full/half pallet)
- StatCard components (footprint, program mode)
- Pallet settings section (preset, dimensions, header toggle)
- Wall program section
- Builder summary section
- PropertiesPanel
- Bottom footer bar
- SceneRoot / 3D canvas / viewport overlay badges
- Grid on/off toggle, Clear placements, Reset scene pills
- Manual product entry (ProductForm)
- `exportViewportImage` (no viewport to screenshot)

## What to KEEP
- Save/export buttons (JSON, PDF) in header
- Product catalog sidebar (driven by customer selection)
- Keyboard shortcuts (undo/redo/delete via useKeyboardShortcuts)
- Placement store with undo/redo (usePlacementStore - unchanged)
- Project store (useProjectStore - unchanged)
- All type definitions (types/* - unchanged)

## Implementation Steps

### Step 1: Customer Data (already done)
File `lib/customers.ts` is already created with:
- `Customer` type: `{ id, name, products: Product[] }`
- 3 customers: Kroger (10 products), Meijer (9 products), Harris Teeter (10 products)
- `getCustomerById(id)` helper

### Step 2: Simplify useUIStore
**File: `stores/useUIStore.ts`**
- ADD: `selectedCustomerId: string` (default: `"kroger"`)
- ADD: `setSelectedCustomerId: (id: string) => void`
- REMOVE: `activeView`, `showGrid`, `captureResolver`, `requestCaptures`, `clearCaptureRequest`
- REMOVE: `setActiveView`, `toggleGrid`
- KEEP: `selectedWall`, `setSelectedWall`, `draggingProductId`, `setDraggingProductId`, `dropPreview`, `setDropPreview`
- UPDATE `setSelectedWall`: just set the wall, don't set activeView
- UPDATE partialize: only persist `selectedWall` and `selectedCustomerId`

### Step 3: Simplify useProductStore
**File: `stores/useProductStore.ts`**
- Change initial `products` from `SAMPLE_PRODUCTS` to `[]` (empty array)
- Remove import of `SAMPLE_PRODUCTS`
- Keep all methods: `replaceProducts`, `addProduct`, `importProducts`, `removeProduct`, search/filter state
- Remove the `defaultProductDraft` export (no longer needed)
- Remove the `ProductDraft` interface (no longer needed)
- Products are loaded by AppShell when customer changes via `replaceProducts(customer.products)`

### Step 4: Create 2D ShelfGrid component
**New file: `components/editor/ShelfGrid.tsx`** ("use client")

This is the main editor. It renders one wall's shelf grid at a time.

Props:
```typescript
{
  pallet: PalletConfig;
  wall: WallFace;
  placements: PlacedItem[];
  products: Product[];
  draggingProductId: string | null;
  onPlace: (params: { wall: WallFace; shelfRow: number; gridCol: number; product: Product }) => void;
  onSelectPlacement: (id: string | null) => void;
  selectedPlacementId: string | null;
}
```

Behavior:
- Renders a visual grid: 4 rows (bottom=Row 1, top=Row 4) x N columns (from `pallet.display.walls[wall].gridColumns`)
- Row labels on left side ("Row 1", "Row 2", etc.)
- Column numbers along the top
- Each cell is a drop target that highlights on dragover
- Placed products render as colored rounded blocks spanning their `colSpan` columns, showing product name + SKU
- Selected placement gets a blue ring border
- Click a placed product to select it, click empty area to deselect
- Drop validation: use `getProductColSpan()` from `lib/gridMath.ts` to calculate span, use `detectPlacementConflict()` to check for overlaps
- Valid drop = green highlight, invalid = red highlight
- Use HTML drag/drop events (not 3D raycasting)
- Grid should look clean and polished - use the existing design system colors (--primary, --line, --panel, etc.)
- Each shelf row should have a subtle branded strip divider between rows (just a thin colored bar, like `bg-[var(--primary)]` with low opacity)

### Step 5: Rewrite AppShell
**File: `components/layout/AppShell.tsx`** (complete rewrite)

Structure:
```tsx
<Tooltip.Provider>
<main>
  {/* Header */}
  <header className="panel-surface ...">
    <h1>Holiday Pallet Layout</h1>
    <div>{/* Save, Export JSON, Export PDF buttons */}</div>
  </header>

  {/* Two-column layout */}
  <div className="grid xl:grid-cols-[320px_1fr] ...">

    {/* Left sidebar */}
    <aside>
      {/* Customer selector - 3 pill buttons */}
      <div>
        <button>Kroger</button>
        <button>Meijer</button>
        <button>Harris Teeter</button>
      </div>

      {/* Product catalog */}
      <ProductCatalog onStatus={setStatusMessage} />
    </aside>

    {/* Main editor area */}
    <section className="panel-surface ...">
      {/* Wall tabs */}
      <div>
        {WALL_FACES.map(face => (
          <button active={selectedWall === face}>{WALL_LABELS[face]}</button>
        ))}
      </div>

      {/* 2D Shelf Grid */}
      <ShelfGrid
        pallet={pallet}
        wall={selectedWall}
        placements={placements}
        products={products}
        draggingProductId={draggingProductId}
        onPlace={...}
        onSelectPlacement={...}
        selectedPlacementId={...}
      />
    </section>
  </div>
</main>
</Tooltip.Provider>
```

Key changes:
- Import `ShelfGrid` instead of `SceneRoot`
- Import customer data from `lib/customers.ts`
- On customer change: call `replaceProducts(customer.products)` and `clear()` placements
- Remove ALL the old right panel content (pallet settings, wall program, builder summary, properties panel)
- Remove StatCard, PropertiesPanel imports
- Remove footer
- Keep: useKeyboardShortcuts, save/export handlers, Tooltip.Provider
- Keep ControlPill and Tip helper components (reuse for wall tabs and customer pills)
- Status message with `aria-live="polite"` in header

### Step 6: Update ProductCatalog
**File: `components/catalog/ProductCatalog.tsx`**
- REMOVE: the "Manual product entry" section at the bottom (no ProductForm)
- REMOVE: import of ProductForm
- Keep: search bar, category filter, product card list
- The customer selector is in AppShell, not in ProductCatalog

### Step 7: Simplify export service
**File: `services/exportService.ts`**
- REMOVE: `exportViewportImage` function (no 3D viewport)
- UPDATE: `exportProjectPdf` signature - remove `captures` parameter. Generate PDF from placement data only:
  - Page 1: Project overview + placement summary table
  - Pages 2+: One page per wall that has placements, with grid layout + SKU table (same grid drawing logic already exists, just remove the 3D capture image)
  - Last page: Bill of Materials
- KEEP: `exportProjectJson`, `importProjectJson`

### Step 8: Clean up constants
**File: `lib/constants.ts`**
- REMOVE: `SAMPLE_PRODUCTS` array (products now come from customer data)
- REMOVE: `PALLET_COPY` (no longer used)
- KEEP: `WALL_FACES`, `WALL_LABELS`, `PROJECT_STORAGE_KEY`

## Files That Stay Untouched
- `components/scene/*` - all 3D components (kept for future 3D toggle)
- `lib/cameraUtils.ts`, `lib/textureFactory.ts` - unused but kept
- `lib/gridMath.ts` - REUSE `getProductColSpan()` and `detectPlacementConflict()` in ShelfGrid
- `lib/palletPresets.ts` - still needed for pallet config
- `stores/usePlacementStore.ts` - unchanged (undo/redo, CRUD)
- `stores/useProjectStore.ts` - unchanged (save/load)
- `stores/usePalletStore.ts` - unchanged (provides pallet config)
- `services/storageService.ts` - unchanged
- `services/importService.ts` - unchanged
- `hooks/useKeyboardShortcuts.ts` - unchanged
- `types/*` - all type files unchanged
- `app/globals.css` - unchanged
- `app/layout.tsx` - unchanged
- `db/*` - unchanged

## Verification
1. `npx next build` passes with no errors
2. App loads with Kroger selected by default, showing Kroger products in sidebar
3. Switching to Meijer or Harris Teeter swaps the product catalog
4. Can drag a product from the catalog onto the 2D shelf grid
5. Products show as colored blocks on the grid with name and SKU
6. Products span correct number of columns based on their width
7. Collision detection prevents overlapping products (red highlight on invalid drop)
8. Clicking a placed product selects it (blue highlight), Delete key removes it
9. Cmd+Z undoes, Cmd+Shift+Z redoes
10. Wall tabs (Front/Back/Left/Right) switch which wall's grid is shown
11. Save button persists to localStorage
12. Export JSON downloads a .json file
13. Export PDF generates a multi-page planogram
14. No 3D scene loads, no broken viewport, no console errors
