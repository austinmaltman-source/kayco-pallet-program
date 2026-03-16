# Gemini Task Brief - Art, Textures & UI/UX

## CRITICAL RULES

1. **DO NOT modify 3D geometry, sizing, positioning, or dimensions** - the structure is final and looks exactly as it should
2. **DO NOT modify functionality** - drag-drop, state management, stores, placement logic, export, keyboard shortcuts all work correctly
3. **DO NOT change** `DisplayStructure.tsx` geometry (sidePanelGeo, backHeight, sidePanelHeight, slopeRise, shelf positions, strip lip sizes, platformY, baseY, etc.)
4. **DO NOT change** `PalletBase.tsx`, `SceneRoot.tsx`, `CameraController.tsx`, `GridFloor.tsx`, `PlacedProduct.tsx`, `SceneLighting.tsx`, `SceneOverlay.tsx`
5. **DO NOT change** any files in `stores/`, `hooks/`, `services/`, `lib/gridMath.ts`, `lib/palletPresets.ts`
6. You CAN modify: `lib/textureFactory.ts`, `components/scene/pallet/BrandedPanel.tsx`, `components/scene/pallet/HeaderTopper.tsx`, `components/scene/pallet/StripDivider.tsx`, `components/layout/AppShell.tsx`, `components/catalog/`, `components/editor/ShelfGrid.tsx`, `app/globals.css`, `app/layout.tsx`

---

## Part 1: 3D Panel Art & Textures

Match the reference photos in `reference/HALF_PASS26*.png`. Study all three angles (front, left, right) carefully.

### What the display looks like (from the reference photos)

The half pallet display is a U-shaped cardboard shelf unit sitting on a wooden pallet. It has:

- **4 shelf rows** with products visible from the front (open front)
- **4 cyan fascia strips** across the front saying "ALL YOUR HOLIDAY NEEDS" in white with decorative floral/leaf designs and small star-of-david motifs
- **2 cyan side panels** (left and right) with large white text "ALL YOUR HOLIDAY NEEDS" and white decorative floral/botanical art (leaves, flowers, wheat stalks)
- **A back wall** (same cyan blue) that extends taller than the sides with a gentle slope
- **The header area** at the top of the back wall has TWO distinct zones:
  1. **Blue zone** (same cyan as everything else): "Wishing You and Your Family a HAPPY PASSOVER" in white text with decorative elements
  2. **White logo bar** sitting ON TOP of the blue: A white strip with brand logos/names - KEDEM, GEFEN, BARTENURA, Primavera, MANISCHEWITZ

### The exact cyan/blue color

The blue used across the entire display is a bright cyan/teal: approximately `#00a3c7` or `#00b4d8`. Look at the reference photos and match it. All panels (sides, back, strips) use this SAME blue.

### Files to modify for textures

**`lib/textureFactory.ts`** - This is where all canvas textures are generated. Four functions:

1. **`createStripTexture()`** (used by front fascia strips)
   - Currently: plain colored strip with simple wave lines and repeating text
   - Should match: Cyan strip with "ALL YOUR HOLIDAY NEEDS" in bold white, with small decorative floral/leaf motifs and dot separators between text repetitions. Reference shows delicate white botanical elements (leaves, small flowers, star patterns) between the text

2. **`createBrandedPanelTexture()`** (used by side panels on full pallet mode)
   - Currently: random circles/dots with centered text
   - Should match: Cyan background with large "ALL YOUR HOLIDAY NEEDS" in bold white, with elegant white botanical/floral artwork (wheat stalks, leaves, flowers, decorative flourishes). The text is stacked vertically and the art fills the remaining space tastefully

