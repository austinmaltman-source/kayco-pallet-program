import { useState, useEffect, useMemo, useCallback } from 'react'
import { Html, OrbitControls } from '@react-three/drei'
import { TierConfig } from '../../../types'
import { Pallet } from '../../PalletDisplay/Pallet'
import { DisplayStructure } from '../../PalletDisplay/DisplayStructure'

interface PalletWizardPreviewProps {
  palletType: 'full' | 'half' | 'custom'
  baseWidth: number
  baseDepth: number
  baseHeight: number
  tiers: Array<{ id: number; trayHeight: number }>
  walls: Record<'front' | 'back' | 'left' | 'right', { type: string; gridColumns: number }>
  shelfDepth: number
  lipColor: string
  lipText: string
  headerEnabled: boolean
  headerText: string
  headerColor: string
  panelColor: string
  maxHeight: number
}

const noop = () => {}

export function PalletWizardPreview(props: PalletWizardPreviewProps) {
  const {
    palletType,
    baseWidth,
    baseDepth,
    baseHeight,
    tiers,
    walls,
    shelfDepth,
    lipColor,
    lipText,
    headerEnabled,
    headerText,
    headerColor,
    panelColor,
    maxHeight,
  } = props

  const [showOrbitHint, setShowOrbitHint] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowOrbitHint(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const tierConfigs: TierConfig[] = useMemo(() => {
    const innerWidth = 46
    const innerDepth = palletType === 'half' ? 20 : 38
    const platformThickness = 1
    const tierCount = tiers.length

    let cumY = 0
    return tiers.map((tier, index) => {
      const yOffset = cumY
      cumY += tier.trayHeight + platformThickness

      // Interpolate slotGridSize from 6 (bottom) to 4 (top)
      const t = tierCount > 1 ? index / (tierCount - 1) : 0
      const slotGridSize = Math.round(6 - t * 2)

      return {
        id: tier.id,
        width: innerWidth,
        depth: innerDepth,
        height: tier.trayHeight,
        shelfDepth,
        trayHeight: tier.trayHeight,
        yOffset,
        slotGridSize,
      }
    })
  }, [tiers, palletType, shelfDepth])

  const branding = useMemo(() => ({
    lipText,
    lipTextColor: '#FFFFFF',
    headerText: headerEnabled ? headerText : undefined,
    headerBackgroundColor: headerColor,
  }), [lipText, headerEnabled, headerText, headerColor])

  const noopPointer = useCallback(
    (_tierId: number, _slotIndex: number, _pos: [number, number, number], _e: any) => {},
    []
  )
  const noopOut = useCallback((_e: any) => {}, [])

  // Total display height calculation
  const platformThickness = 1
  const totalTierHeight = tiers.reduce(
    (sum, tier) => sum + tier.trayHeight + platformThickness,
    0
  )
  const totalDisplayHeight = baseHeight + totalTierHeight
  const showMaxHeightIndicator = totalDisplayHeight > maxHeight - 5

  // Panel dimensions
  const innerWidth = 46
  const innerDepth = palletType === 'half' ? 20 : 38
  const panelThickness = 0.5

  const wallEntries = Object.entries(walls) as Array<
    ['front' | 'back' | 'left' | 'right', { type: string; gridColumns: number }]
  >

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2A2A3E" />
      </mesh>

      {/* Pallet base */}
      <Pallet width={baseWidth} depth={baseDepth} height={baseHeight} />

      {/* Display structure */}
      <DisplayStructure
        tiers={tierConfigs}
        palletType={palletType === 'custom' ? 'full' : palletType}
        lipColor={lipColor}
        branding={branding}
        showHeader={headerEnabled}
      />

      {/* Branded panels */}
      {wallEntries.map(([face, config]) => {
        if (config.type !== 'branded-panel') return null

        const panelHeight = totalTierHeight
        const panelY = baseHeight + panelHeight / 2

        let position: [number, number, number]
        let size: [number, number, number]

        switch (face) {
          case 'front':
            position = [0, panelY, innerDepth / 2]
            size = [innerWidth, panelHeight, panelThickness]
            break
          case 'back':
            position = [0, panelY, -innerDepth / 2]
            size = [innerWidth, panelHeight, panelThickness]
            break
          case 'left':
            position = [-innerWidth / 2, panelY, 0]
            size = [panelThickness, panelHeight, innerDepth]
            break
          case 'right':
            position = [innerWidth / 2, panelY, 0]
            size = [panelThickness, panelHeight, innerDepth]
            break
        }

        return (
          <mesh key={`panel-${face}`} position={position}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={panelColor} />
          </mesh>
        )
      })}

      {/* Max height indicator */}
      {showMaxHeightIndicator && (
        <mesh position={[0, maxHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[baseWidth + 10, baseDepth + 10]} />
          <meshBasicMaterial color="red" transparent opacity={0.15} />
        </mesh>
      )}

      {/* Dimension annotations */}
      <Html
        position={[0, 0.5, baseDepth / 2 + 3]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ color: '#94A3B8', fontSize: '10px' }}>
          {baseWidth}&quot;
        </div>
      </Html>

      <Html
        position={[baseWidth / 2 + 3, 0.5, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ color: '#94A3B8', fontSize: '10px' }}>
          {baseDepth}&quot;
        </div>
      </Html>

      {/* Orbit hint */}
      {showOrbitHint && (
        <Html position={[0, 10, 0]} center>
          <div
            style={{
              color: '#94A3B8',
              fontSize: '12px',
              pointerEvents: 'none',
              opacity: 0.8,
              whiteSpace: 'nowrap',
            }}
          >
            Drag to rotate
          </div>
        </Html>
      )}

      <OrbitControls
        autoRotate
        autoRotateSpeed={1.5}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI / 18}
        maxPolarAngle={(85 * Math.PI) / 180}
        minDistance={30}
        maxDistance={150}
        target={[0, 24, 0]}
      />
    </>
  )
}
