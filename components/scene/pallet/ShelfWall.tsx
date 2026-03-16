"use client";

import { useMemo } from "react";

import { StripDivider } from "./StripDivider";
import type { PalletConfig, WallFace } from "@/types/pallet";
import { getTowerFootprint } from "@/lib/palletPresets";

const SHELF_DEPTH = 12;
const CARDBOARD_COLOR = "#c8b898";
const CARDBOARD_LIGHT = "#d4c4a8";

interface ShelfWallProps {
  pallet: PalletConfig;
  face: WallFace;
}

export function ShelfWall({ pallet, face }: ShelfWallProps) {
  const tower = getTowerFootprint(pallet);
  const wallWidth = face === "front" || face === "back" ? tower.width : tower.depth;
  const { shelfRows, rowHeight, stripHeight, wallThickness } = pallet.display;
  const wallConfig = pallet.display.walls[face];
  const baseY = pallet.base.height + 0.6;

  // Top of all shelves (excluding top strip - slope starts here) relative to baseY
  const topOfShelves = 2 + shelfRows * (rowHeight + stripHeight) - stripHeight;

  // Calculate wall-face transform
  const wallTransform = useMemo(() => {
    const halfW = tower.width / 2;
    const halfD = tower.depth / 2;
    switch (face) {
      case "front":
        return { position: [0, 0, halfD] as const, rotation: [0, 0, 0] as const };
      case "back":
        return { position: [0, 0, -halfD] as const, rotation: [0, Math.PI, 0] as const };
      case "left":
        return { position: [-halfW, 0, 0] as const, rotation: [0, Math.PI / 2, 0] as const };
      case "right":
        return { position: [halfW, 0, 0] as const, rotation: [0, -Math.PI / 2, 0] as const };
    }
  }, [face, tower.width, tower.depth]);

  // Build shelf tiers
  const tiers = useMemo(() => {
    const result = [];
    for (let row = 0; row < shelfRows; row++) {
      const tierBaseY = baseY + 2 + row * (rowHeight + stripHeight);
      result.push({ row, y: tierBaseY });
    }
    return result;
  }, [shelfRows, rowHeight, stripHeight, baseY]);

  return (
    <group position={wallTransform.position} rotation={wallTransform.rotation}>
      {/* Full-height back panel (extends through slope area) */}
      <mesh
        castShadow
        position={[0, baseY + topOfShelves / 2, -(SHELF_DEPTH - wallThickness / 2)]}
        receiveShadow
      >
        <boxGeometry args={[wallWidth, topOfShelves, wallThickness]} />
        <meshStandardMaterial color={CARDBOARD_LIGHT} roughness={0.92} />
      </mesh>

      {tiers.map(({ row, y }) => (
        <group key={row}>
          {/* Shelf bottom (horizontal surface, recessed inward) */}
          <mesh
            castShadow
            position={[0, y, -SHELF_DEPTH / 2]}
            receiveShadow
          >
            <boxGeometry args={[wallWidth, 0.4, SHELF_DEPTH]} />
            <meshStandardMaterial color={CARDBOARD_COLOR} roughness={0.88} />
          </mesh>

          {/* Left side return (recessed inward) */}
          <mesh
            castShadow
            position={[-wallWidth / 2 + wallThickness / 2, y + rowHeight / 2, -SHELF_DEPTH / 2]}
            receiveShadow
          >
            <boxGeometry args={[wallThickness, rowHeight, SHELF_DEPTH]} />
            <meshStandardMaterial color={CARDBOARD_COLOR} roughness={0.92} />
          </mesh>

          {/* Right side return (recessed inward) */}
          <mesh
            castShadow
            position={[wallWidth / 2 - wallThickness / 2, y + rowHeight / 2, -SHELF_DEPTH / 2]}
            receiveShadow
          >
            <boxGeometry args={[wallThickness, rowHeight, SHELF_DEPTH]} />
            <meshStandardMaterial color={CARDBOARD_COLOR} roughness={0.92} />
          </mesh>

          {/* Strip divider at front face of shelf */}
          <group position={[0, y - stripHeight / 2, 0.15]}>
            <StripDivider
              bgColor={wallConfig.stripColor}
              height={stripHeight}
              text={wallConfig.stripText}
              width={wallWidth}
            />
          </group>
        </group>
      ))}

    </group>
  );
}
