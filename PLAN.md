# 3D Pallet Display Builder - Implementation Plan

## Context
The workplace runs a holiday pallet program selling pallets with 4-sided displays loaded with holiday items. This app lets users design pallets in 3D: assign SKUs, drag-and-drop products onto display surfaces, spin/orbit the pallet, and export planograms.

> **Note:** Using existing Next.js scaffolding instead of Vite. All 3D components are client-side (`"use client"`). Next.js gives us API routes for future backend + Vercel deploy out of the box.

## Tech Stack
- **Next.js 15 (App Router) + React + TypeScript** - existing scaffolding, Vercel-ready
- **Three.js via React Three Fiber + @react-three/drei** - declarative 3D in React
- **Zustand + Immer** - lightweight state management with immutable updates
- **Tailwind CSS** - utility-first styling
- **Radix UI** - accessible UI primitives (dialogs, tabs, selects, tooltips)
- **PapaParse + xlsx** - CSV/Excel import
- **jsPDF + html2canvas** - PDF/image export

## Architecture Overview

### App Layout
```
+--------------------------------------------------+
|  TopToolbar (mode switch, save/load, export)      |
+----------+------------------------+---------------+
|          |                        |               |
|  Left    |   3D Viewport          |  Right Panel  |
|  Panel   |   (React Three Fiber)  |  (Properties) |
| (Product |                        |               |
|  Catalog)|                        |               |
|          |                        |               |
+----------+------------------------+---------------+
|  BottomBar (status / layer selector)              |
+--------------------------------------------------+
```

### Two Pallet Types (from reference photos in `/reference/`)
- **Full Pallet** - Wooden pallet base + 4-sided display tower. Each side has 4 shelf rows separated by branded strip dividers ("ALL YOUR HOLIDAY NEEDS"). Products face outward on each shelf. Branded header/topper sits on top. All 4 sides hold different product assortments. (See: `FULL_PASS26*.png`)
- **Half Pallet** - Wooden pallet base + 1 front-facing product display with 4 shelf rows. Left and right sides are **solid branded graphic panels** (not product shelves). Back is open (designed to sit against a wall or endcap). Same shelf strip dividers and header/topper as full. (See: `HALF_PASS26*.png`)

### Key Physical Structure (observed from photos)
- **Shelf rows:** 4 rows per product-facing side, each ~12-15" tall
- **Strip dividers:** Blue branded strips between each shelf row (functional as shelf lips + branding)
- **Header/topper:** Branded card sitting on top of the display (removable, holiday-specific)
- **Side panels (half pallet only):** Full-height solid panels with printed graphics
- **Base:** Standard wooden pallet visible at bottom

