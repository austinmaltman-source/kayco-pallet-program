"use client";

import { getPlacementTransform, getProductColSpan } from "@/lib/gridMath";
import type { PalletConfig } from "@/types/pallet";
import type { Product } from "@/types/product";

export function ProductGhost({
  pallet,
  product,
  shelfRow,
  gridCol,
  wall,
  valid,
}: {
  pallet: PalletConfig;
  product: Product;
  shelfRow: number;
  gridCol: number;
  wall: "front" | "back" | "left" | "right";
  valid: boolean;
}) {
  const placement = {
    id: "ghost",
    productId: product.id,
    wall,
    shelfRow,
    gridCol,
    colSpan: getProductColSpan(product, pallet, wall),
    rotation: 0,
    quantity: 1,
    displayMode: "face-out" as const,
  };
  const transform = getPlacementTransform(pallet, placement, product);

  return (
    <mesh position={transform.position} rotation={transform.rotation}>
      <boxGeometry args={transform.size} />
      <meshStandardMaterial
        color={valid ? "#4ab08c" : "#d95c58"}
        opacity={0.45}
        roughness={0.5}
        transparent
      />
    </mesh>
  );
}
