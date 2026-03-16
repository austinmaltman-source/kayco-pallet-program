"use client";

import { useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";

import { WALL_FACES } from "@/lib/constants";
import { SLOPE_DROP, getTowerFootprint } from "@/lib/palletPresets";
import { createBrandedPanelTexture } from "@/lib/textureFactory";
import type { PalletConfig } from "@/types/pallet";

import { BrandedPanel } from "./BrandedPanel";
import { HeaderTopper } from "./HeaderTopper";
import { ShelfWall } from "./ShelfWall";
import { StripDivider } from "./StripDivider";

const CARDBOARD = "#c8b898";
const CARDBOARD_LIGHT = "#d4c4a8";

export function DisplayStructure({ pallet }: { pallet: PalletConfig }) {
  const tower = getTowerFootprint(pallet);
  const baseY = pallet.base.height + 0.6;
  const { header } = pallet.display;
  const { shelfRows, rowHeight, stripHeight, wallThickness } = pallet.display;
  const halfW = tower.width / 2;
  const halfD = tower.depth / 2;
  const isHalf = pallet.type === "half";

  const platformY = baseY + 0.25;
  const topOfShelves = 2 + shelfRows * (rowHeight + stripHeight) - stripHeight;

  // Half pallet: side panels reach just above the 4th strip lip, then gentle slope
  const lip = stripHeight * 0.5;
  const sidePanelHeight = 2 + (shelfRows - 1) * (rowHeight + stripHeight) + lip + 0.25;
  const slopeRise = 3;
  const backHeight = sidePanelHeight + slopeRise;

  // Single trapezoidal side panel: sidePanelHeight at front, backHeight at back
  const positions = useMemo(() => {
    const ht = wallThickness / 2;
    return new Float32Array([
      -ht, 0, halfD,                  // 0: front-bottom-outer
       ht, 0, halfD,                  // 1: front-bottom-inner
      -ht, sidePanelHeight, halfD,    // 2: front-top-outer
       ht, sidePanelHeight, halfD,    // 3: front-top-inner
      -ht, 0, -halfD,                 // 4: back-bottom-outer
       ht, 0, -halfD,                 // 5: back-bottom-inner
      -ht, backHeight, -halfD,        // 6: back-top-outer
       ht, backHeight, -halfD,        // 7: back-top-inner
    ]);
  }, [wallThickness, halfD, sidePanelHeight, backHeight]);

  const indices = useMemo(() => [
    // Bottom
    0, 4, 5, 0, 5, 1,
    // Outer face (-ht)
    0, 2, 6, 0, 6, 4,
    // Inner face (+ht)
    1, 5, 7, 1, 7, 3,
    // Front edge
    0, 1, 3, 0, 3, 2,
    // Back edge
    4, 6, 7, 4, 7, 5,
    // Top slope
    2, 3, 7, 2, 7, 6,
  ], []);

  const leftSidePanelGeo = useMemo(() => {
    if (!isHalf) return null;
    const geo = new BufferGeometry();
    const sH = sidePanelHeight / backHeight;
    const uvs = new Float32Array([
      0, 0, // 0
      1, 0, // 1
      0, sH, // 2
      1, sH, // 3
      1, 0, // 4
      0, 0, // 5
      1, 1, // 6
      0, 1, // 7
    ]);
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [isHalf, positions, indices, sidePanelHeight, backHeight]);

  const rightSidePanelGeo = useMemo(() => {
    if (!isHalf) return null;
    const geo = new BufferGeometry();
    const sH = sidePanelHeight / backHeight;
    const uvs = new Float32Array([
      1, 0, // 0
      0, 0, // 1
      1, sH, // 2
      0, sH, // 3
      0, 0, // 4
      1, 0, // 5
      0, 1, // 6
      1, 1, // 7
    ]);
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [isHalf, positions, indices, sidePanelHeight, backHeight]);

  const frontWall = pallet.display.walls.front;

  const leftTexture = useMemo(() => createBrandedPanelTexture(
    pallet.display.walls.left.stripText || "ALL YOUR HOLIDAY NEEDS",
    pallet.display.walls.left.backgroundColor || "#00a3c7",
    pallet.display.walls.left.stripColor || "#ffffff"
  ), [pallet.display.walls.left]);

  const rightTexture = useMemo(() => createBrandedPanelTexture(
    pallet.display.walls.right.stripText || "ALL YOUR HOLIDAY NEEDS",
    pallet.display.walls.right.backgroundColor || "#00a3c7",
    pallet.display.walls.right.stripColor || "#ffffff"
  ), [pallet.display.walls.right]);

  return (
    <group>
      {/* Base platform */}
      <mesh castShadow position={[0, platformY, 0]} receiveShadow>
        <boxGeometry args={[tower.width, 0.5, tower.depth]} />
        <meshStandardMaterial color={CARDBOARD} roughness={0.9} />
      </mesh>

      {isHalf ? (
        <>
          {/* Left side panel - single trapezoid piece */}
          {leftSidePanelGeo && (
            <mesh
              castShadow
              geometry={leftSidePanelGeo}
              position={[-halfW, baseY, 0]}
              receiveShadow
            >
              <meshStandardMaterial
                color="#ffffff"
                map={leftTexture}
                roughness={0.7}
                side={DoubleSide}
              />
            </mesh>
          )}

          {/* Right side panel - single trapezoid piece */}
          {rightSidePanelGeo && (
            <mesh
              castShadow
              geometry={rightSidePanelGeo}
              position={[halfW, baseY, 0]}
              receiveShadow
            >
              <meshStandardMaterial
                color="#ffffff"
                map={rightTexture}
                roughness={0.7}
                side={DoubleSide}
              />
            </mesh>
          )}

          {/* Back wall - one solid piece including header area */}
          {(() => {
            const totalBackH = backHeight + (header.enabled ? header.height : 0);
            return (
              <mesh castShadow position={[0, baseY + totalBackH / 2, -halfD]} receiveShadow>
                <boxGeometry args={[tower.width, totalBackH, wallThickness]} />
                <meshStandardMaterial color={pallet.display.walls.left.backgroundColor} roughness={0.7} />
              </mesh>
            );
          })()}

          {/* Interior shelves + front fascia strips */}
          {Array.from({ length: shelfRows }).map((_, row) => {
            const shelfY = baseY + 2 + row * (rowHeight + stripHeight);
            const lip = stripHeight * 0.5;
            const fullStripH = stripHeight + lip;
            const stripCenterY = shelfY - stripHeight + fullStripH / 2;
            const interiorW = tower.width - wallThickness * 2;
            const shelfDepth = tower.depth;

            return (
              <group key={row}>
                {/* Horizontal shelf board */}
                <mesh castShadow position={[0, shelfY, 0]} receiveShadow>
                  <boxGeometry args={[interiorW, 0.4, shelfDepth]} />
                  <meshStandardMaterial color={CARDBOARD} roughness={0.88} />
                </mesh>

                {/* Front fascia strip with lip above shelf */}
                <group position={[0, stripCenterY, halfD + 0.15]}>
                  <StripDivider
                    bgColor={frontWall.stripColor}
                    height={fullStripH}
                    text={frontWall.stripText}
                    width={tower.width}
                  />
                </group>
              </group>
            );
          })}

          {/* Header text printed on upper back wall */}
          {header.enabled && (
            <group position={[0, baseY + backHeight + header.height / 2, -halfD + wallThickness / 2 + 0.01]}>
              <HeaderTopper
                depth={0.02}
                height={header.height}
                label={header.label}
                subtitle="Wishing You and Your Family"
                width={tower.width}
              />
            </group>
          )}
        </>
      ) : (
        <>
          {/* Full pallet: per-wall rendering */}
          {WALL_FACES.map((face) => {
            const wallConfig = pallet.display.walls[face];
            if (!wallConfig.enabled) return null;

            if (wallConfig.wallType === "shelves") {
              return <ShelfWall key={face} face={face} pallet={pallet} />;
            }

            if (wallConfig.wallType === "branded-panel") {
              const wallWidth =
                face === "front" || face === "back" ? tower.width : tower.depth;
              const panelPos: [number, number, number] =
                face === "front"
                  ? [0, baseY + topOfShelves / 2, halfD]
                  : face === "back"
                    ? [0, baseY + topOfShelves / 2, -halfD]
                    : face === "left"
                      ? [-halfW, baseY + topOfShelves / 2, 0]
                      : [halfW, baseY + topOfShelves / 2, 0];
              const panelRot: [number, number, number] =
                face === "left" || face === "right"
                  ? [0, Math.PI / 2, 0]
                  : [0, 0, 0];

              return (
                <group key={face} position={panelPos} rotation={panelRot}>
                  <BrandedPanel
                    bgColor={wallConfig.backgroundColor}
                    height={topOfShelves}
                    text={wallConfig.stripText}
                    textColor={wallConfig.stripColor}
                    thickness={wallThickness}
                    width={wallWidth}
                  />
                </group>
              );
            }

            return null;
          })}

          {/* Full pallet header at back */}
          {header.enabled && (
            <group
              position={[0, baseY + topOfShelves + header.height / 2, -halfD]}
            >
              <HeaderTopper
                depth={wallThickness}
                height={header.height}
                label={header.label}
                subtitle="Wishing You and Your Family"
                width={tower.width}
              />
            </group>
          )}
        </>
      )}
    </group>
  );
}