### Coordinate System
1 inch = 1 scene unit. Standard pallet (48x40") = 48x40 in scene.

## Core Data Models

### Product
```typescript
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;              // e.g., "Candy", "Decorations"
  holiday: HolidayType;          // 'christmas' | 'halloween' | 'easter' | etc.
  dimensions: {
    width: number;               // inches
    height: number;
    depth: number;
  };
  weight?: number;               // pounds
  imageUrl?: string;             // product image for 3D texture
  color?: string;                // fallback color if no image
  unitCost?: number;
  unitPrice?: number;
  unitsPerCase?: number;
}
```

### Pallet Config
```typescript
type PalletType = 'full' | 'half';

interface PalletConfig {
  id: string;
  name: string;
  type: PalletType;
  base: {
    width: number;               // X axis (inches), e.g. 48
    depth: number;               // Z axis (inches), e.g. 40
    height: number;              // Y axis (inches), typically 6
    preset?: '48x40' | '48x48' | '42x42' | '48x42' | 'custom';
  };
  display: {
    shelfRows: number;           // typically 4
    rowHeight: number;           // inches per shelf row
    wallThickness: number;
    stripHeight: number;         // branded divider strip height
    // Full pallet: all 4 walls have product shelves
    // Half pallet: only front has shelves, left/right are branded panels, back is open
    walls: {
      front: WallConfig;
      back: WallConfig;          // half pallet: disabled
      left: WallConfig;          // half pallet: solid branded panel
      right: WallConfig;         // half pallet: solid branded panel
    };
    header?: {
      enabled: boolean;
      height: number;            // topper height in inches
      imageUrl?: string;         // holiday-specific header graphic
    };
  };
}

interface WallConfig {
  enabled: boolean;
  wallType: 'shelves' | 'branded-panel' | 'open';  // shelves=products, branded-panel=solid graphic, open=no wall
  gridColumns: number;           // only for 'shelves' type
  backgroundColor?: string;
  brandingImageUrl?: string;     // for branded-panel type (e.g., "ALL YOUR HOLIDAY NEEDS" graphic)
  stripText?: string;            // text on shelf divider strips
  stripColor?: string;           // color of divider strips (e.g., blue)
}
```

### Placement
```typescript
interface PlacedItem {
  id: string;
  productId: string;
  wall: 'front' | 'back' | 'left' | 'right';
  shelfRow: number;              // 0 = bottom shelf, 3 = top shelf
  gridCol: number;               // column position on shelf
  colSpan: number;               // how many grid columns this item occupies
  rotation: number;              // 0, 90, 180, 270 degrees
  quantity: number;              // number of units (for facings)
  displayMode: 'face-out' | 'spine-out';
  offsetX?: number;              // fine-tune offset from grid snap
}
```

### Project
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  holiday: HolidayType;
  palletConfig: PalletConfig;
  placements: PlacedItem[];
  products: Product[];           // embedded product data
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    tags?: string[];
  };
  version: number;               // schema version for migrations
}
```

## State Management (5 Zustand Stores)

| Store | Purpose |
|-------|---------|
| `useProjectStore` | Save/load/create projects, project list |
| `usePalletStore` | Pallet dimensions, wall configs, layers |
| `useProductStore` | Product catalog, search/filter |
| `usePlacementStore` | Item placements, undo/redo, collision validation |
| `useUIStore` | Selection, drag state, camera preset, panel sizes |

All stores use Zustand `persist` middleware for localStorage and `immer` middleware for immutable updates.

## 3D Scene Architecture

### Realistic Rendering
- HDR environment map (warehouse preset) for reflections/indirect light
- Directional light with 2048x2048 shadow map
- Contact shadows on ground plane
- PBR materials: wood texture (diffuse + normal map) on pallet, cardboard on walls
- Product images mapped as textures on product boxes (RoundedBox from drei)
- ACES filmic tone mapping

### Display Tower Scene Graph
```jsx
<Canvas shadows preserveDrawingBuffer>
  <Environment preset="warehouse" />
  <directionalLight castShadow />
  <ContactShadows />
  <OrbitControls />
  <GridFloor />
  <PalletBase />              {/* Textured wooden pallet */}
  <DisplayWall face="front" />
  <DisplayWall face="back" />
  <DisplayWall face="left" />
  <DisplayWall face="right" />
  <PlacedProduct />...        {/* Product boxes with image textures */}
  <ProductGhost />            {/* Translucent preview during drag */}
  <PlacementController />     {/* Raycast + snap + collision orchestrator */}
</Canvas>
```

### Interaction System (Drag & Drop)
1. HTML drag starts in product catalog panel
2. Pointer enters Canvas → PlacementController raycasts against wall/layer surfaces
3. SnapEngine snaps intersection point to nearest grid cell
4. CollisionDetector checks for overlaps (AABB in 2D on wall plane)
5. ProductGhost renders at snap position (green=valid, red=conflict)
6. On drop → `usePlacementStore.placeItem()` commits placement + pushes undo stack

### Wall Selection
- Click wall → camera smoothly animates to face it straight-on
- Grid overlay becomes prominent, other walls go semi-transparent
- Keyboard shortcuts: 1/2/3/4 for front/back/left/right

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete/Backspace | Remove selected item |
| R | Rotate selected item 90° |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+S | Save project |
| 1/2/3/4 | Camera to front/back/left/right wall |
| G | Toggle grid visibility |
| L | Toggle label visibility |

## Folder Structure
```
src/
  main.tsx, App.tsx
  types/
    pallet.ts, product.ts, placement.ts, project.ts
  stores/
    useProjectStore.ts, usePalletStore.ts, useProductStore.ts,
    usePlacementStore.ts, useUIStore.ts, useExportStore.ts
  components/
    layout/
      AppShell.tsx, TopToolbar.tsx, LeftPanel.tsx, RightPanel.tsx,
      BottomBar.tsx, PanelResizer.tsx
    catalog/
      ProductCatalog.tsx, ProductCard.tsx, ProductSearch.tsx,
      CategoryFilter.tsx, ImportDialog.tsx, ProductForm.tsx
    properties/
      PropertiesPanel.tsx, PalletSettings.tsx, WallSettings.tsx,
      ItemProperties.tsx, LayerSettings.tsx, SectionSettings.tsx
    toolbar/
      ModeSwitch.tsx, SaveLoadMenu.tsx, ExportMenu.tsx, UndoRedoButtons.tsx
  scene/
    SceneRoot.tsx, SceneEnvironment.tsx, CameraController.tsx, GridFloor.tsx
    pallet/
      PalletBase.tsx, DisplayTower.tsx, DisplayWall.tsx, WallGrid.tsx,
      StackedPallet.tsx, PalletLayer.tsx, SectionDivider.tsx
    items/
      PlacedProduct.tsx, ProductGhost.tsx, DragProxy.tsx, ProductLabel.tsx
    interaction/
      PlacementController.tsx, WallSelector.tsx, SnapEngine.tsx,
      CollisionDetector.tsx, SelectionOutline.tsx
    effects/
      PlacementHighlight.tsx, SelectionGlow.tsx
  hooks/
    useGridSnap.ts, useCollisionCheck.ts, useDragDrop.ts,
    useScreenshot.ts, useKeyboardShortcuts.ts, usePalletDimensions.ts
  services/
    importService.ts, exportService.ts, storageService.ts,
    shareService.ts, validationService.ts
  utils/
    dimensions.ts, palletPresets.ts, gridMath.ts, collisionMath.ts,
    textureLoader.ts, constants.ts
  styles/
    globals.css
