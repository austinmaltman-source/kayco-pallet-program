import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { PlacedProduct } from '../../types'
import { usePhotoModel } from '../PalletDisplay/products/PhotoProductModel'
import { CASE_WALL, TRAY_BASE, UNIT_GAP, unitPositions } from '../../lib/builder/case-spec'
import type { Block } from '../../lib/builder/placement-engine'

interface CaseMeshProps {
  placement: PlacedProduct
  block: Block
  selected?: boolean
  hovered?: boolean
  ghost?: 'ok' | 'bad' | null
  cartons?: boolean
  onPointerDown?: (e: ThreeEvent<PointerEvent>, id: string) => void
  onPointerOver?: (id: string) => void
  onPointerOut?: (id: string) => void
}

const noRaycast = () => null
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
boxGeometry.translate(0, 0.5, 0)
const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))

const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
const selectedLine = new THREE.LineBasicMaterial({ color: '#2563eb' })
const hoverLine = new THREE.LineBasicMaterial({ color: '#94a3b8' })
const okGhost = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.18, depthWrite: false })
const badGhost = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.28, depthWrite: false })
const okLine = new THREE.LineBasicMaterial({ color: '#16a34a' })
const badLine = new THREE.LineBasicMaterial({ color: '#dc2626' })

const colorMaterials = new Map<string, THREE.MeshStandardMaterial>()
function colorMaterial(color: string) {
  let m = colorMaterials.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    colorMaterials.set(color, m)
  }
  return m
}
// Items with no catalog photo still get a printed-looking face: the brand
// colour with the product name, so a shelf never reads as blank boxes.
const labelMaterials = new Map<string, THREE.Material[]>()
function labelMaterial(label: string, color: string) {
  const key = `${label}|${color}`
  let m = labelMaterials.get(key)
  if (m) return m
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const base = new THREE.Color(color)
  ctx.fillStyle = `#${base.getHexString()}`
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillRect(14, 60, 228, 136)
  ctx.fillStyle = '#1f2937'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const words = label.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  ctx.font = 'bold 26px system-ui, sans-serif'
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > 210 && line) {
      lines.push(line)
      line = w
    } else line = test
    if (lines.length >= 4) break
  }
  if (line && lines.length < 4) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, 128, 128 + (i - (lines.length - 1) / 2) * 30))
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
  const side = colorMaterial(`#${base.getHexString()}`)
  m = [side, side, side, side, face, face]
  labelMaterials.set(key, m)
  return m
}

const cartonMaterial = new THREE.MeshStandardMaterial({ color: '#b98b52', roughness: 0.85 })

// One case on the pallet: a low tray with every unit inside it drawn from the
// item's photo-built 3D model (instanced, so a case of 24 is one draw call),
// plus an invisible hit box for picking/dragging and a selection outline.
export const CaseMesh = memo(function CaseMesh({
  placement,
  block,
  selected,
  hovered,
  ghost,
  cartons,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: CaseMeshProps) {
  const layout = placement.caseConfig?.layout ?? { cols: 1, rows: 1, layers: 1 }
  const isCase = !!placement.caseConfig
  // Unit size: the case interior split by its layout (keeps legacy
  // placements and real case dims consistent with what is drawn).
  const geom = useMemo(() => {
    if (!isCase) {
      return {
        unit: { width: placement.width, height: placement.height, depth: placement.depth },
        positions: [[0, 0, 0]] as [number, number, number][],
      }
    }
    const innerW = Math.max(0.3, placement.width - CASE_WALL * 2)
    const innerD = Math.max(0.3, placement.depth - CASE_WALL * 2)
    const innerH = Math.max(0.3, placement.height - TRAY_BASE)
    const unitGuess = {
      width: Math.max(0.3, (innerW - UNIT_GAP * (layout.cols - 1)) / layout.cols),
      depth: Math.max(0.3, (innerD - UNIT_GAP * (layout.rows - 1)) / layout.rows),
      height: Math.max(0.3, innerH / layout.layers),
    }
    const r = unitPositions({
      layout,
      unit: unitGuess,
      case: { width: placement.width, depth: placement.depth, height: placement.height },
    })
    // Soft goods are packed at a fraction of their size and drawn full size,
    // so neighbouring bags visibly squeeze into each other.
    const sq = placement.caseConfig?.squish && placement.caseConfig.squish < 1 ? placement.caseConfig.squish : 1
    return {
      unit: { width: r.unitSize.width / sq, height: r.unitSize.height, depth: r.unitSize.depth / sq },
      positions: r.positions,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement.width, placement.depth, placement.height, layout.cols, layout.rows, layout.layers, isCase, placement.caseConfig?.squish])
  const unit = geom.unit
  const positions = geom.positions

  const model = usePhotoModel({
    imageUrl: placement.imageUrl,
    label: placement.label,
    width: unit.width,
    height: unit.height,
    depth: unit.depth,
  })

  const instRef = useRef<THREE.InstancedMesh>(null)
  const geometry = model ? model.geometry : boxGeometry
  const material = model ? model.material : labelMaterial(placement.label ?? 'Item', placement.color || '#64748b')
  const baseY = 0

  useLayoutEffect(() => {
    const mesh = instRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    positions.forEach((p, i) => {
      if (model) m.makeTranslation(p[0], baseY + p[1], p[2])
      else m.compose(
        new THREE.Vector3(p[0], baseY + p[1], p[2]),
        new THREE.Quaternion(),
        new THREE.Vector3(unit.width * 0.98, unit.height * 0.98, unit.depth * 0.98),
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.count = positions.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [positions, model, baseY, unit])

  const rotationY = (block.rotQ * Math.PI) / 2
  const w = placement.width
  const d = placement.depth
  const h = placement.height

  return (
    <group position={[block.x, block.y, block.z]} rotation={[0, rotationY, 0]}>
      {cartons ? (
        <mesh geometry={boxGeometry} material={cartonMaterial} scale={[w, h, d]} raycast={noRaycast} castShadow receiveShadow />
      ) : (
        <>
          <instancedMesh
            key={`${model ? 'm' : 'b'}-${positions.length}`}
            ref={instRef}
            args={[geometry, material as THREE.Material, positions.length]}
            raycast={noRaycast}
          />
        </>
      )}

      {ghost && (
        <>
          <mesh geometry={boxGeometry} material={ghost === 'ok' ? okGhost : badGhost} scale={[w + 0.1, h + 0.1, d + 0.1]} raycast={noRaycast} />
          <lineSegments geometry={edgesGeometry} material={ghost === 'ok' ? okLine : badLine} scale={[w + 0.12, h + 0.12, d + 0.12]} position={[0, h / 2, 0]} raycast={noRaycast} />
        </>
      )}
      {!ghost && (selected || hovered) && (
        <lineSegments
          geometry={edgesGeometry}
          material={selected ? selectedLine : hoverLine}
          scale={[w + 0.15, h + 0.15, d + 0.15]}
          position={[0, h / 2, 0]}
          raycast={noRaycast}
        />
      )}

      {/* Pick / drag target */}
      {onPointerDown && (
        <mesh
          geometry={boxGeometry}
          material={hitMaterial}
          scale={[w, h, d]}
          userData={{ kind: 'case', id: placement.id, tier: block.tier }}
          onPointerDown={(e) => onPointerDown(e, placement.id)}
          onPointerOver={(e) => {
            e.stopPropagation()
            onPointerOver?.(placement.id)
          }}
          onPointerOut={() => onPointerOut?.(placement.id)}
        />
      )}
    </group>
  )
})
