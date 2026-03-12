# Kayco Pallet Program

## Overview
3D Pallet Display Builder for Kayco's holiday pallet program. Design pallets in 3D: assign SKUs to shelf positions, drag-and-drop products onto display surfaces, spin/orbit the pallet, and export planograms (PDF, image, JSON).

Two pallet types:
- **Full Pallet** — 4-sided display tower with 4 shelf rows per side
- **Half Pallet** — 1 front product wall + 2 solid branded side panels (sits against wall/endcap)

See `reference/` for photos of real pallets. See `PLAN.md` for full implementation plan.

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Three.js / React Three Fiber / @react-three/drei (3D rendering)
- Zustand + Immer (state management)
- Tailwind CSS
- Radix UI (dialogs, tabs, selects, tooltips)
- PapaParse + xlsx (CSV/Excel import)
- jsPDF + html2canvas (PDF/image export)

## Hosting
- **App:** Vercel

## Deploy
```bash
# Dev
npm run dev

# Build
npm run build

# Deploy (via Vercel CLI or git push)
vercel
```

## Project Structure
```
app/                    # Next.js App Router pages
components/
  layout/              # AppShell, panels, toolbar
  catalog/             # Product catalog, import, search
  properties/          # Right panel property editors
  scene/               # All React Three Fiber 3D components
    pallet/            # PalletBase, ShelfWall, StripDivider, etc.
    items/             # PlacedProduct, ProductGhost
    interaction/       # PlacementController, SnapEngine, WallSelector
stores/                # Zustand stores (project, pallet, product, placement, UI)
hooks/                 # Custom hooks (drag-drop, grid snap, shortcuts)
lib/                   # Utilities, constants, presets
types/                 # TypeScript type definitions
reference/             # Real pallet photos for design reference
public/textures/       # Wood, cardboard, HDR environment textures
```

## Reference Images
- `FULL_PASS26*.png` — Full pallet (4 product-facing sides)
- `HALF_PASS26*.png` — Half pallet (1 front + 2 branded side panels)
