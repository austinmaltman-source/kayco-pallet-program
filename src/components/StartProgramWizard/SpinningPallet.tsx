import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PalletDisplayScene } from '../PalletDisplay/PalletDisplayScene'
import type { PalletType } from '../../types'

interface SpinningPalletProps {
  palletType: PalletType
}

const FOV_DEG = 30

export function SpinningPallet({ palletType }: SpinningPalletProps) {
  const width = palletType === 'half' ? 24 : 48
  const depth = palletType === 'half' ? 20 : 40

  // Frame the display so half and full both fit nicely in the same card.
  // Include the vertical extent in the scale — the display is ~60" tall
  // regardless of pallet base size, so the half pallet (24×20 base) needs
  // distance scaled by height, not width, to avoid clipping the top tier.
  const verticalExtent = 70 // 4 tiers + topper, in inches
  const scale = Math.max(width, depth, verticalExtent)
  const cameraPosition: [number, number, number] = [
    scale * 1.4,
    scale * 0.95,
    scale * 1.4,
  ]

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: FOV_DEG }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          toneMappingExposure: 1.2,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <PalletDisplayScene
            palletType={palletType}
            palletDimensions={{ width, depth, height: 6 }}
            tierCount={4}
            autoRotate
            showHeader={false}
            environment="clean"
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