public/
  textures/
    wood-pallet.jpg, cardboard.jpg, wood-normal.jpg, warehouse.hdr
```

## Implementation Phases

### Phase 1: Foundation
Next.js app shell with Tailwind, 3D Canvas with environment/lighting, textured pallet base mesh, orbit controls, grid floor. All 3D components use `"use client"`.

**Files:** `next.config.ts`, `package.json`, `tsconfig.json`, `app/page.tsx`, `app/layout.tsx`, `types/pallet.ts`, `stores/usePalletStore.ts`, `stores/useUIStore.ts`, `components/scene/SceneRoot.tsx`, `components/scene/SceneEnvironment.tsx`, `components/scene/CameraController.tsx`, `components/scene/GridFloor.tsx`, `components/scene/pallet/PalletBase.tsx`, `lib/constants.ts`, `lib/palletPresets.ts`

**Milestone:** Rotatable realistic pallet base in browser.

### Phase 2: Full Pallet Display
4-sided display structure on pallet base. Each side has 4 shelf rows with branded strip dividers between rows. Cardboard/corrugated texture on walls. Grid overlays on shelf faces for product placement. Click-to-select wall with camera animation. Pallet type selector (full/half). Branded header/topper on top. Pallet dimension controls (presets + custom). Wall settings (grid density, enable/disable).

**Files:** `components/scene/pallet/DisplayStructure.tsx`, `components/scene/pallet/ShelfWall.tsx`, `components/scene/pallet/ShelfRow.tsx`, `components/scene/pallet/ShelfGrid.tsx`, `components/scene/pallet/StripDivider.tsx`, `components/scene/pallet/HeaderTopper.tsx`, `components/scene/interaction/WallSelector.tsx`, `components/layout/AppShell.tsx`, `components/properties/PalletSettings.tsx`, `components/properties/WallSettings.tsx`, `components/toolbar/TypeSwitch.tsx`, `app/globals.css`

**Milestone:** Full pallet with 4 clickable shelf walls, strip dividers, and header.

### Phase 3: Product Catalog
Product type definitions, product store, left panel UI with search/filter, product card thumbnails, manual product entry form, CSV/Excel import dialog with column mapping + validation preview.

**Files:** `src/types/product.ts`, `src/stores/useProductStore.ts`, `src/components/layout/LeftPanel.tsx`, `src/components/catalog/ProductCatalog.tsx`, `src/components/catalog/ProductCard.tsx`, `src/components/catalog/ProductSearch.tsx`, `src/components/catalog/CategoryFilter.tsx`, `src/components/catalog/ProductForm.tsx`, `src/components/catalog/ImportDialog.tsx`, `src/services/importService.ts`, `src/services/validationService.ts`

**Milestone:** Import CSV, browse/search products in catalog.

### Phase 4: Placement System (Tower Mode)
Placement store with undo/redo, drag-from-catalog to 3D wall, grid snap engine, AABB collision detection, product ghost preview (green/red), placed product meshes with image textures, selection outline + item properties panel, keyboard shortcuts.

**Files:** `src/types/placement.ts`, `src/stores/usePlacementStore.ts`, `src/scene/items/PlacedProduct.tsx`, `src/scene/items/ProductGhost.tsx`, `src/scene/items/ProductLabel.tsx`, `src/scene/interaction/PlacementController.tsx`, `src/scene/interaction/SnapEngine.tsx`, `src/scene/interaction/CollisionDetector.tsx`, `src/scene/interaction/SelectionOutline.tsx`, `src/scene/effects/PlacementHighlight.tsx`, `src/hooks/useGridSnap.ts`, `src/hooks/useCollisionCheck.ts`, `src/hooks/useDragDrop.ts`, `src/utils/gridMath.ts`, `src/utils/collisionMath.ts`, `src/components/properties/ItemProperties.tsx`, `src/components/layout/RightPanel.tsx`

**Milestone:** Full drag-and-drop placement on tower walls.

### Phase 5: Half Pallet Mode
Half pallet variant: 1 front-facing product wall with 4 shelf rows, solid branded graphic panels on left/right sides, open back. Type switcher (full/half) auto-configures wall types. Branded panel editor (upload/select side graphics). Half pallet uses same shelf placement system but only on front wall.

**Files:** `components/scene/pallet/HalfPalletStructure.tsx`, `components/scene/pallet/BrandedPanel.tsx`, `components/properties/BrandedPanelSettings.tsx`, `components/toolbar/TypeSwitch.tsx`

**Milestone:** Switch to half pallet mode, front shelf works, side panels show branding.

### Phase 6: Save/Load & Export
Project store, localStorage CRUD, save/load UI, screenshot export (high-res canvas capture), PDF planogram (programmatic camera per wall → multi-page PDF with SKU tables), JSON project file export/import for sharing, shareable `.pallet` file download.

**Files:** `src/types/project.ts`, `src/stores/useProjectStore.ts`, `src/stores/useExportStore.ts`, `src/services/storageService.ts`, `src/services/exportService.ts`, `src/services/shareService.ts`, `src/hooks/useScreenshot.ts`, `src/components/toolbar/SaveLoadMenu.tsx`, `src/components/toolbar/ExportMenu.tsx`, `src/hooks/useKeyboardShortcuts.ts`

**Milestone:** Full persistence and all export formats working.

### Phase 7: Polish
Undo/redo visual indicators, responsive panel resizing, loading/empty states, tooltips, performance optimization (instanced meshes for repeated products), touch/tablet support, accessibility.

## Key Dependencies
```bash
# 3D Rendering
three @react-three/fiber @react-three/drei @types/three

