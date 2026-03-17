"use client";

import { Suspense, useMemo } from "react";
import { Edges, useGLTF } from "@react-three/drei";
import { MeshStandardMaterial, Box3, Vector3, Mesh } from "three";

import { getPlacementTransform } from "@/lib/gridMath";
import { getProductLabelTexture } from "@/lib/textureFactory";
import { usePlacementStore } from "@/stores/usePlacementStore";
import type { PalletConfig } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

/* ── GLB Model sub-component ──────────────────────────────────────────────── */

type Size3 = readonly [number, number, number] | [number, number, number];

function GLBModel({
  url,
  targetSize,
  selected,
  onClick,
}: {
  url: string;
  targetSize: Size3;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    // Measure the model's bounding box
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);

    // Scale to fit the target dimensions (product dimensions in inches)
    const scaleX = targetSize[0] / (size.x || 1);
    const scaleY = targetSize[1] / (size.y || 1);
    const scaleZ = targetSize[2] / (size.z || 1);
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
    clone.scale.setScalar(uniformScale);

    // Center the model at origin
    const scaledBox = new Box3().setFromObject(clone);
    const center = new Vector3();
    scaledBox.getCenter(center);
    clone.position.sub(center);

    // Enable shadows on all meshes
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }, [scene, targetSize[0], targetSize[1], targetSize[2]]);

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(e as unknown as React.MouseEvent); }}>
      <primitive object={cloned} />
      {selected && (
        <mesh>
          <boxGeometry args={targetSize as [number, number, number]} />
          <meshBasicMaterial visible={false} />
          <Edges color="#edf7ff" threshold={15} />
        </mesh>
      )}
    </group>
  );
}

/* ── Fallback box (used while GLB loads or when no model) ─────────────────── */

function BoxProduct({
  product,
  size,
  selected,
  onClick,
}: {
  product: Product;
  size: Size3;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
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
        onClick(event as unknown as React.MouseEvent);
      }}
      receiveShadow
    >
      <boxGeometry args={size as [number, number, number]} />
      {selected ? <Edges color="#edf7ff" threshold={15} /> : null}
    </mesh>
  );
}

/* ── Main exported component ──────────────────────────────────────────────── */

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

  const handleClick = () => selectPlacement(placement.id);

  return (
    <group position={transform.position} rotation={transform.rotation}>
      {product.modelUrl ? (
        <Suspense
          fallback={
            <BoxProduct
              product={product}
              size={transform.size}
              selected={selected}
              onClick={handleClick}
            />
          }
        >
          <GLBModel
            url={product.modelUrl}
            targetSize={transform.size}
            selected={selected}
            onClick={handleClick}
          />
        </Suspense>
      ) : (
        <BoxProduct
          product={product}
          size={transform.size}
          selected={selected}
          onClick={handleClick}
        />
      )}
    </group>
  );
}
