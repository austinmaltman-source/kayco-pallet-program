import React, { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TierConfig, DisplayBranding, PalletType } from '../../types';
import { getCardboardMaterial } from './materials/cardboardMaterial';
import { ShelfLip } from './ShelfLip';

interface TierProps {
  config: TierConfig;
  palletType?: PalletType;
  lipColor?: string;
  branding?: DisplayBranding;
}

export const Tier: React.FC<TierProps> = ({
  config,
  palletType = 'full',
  lipColor,
  branding,
}) => {
  const isHalf = palletType === 'half';
  const cardboardMaterial = useMemo(() => getCardboardMaterial(), []);

  const platformThickness = 1;
  const wallThickness = 0.75;
  const shelfLipHeight = 1.4;

  // For half pallets: no inner column, just a front shelf area + branded sides + solid back
  const innerWidth = isHalf ? config.width : Math.max(2, config.width - config.shelfDepth * 2);
  const innerDepth = isHalf ? config.depth : Math.max(2, config.depth - config.shelfDepth * 2);

  // Materials for visual polish
  const edgeDarkeningMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#8B6914', transparent: true, opacity: 0.3, depthWrite: false }), []);
  const aoMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.15, depthWrite: false }), []);
  const brandedPanelMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: lipColor || '#1E3A8A',
    roughness: 0.7,
    metalness: 0.0,
  }), [lipColor]);

  return (
    <group position={[0, config.yOffset, 0]}>
      {/* Base Platform */}
      <RoundedBox
        args={[config.width, platformThickness, config.depth]}
        radius={0.2}
        smoothness={4}
        position={[0, platformThickness / 2, 0]}
        material={cardboardMaterial}
        castShadow
        receiveShadow
      />

      {/* Edge darkening on platform */}
      <mesh position={[0, platformThickness + 0.01, config.depth / 2 - 0.125]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[config.width, 0.25]} />
        <primitive object={edgeDarkeningMat} attach="material" />
      </mesh>
      <mesh position={[0, platformThickness + 0.01, -config.depth / 2 + 0.125]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[config.width, 0.25]} />
        <primitive object={edgeDarkeningMat} attach="material" />
      </mesh>
      <mesh position={[-config.width / 2 + 0.125, platformThickness + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[config.depth, 0.25]} />
        <primitive object={edgeDarkeningMat} attach="material" />
      </mesh>
      <mesh position={[config.width / 2 - 0.125, platformThickness + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[config.depth, 0.25]} />
        <primitive object={edgeDarkeningMat} attach="material" />
      </mesh>

      {isHalf ? (
        <>
          {/* === HALF PALLET STRUCTURE === */}
          {/* Solid back wall */}
          <RoundedBox
            args={[config.width, config.trayHeight, wallThickness]}
            radius={0.1}
            smoothness={4}
            position={[0, config.trayHeight / 2 + platformThickness, -config.depth / 2 + wallThickness / 2]}
            material={cardboardMaterial}
            castShadow
            receiveShadow
          />

          {/* Left branded side panel */}
          <mesh position={[-config.width / 2 + wallThickness / 2, config.trayHeight / 2 + platformThickness, 0]} castShadow receiveShadow>
            <boxGeometry args={[wallThickness, config.trayHeight, config.depth - wallThickness]} />
            <primitive object={brandedPanelMat} attach="material" />
          </mesh>

          {/* Right branded side panel */}
          <mesh position={[config.width / 2 - wallThickness / 2, config.trayHeight / 2 + platformThickness, 0]} castShadow receiveShadow>
            <boxGeometry args={[wallThickness, config.trayHeight, config.depth - wallThickness]} />
            <primitive object={brandedPanelMat} attach="material" />
          </mesh>

          {/* Front shelf lip only */}
          <group position={[0, platformThickness + shelfLipHeight / 2, config.depth / 2 - 0.21]}>
            <ShelfLip width={config.width} color={lipColor} text={branding?.lipText} textColor={branding?.lipTextColor} />
          </group>
        </>
      ) : (
        <>
          {/* === FULL PALLET STRUCTURE === */}
          {/* Hollow Center Column (4 thin walls) */}
          <RoundedBox
            args={[innerWidth, config.trayHeight, wallThickness]}
            radius={0.1}
            smoothness={4}
            position={[0, config.trayHeight / 2 + platformThickness, innerDepth / 2 - wallThickness / 2]}
            material={cardboardMaterial}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[innerWidth, config.trayHeight, wallThickness]}
            radius={0.1}
            smoothness={4}
            position={[0, config.trayHeight / 2 + platformThickness, -innerDepth / 2 + wallThickness / 2]}
            material={cardboardMaterial}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[wallThickness, config.trayHeight, innerDepth - wallThickness * 2]}
            radius={0.1}
            smoothness={4}
            position={[-innerWidth / 2 + wallThickness / 2, config.trayHeight / 2 + platformThickness, 0]}
            material={cardboardMaterial}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[wallThickness, config.trayHeight, innerDepth - wallThickness * 2]}
            radius={0.1}
            smoothness={4}
            position={[innerWidth / 2 - wallThickness / 2, config.trayHeight / 2 + platformThickness, 0]}
            material={cardboardMaterial}
            castShadow
            receiveShadow
          />

          {/* Edge darkening on top of inner walls */}
          <mesh position={[0, config.trayHeight + platformThickness + 0.01, innerDepth / 2 - wallThickness / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[innerWidth, wallThickness]} />
            <primitive object={edgeDarkeningMat} attach="material" />
          </mesh>
          <mesh position={[0, config.trayHeight + platformThickness + 0.01, -innerDepth / 2 + wallThickness / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[innerWidth, wallThickness]} />
            <primitive object={edgeDarkeningMat} attach="material" />
          </mesh>
          <mesh position={[-innerWidth / 2 + wallThickness / 2, config.trayHeight + platformThickness + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[innerDepth - wallThickness * 2, wallThickness]} />
            <primitive object={edgeDarkeningMat} attach="material" />
          </mesh>
          <mesh position={[innerWidth / 2 - wallThickness / 2, config.trayHeight + platformThickness + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[innerDepth - wallThickness * 2, wallThickness]} />
            <primitive object={edgeDarkeningMat} attach="material" />
          </mesh>

          {/* Ambient Occlusion strips at base of inner walls */}
          <mesh position={[0, platformThickness + 0.01, innerDepth / 2 + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[innerWidth, 1]} />
            <primitive object={aoMat} attach="material" />
          </mesh>
          <mesh position={[0, platformThickness + 0.01, -innerDepth / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[innerWidth, 1]} />
            <primitive object={aoMat} attach="material" />
          </mesh>
          <mesh position={[-innerWidth / 2 - 0.5, platformThickness + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[innerDepth, 1]} />
            <primitive object={aoMat} attach="material" />
          </mesh>
          <mesh position={[innerWidth / 2 + 0.5, platformThickness + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[innerDepth, 1]} />
            <primitive object={aoMat} attach="material" />
          </mesh>

          {/* Shelf Lips - all 4 faces */}
          <group position={[0, platformThickness + shelfLipHeight / 2, config.depth / 2 - 0.21]}>
            <ShelfLip width={config.width} color={lipColor} text={branding?.lipText} textColor={branding?.lipTextColor} />
          </group>
          <group position={[0, platformThickness + shelfLipHeight / 2, -config.depth / 2 + 0.21]} rotation={[0, Math.PI, 0]}>
            <ShelfLip width={config.width} color={lipColor} text={branding?.lipText} textColor={branding?.lipTextColor} />
          </group>
          <group position={[-config.width / 2 + 0.21, platformThickness + shelfLipHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <ShelfLip width={config.depth - 1} color={lipColor} text={branding?.lipText} textColor={branding?.lipTextColor} />
          </group>
          <group position={[config.width / 2 - 0.21, platformThickness + shelfLipHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <ShelfLip width={config.depth - 1} color={lipColor} text={branding?.lipText} textColor={branding?.lipTextColor} />
          </group>
        </>
      )}

    </group>
  );
};
