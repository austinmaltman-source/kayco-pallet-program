"use client";

import { useMemo } from "react";

import type { PalletConfig } from "@/types/pallet";

export function PalletBase({ pallet }: { pallet: PalletConfig }) {
  const { width, depth, height } = pallet.base;

  const topSlats = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const slatDepth = depth / 7;
        const gap = (depth - slatDepth * 5) / 6;

        return -depth / 2 + gap + slatDepth / 2 + index * (slatDepth + gap);
      }),
    [depth],
  );

  const bottomSlats = useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => {
        const slatDepth = depth / 5.6;
        const gap = (depth - slatDepth * 3) / 4;

        return -depth / 2 + gap + slatDepth / 2 + index * (slatDepth + gap);
      }),
    [depth],
  );

  const blocks = useMemo(
    () => [
      [-width / 2 + 6.2, height * 0.34, -depth / 2 + 6.2],
      [0, height * 0.34, -depth / 2 + 6.2],
      [width / 2 - 6.2, height * 0.34, -depth / 2 + 6.2],
      [-width / 2 + 6.2, height * 0.34, 0],
      [0, height * 0.34, 0],
      [width / 2 - 6.2, height * 0.34, 0],
      [-width / 2 + 6.2, height * 0.34, depth / 2 - 6.2],
      [0, height * 0.34, depth / 2 - 6.2],
      [width / 2 - 6.2, height * 0.34, depth / 2 - 6.2],
    ],
    [depth, height, width],
  );

  return (
    <group position={[0, 0, 0]}>
      <group>
        {topSlats.map((z) => (
          <mesh castShadow key={`top-${z}`} position={[0, height - 0.55, z]} receiveShadow>
            <boxGeometry args={[width, 1.1, depth / 7]} />
            <meshStandardMaterial color="#b07b49" roughness={0.92} />
          </mesh>
        ))}

        {bottomSlats.map((z) => (
          <mesh castShadow key={`bottom-${z}`} position={[0, 0.6, z]} receiveShadow>
            <boxGeometry args={[width, 1.2, depth / 5.6]} />
            <meshStandardMaterial color="#98683e" roughness={0.94} />
          </mesh>
        ))}

        {[-width / 2 + 7.5, 0, width / 2 - 7.5].map((x) => (
          <mesh castShadow key={`runner-${x}`} position={[x, height / 2, 0]} receiveShadow>
            <boxGeometry args={[4.4, height - 1.4, depth - 6.5]} />
            <meshStandardMaterial color="#8b5c37" roughness={0.96} />
          </mesh>
        ))}

        {blocks.map(([x, y, z]) => (
          <mesh castShadow key={`${x}-${z}`} position={[x, y, z]} receiveShadow>
            <boxGeometry args={[4.8, height * 0.68, 4.8]} />
            <meshStandardMaterial color="#835532" roughness={0.98} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
