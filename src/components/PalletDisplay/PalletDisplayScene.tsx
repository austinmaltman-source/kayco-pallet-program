import React, { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { PalletDisplayProps } from '../../types';
import { useTierConfig } from '../../hooks/useTierConfig';
import { useCameraPresets } from '../../hooks/useCameraPresets';
import { Pallet } from './Pallet';
import { DisplayStructure } from './DisplayStructure';
import { RetailEnvironment } from './RetailEnvironment';
import { PlacedProducts } from './PlacedProducts';
import { SandboxPhysics } from './physics/SandboxPhysics';
import { FixedColliders } from './physics/FixedColliders';
import { DragManager } from './physics/DragManager';
import { useDisplayStore } from '../../stores/display-store';

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
  selectedProductId = null,
  selectedProductIds,
  onProductClick,
  onRotateProduct,
  onDeleteProduct,
  autoRotate = false,
  cameraPreset,
  showHeader = true,
  environment = 'retail',
}) => {
  const isHalf = palletType === 'half';
  const effectiveDimensions = isHalf
    ? { ...palletDimensions, depth: palletDimensions.depth / 2 }
    : palletDimensions;

  const tiers = useTierConfig(tierCount, maxDisplayHeight, palletType);

  const cameraResetToken = useDisplayStore((s) => s.cameraResetToken);
  const { isAnimating } = useCameraPresets(cameraPreset, cameraResetToken);
  const isDragging3D = useDisplayStore((s) => s.isDragging3D);

  // Kayco PalletConfig for half pallet visuals
  const kaycoPallet = useMemo(() => {
    if (!isHalf) return null;
    return createPalletConfig('half', '48x40');
  }, [isHalf]);

  return (
    <>
      <RetailEnvironment environmentType={environment} />

      <SandboxPhysics>
      <DragManager maxDisplayHeight={maxDisplayHeight}>
      <group position={[0, 0, 0]}>
        <FixedColliders
          tiers={tiers}
          palletType={palletType}
          palletDimensions={effectiveDimensions}
          maxDisplayHeight={maxDisplayHeight}
        />
        {isHalf && kaycoPallet ? (
          <>
            {/* Kayco half pallet visuals */}
            <KaycoPalletBase pallet={kaycoPallet} />
            <KaycoDisplayStructure pallet={kaycoPallet} />
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
              showHeader={showHeader}
            />
          </>
        )}

        <PlacedProducts
          products={placedProducts}
          tiers={tiers}
          palletType={palletType}
          palletDimensions={effectiveDimensions}
          selectedProductId={selectedProductId}
          selectedProductIds={selectedProductIds}
          onProductClick={onProductClick}
          onRotateProduct={onRotateProduct}
          onDeleteProduct={onDeleteProduct}
        />
      </group>
      </DragManager>
      </SandboxPhysics>

      <OrbitControls
        makeDefault
        enabled={!isAnimating && !isDragging3D}
        minDistance={36}
        maxDistance={180}
        minPolarAngle={10 * (Math.PI / 180)}
        maxPolarAngle={85 * (Math.PI / 180)}
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        target={[0, 24, 0]}
      />
    </>
  );
};