# State Management
zustand immer

# UI
@radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select
@radix-ui/react-tooltip @radix-ui/react-popover
tailwindcss

# File Import/Export
papaparse @types/papaparse xlsx
jspdf html2canvas

# Utilities
nanoid

# Dev
leva r3f-perf
```

## Technical Notes

### HTML-to-3D Drag Bridge
The catalog is rendered in normal HTML (left panel). When dragging a product, we use pointer events on an invisible plane in the 3D scene to track the cursor position. PlacementController raycasts to find wall intersections and renders a ghost preview at the snapped position. On drop, the placement is committed to the store.

### PDF Planogram Generation
1. Programmatically position camera facing each wall straight-on
2. Render + capture each view via `gl.domElement.toBlob()`
3. Compose into multi-page PDF with jsPDF: overview (isometric), then one page per wall face with grid + SKU labels, final page = Bill of Materials summary table

### Future Backend Preparation
The storage service uses a clean adapter interface (`saveProject`, `loadProject`, `listProjects`, `deleteProject`) that can swap from `LocalStorageAdapter` to `ApiStorageAdapter` when a backend is added.

## Verification Plan
- **Phase 1:** Open browser → see textured pallet, orbit/zoom/pan works, shadows render
- **Phase 2:** Click walls → camera snaps to face, see 4 shelf rows with strip dividers, header topper visible, adjust grid density → grid updates, change dimensions → pallet resizes
- **Phase 3:** Import a test CSV → products appear in catalog, search/filter works
- **Phase 4:** Drag product from catalog → ghost appears on wall → drop → product sticks, try overlapping → red indicator, undo → item removed
- **Phase 5:** Switch to half pallet → only front wall has shelves, left/right show branded panels, back is open
- **Phase 6:** Save project → reload page → load project → everything restored, export PDF → multi-page planogram, export screenshot → high-res image
- **Phase 7:** Keyboard shortcuts work, panels resize, no console errors, smooth 60fps
