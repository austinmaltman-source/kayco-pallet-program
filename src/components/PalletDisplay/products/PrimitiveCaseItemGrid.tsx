import { useMemo } from 'react'
import type { CaseConfig, PackagingType } from '../../../types'
import {
  CASE_WALL_THICKNESS,
  calculateItemPositions,
  getCaseCellDimensions,
} from './caseUtils'

interface PrimitiveCaseItemGridProps {
  color: string
  packaging?: PackagingType
  unitDimensions: { width: number; height: number; depth: number }
  caseDimensions: { width: number; height: number; depth: number }
  layout: CaseConfig['layout']
  padding: number
}

// Unit-level rendering for cases whose unit product has no GLB model:
// every unit in the case renders as a primitive (cylinder for bottle-like
// shapes, box otherwise) sized from its real dimensions. Same layout math
// as the GLB-based CaseItemGrid.
export function PrimitiveCaseItemGrid({
  color,
  packaging,
  unitDimensions,
  caseDimensions,
  layout,
  padding,
}: PrimitiveCaseItemGridProps) {
  const cell = getCaseCellDimensions(
    caseDimensions,
    layout,
    padding,
    CASE_WALL_THICKNESS,
  )

  const positions = useMemo(
    () =>
      calculateItemPositions(
        caseDimensions,
        unitDimensions,
        layout,
        padding,
        CASE_WALL_THICKNESS,
      ),
    [
      caseDimensions.width,
      caseDimensions.height,
      caseDimensions.depth,
      unitDimensions.width,
      unitDimensions.height,
      unitDimensions.depth,
      layout.cols,
      layout.rows,
      layout.layers,
      padding,
    ],
  )

  // Fit the unit inside its cell with a little air.
  const width = Math.min(unitDimensions.width, Math.max(0.2, cell.width - padding))
  const height = Math.min(unitDimensions.height, Math.max(0.2, cell.height - padding))
  const depth = Math.min(unitDimensions.depth, Math.max(0.2, cell.depth - padding))

  // Bottle-like: explicitly tagged, or a tall square footprint.
  const isRound =
    packaging === 'bottle' ||
    packaging === 'jar' ||
    (Math.abs(width - depth) < 0.4 && height > width * 1.6)

  return (
    <group>
      {/* Layout positions are bottom-anchored (GLB clones zero their min.y);
          primitive geometry is center-origin, so lift by half height. */}
      {positions.map((position, index) => (
        <mesh
          key={index}
          position={[position[0], position[1] + height / 2, position[2]]}
          castShadow
        >
          {isRound ? (
            <cylinderGeometry
              args={[width / 2, width / 2 * 0.92, height, 14]}
            />
          ) : (
            <boxGeometry args={[width, height, depth]} />
          )}
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}
