import React, { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { PalletDisplayProps } from '../../types';
import { useTierConfig } from '../../hooks/useTierConfig';
import { useSlotInteraction } from '../../hooks/useSlotInteraction';
import { useCameraPresets } from '../../hooks/useCameraPresets';
import { Pallet } from './Pallet';
import { DisplayStructure } from './DisplayStructure';
import { RetailEnvironment } from './RetailEnvironment';
import { GhostProduct } from './GhostProduct';
import { PlacedProducts } from './PlacedProducts';
import { FreeformDropSurface } from './FreeformDropSurface';

// Kayco half pallet visual components
import { PalletBase as KaycoPalletBase } from '@/components/scene/pallet/PalletBase';
import { DisplayStructure as KaycoDisplayStructure } from '@/components/scene/pallet/DisplayStructure';
import { createPalletConfig } from '@/lib/palletPresets';

export const PalletDisplayScene: React.FC<PalletDisplayProps> = ({
  tierCount = 4,
  palletType = 'full',
  palletDimensions = { width: 48, depth: 40, height: 6 },
  maxDisplayHeight = 60,
  lipColor = '#3B7DD8',
  branding,
  placedProducts = [],
  ghostProduct = null,
  draggedCaseProduct = null,
  selectedProductId = null,
  hiddenProductId = null,
  onSlotClick,
  onSlotHover,
  onSlotHoverEnd,
  onProductClick,
  onRotateProduct,
  onDeleteProduct,
  onProductDragStart,
  onFreeformDrop,
  onFreeformDragCancel,
  validateFreeformDrop,
  autoRotate = false,
  cameraPreset,
  showSlotGrid = true,
  showHeader = true,
  environment = 'retail',
}) => {
  const isHalf = palletType === 'half';
  const effectiveDimensions = isHalf
    ? {
        ...palletDimensions,
        depth: palletDimensions.depth > 30 ? palletDimensions.depth / 2 : palletDimensions.depth,
      }
    : palletDimensions;

  const tiers = useTierConfig(tierCount, maxDisplayHeight, palletType);

  const {
    hoveredSlot,
    selectedSlot,
    handlePointerOver,
    handlePointerOut,
    handleClick,
  } = useSlotInteraction(onSlotClick, onSlotHover, onSlotHoverEnd);

  const { isAnimating } = useCameraPresets(cameraPreset);

  // Kayco PalletConfig for half pallet visuals
  const kaycoPallet = useMemo(() => {
    if (!isHalf) return null;
    return createPalletConfig('half', '48x40');
  }, [isHalf]);

  // Calculate ghost product position if needed
  const ghostPosition = useMemo(() => {
    if (!ghostProduct) return null;
    if (ghostProduct.worldPosition) return ghostProduct.worldPosition;

    const platformThickness = 1;
    const palletHeight = 6;

    for (const tier of tiers) {
      const gridSize = tier.slotGridSize;
      const frontTrayWidth = tier.width;
      const frontTrayDepth = tier.shelfDepth;
      const frontCols = Math.floor(frontTrayWidth / gridSize);
      const frontRows = Math.floor(frontTrayDepth / gridSize);
      const frontStartX = - (frontCols * gridSize) / 2 + gridSize / 2;
      const frontCenterZ = tier.depth / 2 - frontTrayDepth / 2;
      const frontStartZ = frontCenterZ - (frontRows * gridSize) / 2 + gridSize / 2;

      let slotIndex = 0;

      // Front tray
      for (let r = 0; r < frontRows; r++) {
        for (let c = 0; c < frontCols; c++) {
          if (`${tier.id}-${slotIndex}` === ghostProduct.slotId) {
            return [
              frontStartX + c * gridSize,
              palletHeight + tier.yOffset + platformThickness,
              frontStartZ + r * gridSize
            ] as [number, number, number];
          }
          slotIndex++;
        }
      }

      // Half pallets only have front slots
      if (isHalf) continue;

      // Back tray
      const backCenterZ = -tier.depth / 2 + frontTrayDepth / 2;
      const backStartZ = backCenterZ - (frontRows * gridSize) / 2 + gridSize / 2;
      for (let r = 0; r < frontRows; r++) {
        for (let c = 0; c < frontCols; c++) {
          if (`${tier.id}-${slotIndex}` === ghostProduct.slotId) {
            return [
              frontStartX + c * gridSize,
              palletHeight + tier.yOffset + platformThickness,
              backStartZ + r * gridSize
            ] as [number, number, number];
          }
          slotIndex++;
        }
      }

      // Left tray
      const sideTrayWidth = tier.shelfDepth;
      const sideTrayDepth = tier.depth - frontTrayDepth * 2;
      const sideCols = Math.floor(sideTrayWidth / gridSize);
      const sideRows = Math.floor(sideTrayDepth / gridSize);
      const leftCenterX = -tier.width / 2 + sideTrayWidth / 2;
      const leftStartX = leftCenterX - (sideCols * gridSize) / 2 + gridSize / 2;
      const sideStartZ = - (sideRows * gridSize) / 2 + gridSize / 2;

      for (let r = 0; r < sideRows; r++) {
        for (let c = 0; c < sideCols; c++) {
          if (`${tier.id}-${slotIndex}` === ghostProduct.slotId) {
            return [
              leftStartX + c * gridSize,
              palletHeight + tier.yOffset + platformThickness,
              sideStartZ + r * gridSize
            ] as [number, number, number];
          }
          slotIndex++;
        }
      }

      // Right tray
      const rightCenterX = tier.width / 2 - sideTrayWidth / 2;
      const rightStartX = rightCenterX - (sideCols * gridSize) / 2 + gridSize / 2;
      for (let r = 0; r < sideRows; r++) {
        for (let c = 0; c < sideCols; c++) {
          if (`${tier.id}-${slotIndex}` === ghostProduct.slotId) {
            return [
              rightStartX + c * gridSize,
              palletHeight + tier.yOffset + platformThickness,
              sideStartZ + r * gridSize
            ] as [number, number, number];
          }
          slotIndex++;
        }
      }
    }
    return null;
  }, [ghostProduct, tiers, isHalf]);

  return (
    <>
      <RetailEnvironment environmentType={environment} />

      <group position={[0, 0, 0]}>
        {isHalf && kaycoPallet ? (
          <>
            {/* Kayco half pallet visuals */}
            <KaycoPalletBase pallet={kaycoPallet} />
            <KaycoDisplayStructure pallet={kaycoPallet} />

            {/* Slot grid overlay from existing system (invisible structure, just interaction) */}
            <DisplayStructure
              tiers={tiers}
              palletType={palletType}
              lipColor={lipColor}
              branding={branding}
              showSlotGrid={showSlotGrid}
              showHeader={false}
              slotsOnly
              hoveredSlot={hoveredSlot}
              selectedSlot={selectedSlot}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={handleClick}
            />
          </>
        ) : (
          <>
            {/* Full pallet: original rendering */}
            <Pallet
              width={effectiveDimensions.width}
              depth={effectiveDimensions.depth}
              height={effectiveDimensions.height}
            />

            <DisplayStructure
              tiers={tiers}
              palletType={palletType}
              lipColor={lipColor}
              branding={branding}
              showSlotGrid={showSlotGrid}
              showHeader={showHeader}
              hoveredSlot={hoveredSlot}
              selectedSlot={selectedSlot}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={handleClick}
            />
          </>
        )}

        <PlacedProducts
          products={placedProducts}
          tiers={tiers}
          palletType={palletType}
          palletDimensions={effectiveDimensions}
          selectedProductId={selectedProductId}
          hiddenProductId={hiddenProductId}
          onProductClick={onProductClick}
          onRotateProduct={onRotateProduct}
          onDeleteProduct={onDeleteProduct}
          onProductDragStart={onProductDragStart}
        />

        {ghostProduct && ghostPosition && (
          <>
            <GhostProduct product={ghostProduct} position={ghostPosition} />
            {ghostProduct.suggestionMarkers?.map((marker, index) => (
              <mesh
                key={`${marker.message}-${index}`}
                position={[marker.position[0], marker.position[1] + 1.5, marker.position[2]]}
              >
                <sphereGeometry args={[0.4, 18, 18]} />
                <meshStandardMaterial
                  color="#2563EB"
                  emissive="#2563EB"
                  emissiveIntensity={0.5}
                  transparent
                  opacity={0.85}
                />
              </mesh>
            ))}
          </>
        )}

        <FreeformDropSurface
          draggedCaseProduct={draggedCaseProduct}
          palletDimensions={effectiveDimensions}
          onDrop={onFreeformDrop}
          onCancel={onFreeformDragCancel}
          validateDrop={validateFreeformDrop}
        />
      </group>

      <OrbitControls
        makeDefault
        enabled={!isAnimating && !draggedCaseProduct}
        minDistance={42}
        maxDistance={145}
        minPolarAngle={10 * (Math.PI / 180)}
        maxPolarAngle={85 * (Math.PI / 180)}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.75}
        enablePan={false}
        autoRotate={autoRotate}
        target={[0, 24, 0]}
      />
    </>
  );
};
