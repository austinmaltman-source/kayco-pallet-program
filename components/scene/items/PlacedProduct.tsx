"use client";

import { Edges } from "@react-three/drei";

import { getPlacementTransform } from "@/lib/gridMath";
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

  return (
    <mesh
      castShadow
      onClick={(event) => {
        event.stopPropagation();
        selectPlacement(placement.id);
      }}
      position={transform.position}
      receiveShadow
      rotation={transform.rotation}
    >
      <boxGeometry args={transform.size} />
      <meshStandardMaterial
        color={product.color}
        emissive={selected ? "#7db2e3" : "#000000"}
        emissiveIntensity={selected ? 0.4 : 0}
        roughness={0.72}
      />
      {selected ? <Edges color="#edf7ff" threshold={15} /> : null}
    </mesh>
  );
}