3. **`createHeaderTexture()`** (used by the header overlay on back wall)
   - Currently: white background, blue text, simple border
   - Should match: The header has "Wishing You and Your Family" in smaller italic text, then "HAPPY PASSOVER" in large bold text below it, all in WHITE on the CYAN background (not white bg with blue text - it's the reverse). This texture should use the cyan as the background since it overlays the blue back wall
   - **IMPORTANT**: Above the Passover text, there needs to be a WHITE logo bar with the brand names: KEDEM, GEFEN, BARTENURA, Primavera/Prigat, MANISCHEWITZ. Since we can't load actual logo images, render these brand names in a white strip at the top in their approximate brand styles/colors

4. **`getProductLabelTexture()`** - Leave as-is, this is fine

### Side panel texture - adding art to the trapezoid geometry

The side panels currently use plain `meshStandardMaterial` with a flat color (no texture). To add the branded art you have two options:

**Option A (preferred):** Add UV coordinates to the `sidePanelGeo` BufferGeometry in `DisplayStructure.tsx` so a texture can be mapped to the outer face. Then swap the plain material for a textured one. You CAN add UV attributes to the geometry - just don't change vertex positions or face indices.

**Option B:** Overlay a thin textured plane on the outer face of each side panel (add a new mesh element in DisplayStructure.tsx positioned just outside the panel surface).

The art should show "ALL YOUR HOLIDAY NEEDS" in large stacked white text with floral/botanical decorative elements, matching the reference photos.

### Header structure - two zones

Currently `DisplayStructure.tsx` has the header text as a thin overlay on the back wall. The header area needs TWO visual parts:
1. The "Wishing You and Your Family / HAPPY PASSOVER" text is ON the blue back wall (part of the cyan surface, rendered via the header texture)
2. A separate WHITE strip on top with brand logos/names

To do this:
- Modify the `HeaderTopper` component to render the cyan Passover text
- Add a new white box mesh on top for the logo bar in `DisplayStructure.tsx`
- **You CAN add new mesh elements to DisplayStructure.tsx** as long as you don't change existing geometry positions/sizes
- The white logo bar sits at the very top, above the cyan "Happy Passover" area

---

## Part 2: UI/UX Redesign

The current UI works but needs design polish. The functionality is complete - you are ONLY improving the visual design and layout.

### Current layout (in `AppShell.tsx`)
```
Header (title, project name, save/export buttons)
Two-column: [320px sidebar | main editor]
  Sidebar: Customer selector buttons, Product catalog with search
  Editor: Wall tabs (Front/Left/Right/Back) + 2D/3D toggle, then ShelfGrid or 3D scene
```

### What to improve

1. **Overall visual design** - Make it look more professional and polished. Consider:
   - Better typography hierarchy
   - More refined spacing and padding
   - Subtle shadows, borders, and depth
   - A cohesive color palette (the Kayco brand cyan from the pallet could influence the UI)
   - Modern, clean aesthetic

2. **Header** - Currently functional but plain. Make the toolbar layout cleaner

3. **Customer selector** - Currently flat buttons in a row. Could be nicer (dropdown, segmented control, cards with logos, etc.)

4. **Product catalog** - The sidebar product list with search and category filter. Make the cards more scannable and appealing

5. **Wall tabs** - The front/left/right/back tab switcher. Consider a more intuitive wall selector (maybe a mini pallet diagram?)

6. **2D/3D toggle** - Works fine, just polish the styling

7. **ShelfGrid (2D editor)** - The main grid where products get dragged. Make it clear, readable, and satisfying to use

8. **3D preview container** - Just needs proper sizing and a nice loading state

9. **Responsive behavior** - Mobile should be usable

### Files you can modify for UI
- `components/layout/AppShell.tsx` - Main layout and all UI chrome
- `components/catalog/ProductCatalog.tsx` - Product list
- `components/catalog/ProductCard.tsx` - Product card in catalog
- `components/editor/ShelfGrid.tsx` - 2D grid editor
- `app/globals.css` - Global styles, CSS variables
- `app/layout.tsx` - Fonts, metadata
- `types/ui.ts` - UI types if needed

### What NOT to touch in UI
- Don't change the drag-drop behavior or placement logic
- Don't change store subscriptions or state management patterns
- Don't change the `onPlace`, `onDeletePlacement`, `onSelectPlacement` callback signatures
- Don't change the 3D scene components or how Scene3DView is loaded
- Don't change keyboard shortcuts or export functionality
- Don't add new dependencies without good reason

---

## Reference Images

All in `reference/` directory:
- `HALF_PASS26 Large.png` - Front view of half pallet
- `HALF_PASS26_L Large.png` - Left/rear angle showing side panel + back
- `HALF_PASS26_R Large.png` - Right/rear angle showing side panel + back
- `FULL_PASS26 Large.png` - Front view of full pallet
- `FULL_PASS26_BCK Large.png` - Back view of full pallet
- `FULL_PASS26_R Large.png` - Right side of full pallet

---

## Summary of exact visual elements from reference

| Element | Color | Text | Art |
|---------|-------|------|-----|
| Side panels | Cyan (~#00a3c7) | "ALL YOUR HOLIDAY NEEDS" large stacked white | White botanical - leaves, wheat, flowers, stars |
| Back wall | Same cyan | None visible (products in front) | Same botanical pattern |
| Front strips | Same cyan | "ALL YOUR HOLIDAY NEEDS" repeating white | Small botanical motifs between text |
| Header text area | Same cyan | "Wishing You and Your Family a HAPPY PASSOVER" white | Floral decorations |
| Logo bar (very top) | White (#ffffff) | "KEDEM GEFEN BARTENURA [Primavera] MANISCHEWITZ" | Brand names in their brand colors |
