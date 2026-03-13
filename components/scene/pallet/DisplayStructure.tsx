// @ts-nocheck — 3D scene not active in current layout; kept for future use
"use client";

import { useMemo } from "react";

import { getDisplayHeight, getTowerFootprint } from "@/lib/palletPresets";
import { createBrandedPanelTexture, createHeaderTexture, createStripTexture } from "@/lib/textureFactory";
import { useUIStore } from "@/stores/useUIStore";
import type { PalletConfig, WallFace } from "@/types/pallet";

function GridOverlay({
  width,
  height,
  columns,
}: {
  width: number;
  height: number;
  columns: number;
}) {
  const verticals = useMemo(
    () =>
      Array.from({ length: columns + 1 }, (_, index) => -width / 2 + (width / columns) * index),
    [columns, width],
  );

  const horizontals = useMemo(
    () => Array.from({ length: 5 }, (_, index) => -height / 2 + (height / 4) * index),
    [height],
  );

  return (
    <group position={[0, 0, 0.82]}>
      {verticals.map((x) => (
        <mesh key={`v-${x}`} position={[x, 0, 0]}>
          <boxGeometry args={[0.18, height, 0.08]} />
          <meshBasicMaterial color="#b7d6f3" transparent opacity={0.5} />
        </mesh>
      ))}
      {horizontals.map((y) => (
        <mesh key={`h-${y}`} position={[0, y, 0]}>
          <boxGeometry args={[width, 0.18, 0.08]} />
          <meshBasicMaterial color="#b7d6f3" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ShelfWall({
  width,
  height,
  thickness,
  stripHeight,
  rowHeight,
  gridColumns,
  selected,
  showGrid,
  backgroundColor,
  stripColor,
  stripText,
  onSelect,
}: {
  width: number;
  height: number;
  thickness: number;
  stripHeight: number;
  rowHeight: number;
  gridColumns: number;
  selected: boolean;
  showGrid: boolean;
  backgroundColor: string;
  stripColor: string;
  stripText: string;
  onSelect: () => void;
}) {
  const stripPositions = useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => {
        const bottom = -height / 2 + 4;
        return bottom + rowHeight * (index + 1) + stripHeight * index + stripHeight / 2;
      }),
    [height, rowHeight, stripHeight],
  );

  const shelfPositions = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const bottom = -height / 2 + 4;
        return bottom + rowHeight / 2 + index * (rowHeight + stripHeight);
      }),
    [height, rowHeight, stripHeight],
  );

  const stripTexture = useMemo(
    () => createStripTexture(stripText || "All your holiday needs", stripColor),
    [stripText, stripColor],
  );

  return (
    <group>
      <mesh castShadow onClick={onSelect} receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color={backgroundColor} roughness={0.95} />
      </mesh>

      {shelfPositions.map((y) => (
        <mesh
          castShadow
          key={`shelf-${y}`}
          onClick={onSelect}
          position={[0, y, thickness / 2 + 0.38]}
          receiveShadow
        >
          <boxGeometry args={[width - 1.8, rowHeight, 0.48]} />
          <meshStandardMaterial color="#f9f0df" roughness={0.78} />
        </mesh>
      ))}

      {stripPositions.map((y) => (
        <mesh
          castShadow
          key={`strip-${y}`}
          onClick={onSelect}
          position={[0, y, thickness / 2 + 0.8]}
          receiveShadow
        >
          <boxGeometry args={[width + 0.3, stripHeight, 1.42]} />
          <meshStandardMaterial map={stripTexture} metalness={0.08} roughness={0.55} />
        </mesh>
      ))}

      <mesh onClick={onSelect} position={[0, 0, thickness / 2 + 0.7]}>
        <planeGeometry args={[width + 1, height + 1]} />
        <meshBasicMaterial
          color={selected ? "#97c0ea" : "#d7e6f3"}
          opacity={selected ? 0.11 : 0}
          transparent
        />
      </mesh>

      {showGrid ? <GridOverlay columns={gridColumns} height={height} width={width} /> : null}
    </group>
  );
}

function BrandedPanel({
  width,
  height,
  thickness,
  selected,
  backgroundColor,
  stripText,
  onSelect,
}: {
  width: number;
  height: number;
  thickness: number;
  selected: boolean;
  backgroundColor: string;
  stripText: string;
  onSelect: () => void;
}) {
  const panelTexture = useMemo(
    () => createBrandedPanelTexture(stripText || "All your holiday needs", backgroundColor),
    [stripText, backgroundColor],
  );

  return (
    <group>
      <mesh castShadow onClick={onSelect} receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color={backgroundColor} roughness={0.72} />
      </mesh>

      {/* Branded face overlay with texture */}
      <mesh onClick={onSelect} position={[0, 0, thickness / 2 + 0.12]}>
        <planeGeometry args={[width - 0.5, height - 0.5]} />
        <meshStandardMaterial map={panelTexture} roughness={0.65} />
      </mesh>

      <mesh onClick={onSelect} position={[0, 0, thickness / 2 + 0.55]}>
        <planeGeometry args={[width + 1, height + 1]} />
        <meshBasicMaterial
          color={selected ? "#97c0ea" : "#d7e6f3"}
          opacity={selected ? 0.12 : 0}
          transparent
        />
      </mesh>
    </group>
  );
}

