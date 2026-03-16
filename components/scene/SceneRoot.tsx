"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { usePalletStore } from "@/stores/usePalletStore";
import { usePlacementStore } from "@/stores/usePlacementStore";
import { useProductStore } from "@/stores/useProductStore";
import { useUIStore } from "@/stores/useUIStore";

import { CameraController } from "./CameraController";
import { GridFloor } from "./GridFloor";
import { SceneLighting } from "./SceneLighting";
import { SceneOverlay } from "./SceneOverlay";
import { PalletBase } from "./pallet/PalletBase";
import { DisplayStructure } from "./pallet/DisplayStructure";
import { PlacedProduct } from "./items/PlacedProduct";

export function SceneRoot() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const pallet = usePalletStore((s) => s.pallet);
  const placements = usePlacementStore((s) => s.placements);
  const products = useProductStore((s) => s.products);
  const cameraView = useUIStore((s) => s.cameraView);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      onWheel={(e) => e.stopPropagation()}
    >
      <Canvas
        camera={{ fov: 35, far: 500, near: 1, position: [80, 65, 80] }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: SRGBColorSpace,
        }}
        shadows
        style={{ background: "linear-gradient(180deg, #e8e2d6 0%, #d8d0c0 100%)" }}
      >
        <Suspense fallback={null}>
          <SceneLighting />
          <CameraController
            controlsRef={controlsRef}
            pallet={pallet}
            targetView={cameraView}
          />
          <group>
            <PalletBase pallet={pallet} />
            <DisplayStructure pallet={pallet} />
            {placements.map((placement) => {
              const product = productMap.get(placement.productId);
              if (!product) return null;
              return (
                <PlacedProduct
                  key={placement.id}
                  pallet={pallet}
                  placement={placement}
                  product={product}
                />
              );
            })}
          </group>
          <GridFloor />
        </Suspense>
      </Canvas>
      <SceneOverlay />
    </div>
  );
}
