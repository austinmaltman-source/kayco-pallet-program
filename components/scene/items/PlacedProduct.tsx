"use client";

import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { MeshStandardMaterial } from "three";

import { getPlacementTransform } from "@/lib/gridMath";
import { getProductLabelTexture } from "@/lib/textureFactory";
import { usePlacementStore } from "@/stores/usePlacementStore";
import type { PalletConfig } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

export function PlacedProduct({
  pallet,
  placement,
  product,
}: {
  pallet: PalletConfig;
  placement: PlacedItem;
  product: Product;
}) {
  const selectedPlacementId = usePlacementStore((state) => state.selectedPlacementId);
  const selectPlacement = usePlacementStore((state) => state.selectPlacement);
  const transform = getPlacementTransform(pallet, placement, product);
  const selected = selectedPlacementId === placement.id;

  // Multi-material: label on front face (+Z), solid color on other faces
  // BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
  const materials = useMemo(() => {
    const sideMat = new MeshStandardMaterial({
      color: product.color,
      roughness: 0.72,
    });
    const labelTexture = getProductLabelTexture(product);
    const frontMat = new MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.65,
    });
    return [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
  }, [product]);

  return (
    <mesh
      castShadow
      material={materials}
      onClick={(event) => {
        event.stopPropagation();
        selectPlacement(placement.id);
      }}
      position={transform.position}
      receiveShadow
      rotation={transform.rotation}
    >
      <boxGeometry args={transform.size} />
      {selected ? <Edges color="#edf7ff" threshold={15} /> : null}
    </mesh>
  );
}