function HeaderTopper({
  width,
  towerHeight,
  enabled,
  headerHeight,
  label,
}: {
  width: number;
  towerHeight: number;
  enabled: boolean;
  headerHeight: number;
  label: string;
}) {
  const headerTexture = useMemo(
    () => createHeaderTexture(label || "Holiday Program"),
    [label],
  );

  if (!enabled) {
    return null;
  }

  return (
    <group position={[0, towerHeight + headerHeight / 2 + 1.4, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width * 0.72, headerHeight, 1.4]} />
        <meshStandardMaterial color="#114a7d" roughness={0.6} />
      </mesh>
      {/* Front face with branded texture */}
      <mesh position={[0, 0, 0.72]}>
        <planeGeometry args={[width * 0.68, headerHeight * 0.85]} />
        <meshStandardMaterial map={headerTexture} roughness={0.5} />
      </mesh>
      {/* Back face */}
      <mesh position={[0, 0, -0.72]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width * 0.68, headerHeight * 0.85]} />
        <meshStandardMaterial map={headerTexture} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function DisplayStructure({ pallet }: { pallet: PalletConfig }) {
  const selectedWall = useUIStore((state) => state.selectedWall);
  const showGrid = useUIStore((state) => state.showGrid);
  const setSelectedWall = useUIStore((state) => state.setSelectedWall);

  const tower = getTowerFootprint(pallet);
  const wallHeight = getDisplayHeight(pallet.display);
  const towerY = pallet.base.height + wallHeight / 2 + 0.6;
  const headerEnabled = pallet.display.header.enabled;

  const wallTransforms = useMemo(
    () =>
      ({
        front: {
          position: [0, towerY, tower.depth / 2] as const,
          rotation: [0, 0, 0] as const,
          width: tower.width,
        },
        back: {
          position: [0, towerY, -tower.depth / 2] as const,
          rotation: [0, Math.PI, 0] as const,
          width: tower.width,
        },
        left: {
          position: [-tower.width / 2, towerY, 0] as const,
          rotation: [0, Math.PI / 2, 0] as const,
          width: tower.depth,
        },
        right: {
          position: [tower.width / 2, towerY, 0] as const,
          rotation: [0, -Math.PI / 2, 0] as const,
          width: tower.depth,
        },
      }) satisfies Record<WallFace, { position: readonly [number, number, number]; rotation: readonly [number, number, number]; width: number }>,
    [tower.depth, tower.width, towerY],
  );

  return (
    <group position={[0, 0, 0]}>
      <mesh castShadow position={[0, pallet.base.height + 0.65, 0]} receiveShadow>
        <boxGeometry args={[tower.width + 2, 1.3, tower.depth + 2]} />
        <meshStandardMaterial color="#d8c2a5" roughness={0.9} />
      </mesh>

      {(["front", "back", "left", "right"] as const).map((face) => {
        const wall = pallet.display.walls[face];

        if (!wall.enabled && wall.wallType === "open") {
          return null;
        }

        const transform = wallTransforms[face];

        return (
          <group key={face} position={transform.position} rotation={transform.rotation}>
            {wall.wallType === "shelves" ? (
              <ShelfWall
                backgroundColor={wall.backgroundColor}
                gridColumns={wall.gridColumns}
                height={wallHeight}
                onSelect={() => setSelectedWall(face)}
                rowHeight={pallet.display.rowHeight}
                selected={selectedWall === face}
                showGrid={showGrid && selectedWall === face}
                stripColor={wall.stripColor}
                stripHeight={pallet.display.stripHeight}
                stripText={wall.stripText}
                thickness={pallet.display.wallThickness}
                width={transform.width}
              />
            ) : (
              <BrandedPanel
                backgroundColor={wall.backgroundColor}
                height={wallHeight}
                onSelect={() => setSelectedWall(face)}
                selected={selectedWall === face}
                stripText={wall.stripText}
                thickness={pallet.display.wallThickness}
                width={transform.width}
              />
            )}
          </group>
        );
      })}

      {[
        [-tower.width / 2, pallet.base.height + wallHeight / 2 + 0.6, -tower.depth / 2],
        [-tower.width / 2, pallet.base.height + wallHeight / 2 + 0.6, tower.depth / 2],
        [tower.width / 2, pallet.base.height + wallHeight / 2 + 0.6, -tower.depth / 2],
        [tower.width / 2, pallet.base.height + wallHeight / 2 + 0.6, tower.depth / 2],
      ].map(([x, y, z]) => (
        <mesh castShadow key={`${x}-${z}`} position={[x, y, z]} receiveShadow>
          <boxGeometry args={[1.5, wallHeight + 0.4, 1.5]} />
          <meshStandardMaterial color="#c4b091" roughness={0.92} />
        </mesh>
      ))}

      <HeaderTopper
        enabled={headerEnabled}
        headerHeight={pallet.display.header.height}
        label={pallet.display.header.label}
        towerHeight={pallet.base.height + wallHeight}
        width={tower.width}
      />
    </group>
  );
}
