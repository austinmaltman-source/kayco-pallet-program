// @ts-nocheck — 3D scene not active in current layout; kept for future use
"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { CameraController } from "@/components/scene/CameraController";
import { ExportCapture } from "@/components/scene/ExportCapture";
import { GridFloor } from "@/components/scene/GridFloor";
import { DragReceiver } from "@/components/scene/interaction/DragReceiver";
import { PlacedProduct } from "@/components/scene/items/PlacedProduct";
import { ProductGhost } from "@/components/scene/items/ProductGhost";
import { DisplayStructure } from "@/components/scene/pallet/DisplayStructure";
import { PalletBase } from "@/components/scene/pallet/PalletBase";
import { detectPlacementConflict, getDropCellFromPoint, getProductColSpan } from "@/lib/gridMath";
import { usePalletStore } from "@/stores/usePalletStore";
import { usePlacementStore } from "@/stores/usePlacementStore";
import { useProductStore } from "@/stores/useProductStore";
import { useUIStore } from "@/stores/useUIStore";

export function SceneRoot() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const pallet = usePalletStore((state) => state.pallet);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const selectedWall = useUIStore((state) => state.selectedWall);
  const draggingProductId = useUIStore((state) => state.draggingProductId);
  const dropPreview = useUIStore((state) => state.dropPreview);
  const setDropPreview = useUIStore((state) => state.setDropPreview);
  const setDraggingProductId = useUIStore((state) => state.setDraggingProductId);
  const placements = usePlacementStore((state) => state.placements);
  const placeProduct = usePlacementStore((state) => state.placeProduct);
  const selectPlacement = usePlacementStore((state) => state.selectPlacement);
  const products = useProductStore((state) => state.products);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const draggingProduct = draggingProductId ? productMap.get(draggingProductId) ?? null : null;
  const shelfWall = pallet.display.walls[selectedWall];

  return (
    <div
      className="h-full w-full"
      onDragLeave={() => setDropPreview(null)}
      onDragOver={(event) => {
        if (!draggingProduct || shelfWall.wallType !== "shelves") {
          return;
        }

        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const cell = getDropCellFromPoint({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
          width: bounds.width,
          height: bounds.height,
          columns: shelfWall.gridColumns,
          rows: pallet.display.shelfRows,
        });

        if (!cell.valid) {
          setDropPreview({
            wall: selectedWall,
            shelfRow: 0,
            gridCol: 0,
            valid: false,
          });
          return;
        }

        const colSpan = getProductColSpan(draggingProduct, pallet, selectedWall);
        const clampedCol = Math.min(cell.gridCol, shelfWall.gridColumns - colSpan);
        const conflict = detectPlacementConflict(placements, {
          wall: selectedWall,
          shelfRow: cell.shelfRow,
          gridCol: clampedCol,
          colSpan,
        });

        setDropPreview({
          wall: selectedWall,
          shelfRow: cell.shelfRow,
          gridCol: clampedCol,
          valid: !conflict,
        });
      }}
      onDrop={(event) => {
        event.preventDefault();

        if (!draggingProduct || !dropPreview?.valid || shelfWall.wallType !== "shelves") {
          setDropPreview(null);
          setDraggingProductId(null);
          return;
        }

        placeProduct({
          pallet,
          product: draggingProduct,
          wall: dropPreview.wall,
          shelfRow: dropPreview.shelfRow,
          gridCol: dropPreview.gridCol,
        });
        setDropPreview(null);
        setDraggingProductId(null);
      }}
    >
      <Canvas
        camera={{ fov: 34, position: [86, 70, 88] }}
        dpr={[1, 1.8]}
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => {
          setActiveView("isometric");
          selectPlacement(null);
        }}
        shadows
      >
        <color args={["#dde4e7"]} attach="background" />
        <fog args={["#dde4e7", 110, 230]} attach="fog" />

        <ambientLight intensity={0.45} />
        <hemisphereLight args={["#f7fafb", "#a39d92", 0.8]} />
        <directionalLight
          castShadow
          intensity={1.7}
          position={[52, 88, 42]}
          shadow-mapSize-height={2048}
          shadow-mapSize-width={2048}
        />

        <Suspense fallback={null}>
          <Environment preset="warehouse" />
        </Suspense>

        <GridFloor />
        <PalletBase pallet={pallet} />
        <DisplayStructure pallet={pallet} />
        {placements.map((placement) => {
          const product = productMap.get(placement.productId);
          return product ? (
            <PlacedProduct
              key={placement.id}
              pallet={pallet}
              placement={placement}
              product={product}
            />
          ) : null;
        })}
        {draggingProduct && dropPreview ? (
          <ProductGhost
            gridCol={dropPreview.gridCol}
            pallet={pallet}
            product={draggingProduct}
            shelfRow={dropPreview.shelfRow}
            valid={dropPreview.valid}
            wall={dropPreview.wall}
          />
        ) : null}

        <ContactShadows
          blur={2.4}
          far={80}
          opacity={0.32}
          position={[0, 0.05, 0]}
          resolution={1024}
          scale={120}
        />

        <OrbitControls
          ref={controlsRef}
          dampingFactor={0.08}
          enableDamping
          maxDistance={170}
          maxPolarAngle={Math.PI / 2.06}
          minDistance={48}
        />
        <DragReceiver />
        <CameraController controlsRef={controlsRef} pallet={pallet} />
        <ExportCapture controlsRef={controlsRef} pallet={pallet} />
      </Canvas>
    </div>
  );
}
