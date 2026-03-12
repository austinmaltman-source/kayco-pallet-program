"use client";

import { useCallback, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Mesh } from "three";

import { getDisplayHeight, getTowerFootprint } from "@/lib/palletPresets";
import { detectPlacementConflict, getProductColSpan } from "@/lib/gridMath";
import { usePalletStore } from "@/stores/usePalletStore";
import { usePlacementStore } from "@/stores/usePlacementStore";
import { useProductStore } from "@/stores/useProductStore";
import { useUIStore } from "@/stores/useUIStore";
import type { WallFace } from "@/types/pallet";

/**
 * Invisible planes positioned in front of each shelf wall.
 * During drag, pointer events on these planes determine which wall
 * the user is targeting and which grid cell to snap to.
 */
export function DragReceiver() {
  const pallet = usePalletStore((state) => state.pallet);
  const products = useProductStore((state) => state.products);
  const placements = usePlacementStore((state) => state.placements);
  const placeProduct = usePlacementStore((state) => state.placeProduct);
  const draggingProductId = useUIStore((state) => state.draggingProductId);
  const setDropPreview = useUIStore((state) => state.setDropPreview);
  const setSelectedWall = useUIStore((state) => state.setSelectedWall);
  const setDraggingProductId = useUIStore((state) => state.setDraggingProductId);

  const tower = getTowerFootprint(pallet);
  const displayHeight = getDisplayHeight(pallet.display);
  const towerY = pallet.base.height + displayHeight / 2 + 0.6;

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const draggingProduct = draggingProductId ? productMap.get(draggingProductId) ?? null : null;

  const wallConfigs = useMemo(() => {
    const faces: { face: WallFace; position: [number, number, number]; rotation: [number, number, number]; width: number }[] = [];

    const wallDefs: { face: WallFace; pos: [number, number, number]; rot: [number, number, number]; w: number }[] = [
      { face: "front", pos: [0, towerY, tower.depth / 2 + 2], rot: [0, 0, 0], w: tower.width },
      { face: "back", pos: [0, towerY, -tower.depth / 2 - 2], rot: [0, Math.PI, 0], w: tower.width },
      { face: "left", pos: [-tower.width / 2 - 2, towerY, 0], rot: [0, Math.PI / 2, 0], w: tower.depth },
      { face: "right", pos: [tower.width / 2 + 2, towerY, 0], rot: [0, -Math.PI / 2, 0], w: tower.depth },
    ];

    for (const def of wallDefs) {
      const wall = pallet.display.walls[def.face];
      if (wall.wallType === "shelves" && wall.enabled) {
        faces.push({ face: def.face, position: def.pos, rotation: def.rot, width: def.w });
      }
    }

    return faces;
  }, [pallet, tower, towerY]);

  const handlePointerMove = useCallback(
    (face: WallFace, localX: number, localY: number, planeWidth: number) => {
      if (!draggingProduct) return;

      const wall = pallet.display.walls[face];
      const cols = wall.gridColumns;
      const rows = pallet.display.shelfRows;

      // Map local coordinates to grid cell
      // localX ranges from -planeWidth/2 to +planeWidth/2
      // localY ranges from -displayHeight/2 to +displayHeight/2
      const normalizedX = (localX + planeWidth / 2) / planeWidth;
      const normalizedY = (localY + displayHeight / 2) / displayHeight;

      const gridCol = Math.max(0, Math.min(cols - 1, Math.floor(normalizedX * cols)));
      const shelfRow = Math.max(0, Math.min(rows - 1, Math.floor(normalizedY * rows)));

      const colSpan = getProductColSpan(draggingProduct, pallet, face);
      const clampedCol = Math.min(gridCol, cols - colSpan);

      const conflict = detectPlacementConflict(placements, {
        wall: face,
        shelfRow,
        gridCol: clampedCol,
        colSpan,
      });

      setSelectedWall(face);
      setDropPreview({
        wall: face,
        shelfRow,
        gridCol: clampedCol,
        valid: !conflict,
      });
    },
    [draggingProduct, pallet, placements, displayHeight, setDropPreview, setSelectedWall],
  );

  const handlePointerUp = useCallback(
    (face: WallFace, localX: number, localY: number, planeWidth: number) => {
      if (!draggingProduct) return;

      const wall = pallet.display.walls[face];
      const cols = wall.gridColumns;
      const rows = pallet.display.shelfRows;

      const normalizedX = (localX + planeWidth / 2) / planeWidth;
      const normalizedY = (localY + displayHeight / 2) / displayHeight;

      const gridCol = Math.max(0, Math.min(cols - 1, Math.floor(normalizedX * cols)));
      const shelfRow = Math.max(0, Math.min(rows - 1, Math.floor(normalizedY * rows)));

      const colSpan = getProductColSpan(draggingProduct, pallet, face);
      const clampedCol = Math.min(gridCol, cols - colSpan);

      placeProduct({
        pallet,
        product: draggingProduct,
        wall: face,
        shelfRow,
        gridCol: clampedCol,
      });

      setDropPreview(null);
      setDraggingProductId(null);
    },
    [draggingProduct, pallet, displayHeight, placeProduct, setDropPreview, setDraggingProductId],
  );

  if (!draggingProduct) return null;

  return (
    <group>
      {wallConfigs.map(({ face, position, rotation, width }) => (
        <mesh
          key={face}
          position={position}
          rotation={rotation}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.point) {
              // Get local coordinates on the plane
              const mesh = e.object as Mesh;
              const localPoint = mesh.worldToLocal(e.point.clone());
              handlePointerMove(face, localPoint.x, localPoint.y, width);
            }
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (e.point) {
              const mesh = e.object as Mesh;
              const localPoint = mesh.worldToLocal(e.point.clone());
              handlePointerUp(face, localPoint.x, localPoint.y, width);
            }
          }}
        >
          <planeGeometry args={[width + 4, displayHeight + 4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
