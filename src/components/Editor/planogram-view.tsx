import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDisplayStore } from '../../stores/display-store'
import { useRetailerStore } from '../../stores/retailer-store'
import { buildTierConfigs } from '../../lib/shelfCoordinates'
import { PalletNavigator } from './pallet-navigator'
import type { PlacedProduct, SelectMode, TrayFace } from '../../types'

// Flat Spaceman-style elevation of one pallet face. Items are the same
// placements the 3D physics editor edits - this view just projects them onto
// the active face's plane. Click selects, shift-click selects every placement
// of the product, cmd/ctrl-click toggles, dragging moves the selection in the
// face plane (X along the face, Y vertical). Released items snap to the
// nearest shelf surface; physics re-settles them the next time 3D opens.

const DRAG_THRESHOLD_IN = 0.35 // inches of travel before a press is a drag

// Horizontal world axis of each face as seen from outside the pallet, and
// its sign: worldU = sign * (axis component). front viewer: +x is right.
const FACE_AXIS: Record<TrayFace, { axis: 'x' | 'z'; sign: 1 | -1 }> = {
  front: { axis: 'x', sign: 1 },
  back: { axis: 'x', sign: -1 },
  right: { axis: 'z', sign: -1 },
  left: { axis: 'z', sign: 1 },
}

function yawOf(q: [number, number, number, number] | undefined): number {
  if (!q) return 0
  // Yaw about Y for an (approximately) upright quaternion.
  return Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]))
}

// Which face a placement is merchandised on: the edge it sits closest to.
// Raw axis dominance gets this wrong at the corners - an item at the right
// end of the FRONT row has a large x, but it is still front-facing. What
// distinguishes them is which edge the item is pressed against.
export function faceOf(
  position: [number, number, number],
  pallet: { width: number; depth: number },
): TrayFace {
  const [x, , z] = position
  const distances: [TrayFace, number][] = [
    ['front', pallet.depth / 2 - z],
    ['back', z + pallet.depth / 2],
    ['right', pallet.width / 2 - x],
    ['left', x + pallet.width / 2],
  ]
  distances.sort((a, b) => a[1] - b[1])
  return distances[0][0]
}

interface ProjectedItem {
  placement: PlacedProduct
  u: number // horizontal center in face coords (inches)
  y: number // bottom (world y, inches)
  w: number // projected width
  h: number // height
}

export function PlanogramView() {
  const currentProject = useDisplayStore((s) => s.currentProject)
  const activeFace = useDisplayStore((s) => s.activeFace)
  const selectedProductId = useDisplayStore((s) => s.selectedProductId)
  const selectedProductIds = useDisplayStore((s) => s.selectedProductIds)
  const selectProduct = useDisplayStore((s) => s.selectProduct)
  const movePlacements = useDisplayStore((s) => s.movePlacements)
  const removePlacements = useDisplayStore((s) => s.removePlacements)
  const nudgePlacements = useDisplayStore((s) => s.nudgePlacements)
  const retailer = useRetailerStore((s) =>
    currentProject ? s.getRetailer(currentProject.retailerId) : undefined,
  )

  const svgRef = useRef<SVGSVGElement>(null)
  // Live drag state: world-inch deltas applied visually until release.
  const [drag, setDrag] = useState<{
    ids: string[]
    du: number
    dy: number
  } | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startClient: [number, number]
    ids: string[]
    moved: boolean
    modifier: SelectMode
    primaryId: string
  } | null>(null)

  const isHalf = currentProject?.palletType === 'half'
  const face: TrayFace = isHalf ? 'front' : activeFace
  const palletDimensions = retailer?.palletDimensions ?? { width: 48, depth: 40, height: 6 }
  const maxDisplayHeight = retailer?.maxDisplayHeight ?? 60
  const palletHeight = palletDimensions.height

  const tiers = useMemo(
    () =>
      currentProject
        ? buildTierConfigs(
            currentProject.tierCount,
            maxDisplayHeight,
            currentProject.palletType,
          )
        : [],
    [currentProject, maxDisplayHeight],
  )

  // Shelf surfaces a released item can snap onto (world y of each rest plane).
  const restSurfaces = useMemo(() => {
    const surfaces = [palletHeight]
    tiers.forEach((tier) => surfaces.push(palletHeight + tier.yOffset + 1))
    return surfaces
  }, [tiers, palletHeight])

  const placements = currentProject?.placements ?? []
  const freePlacements = placements.filter((p) => p.position)

  const { items, otherFaceCount } = useMemo(() => {
    const axis = FACE_AXIS[face]
    const visible: ProjectedItem[] = []
    let hidden = 0
    freePlacements.forEach((placement) => {
      const position = placement.position!
      if (!isHalf && faceOf(position, palletDimensions) !== face) {
        hidden += 1
        return
      }
      const theta = yawOf(placement.quaternion)
      // Horizontal extent of the (yawed) box projected onto the face plane.
      const w =
        Math.abs(Math.cos(theta)) * placement.width +
        Math.abs(Math.sin(theta)) * placement.depth
      visible.push({
        placement,
        u: axis.sign * (axis.axis === 'x' ? position[0] : position[2]),
        y: position[1],
        w: Math.max(w, 0.6),
        h: Math.max(placement.height, 0.6),
      })
    })
    return { items: visible, otherFaceCount: hidden }
  }, [freePlacements, face, isHalf, palletDimensions])

  // --- Coordinate system: world inches -> SVG viewBox units (y flipped) ---
  const spanU = face === 'front' || face === 'back' ? palletDimensions.width : palletDimensions.depth
  const viewW = Math.max(spanU, 46) + 16
  const topY = maxDisplayHeight + 6
  const viewH = topY + 10
  const sx = useCallback((u: number) => viewW / 2 + u, [viewW])
  const sy = useCallback((y: number) => topY - y, [topY])

  // Pixel -> world-inch scale for pointer math.
  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    // viewBox is uniformly scaled (xMidYMid meet): derive the scale from
    // whichever axis binds.
    const scale = Math.min(rect.width / viewW, rect.height / viewH)
    return {
      u: (clientX - rect.left - (rect.width - viewW * scale) / 2) / scale - viewW / 2,
      y: topY - (clientY - rect.top - (rect.height - viewH * scale) / 2) / scale,
    }
  }, [viewW, viewH, topY])

  const commitDrag = useCallback(
    (du: number, dy: number, ids: string[]) => {
      if (!currentProject) return
      const axis = FACE_AXIS[face]
      const idSet = new Set(ids)
      const updates: { id: string; position: [number, number, number] }[] = []
      currentProject.placements.forEach((placement) => {
        if (!idSet.has(placement.id) || !placement.position) return
        const [x, y, z] = placement.position
        const worldDelta = axis.sign * du
        let ny = y + dy
        // Snap the item's bottom to the nearest rest surface below the max.
        let best = Infinity
        restSurfaces.forEach((surface) => {
          if (Math.abs(surface + 0.05 - ny) < Math.abs(best - ny)) best = surface + 0.05
        })
        if (Math.abs(best - ny) < 3) ny = best
        updates.push({
          id: placement.id,
          position: [
            axis.axis === 'x' ? x + worldDelta : x,
            ny,
            axis.axis === 'z' ? z + worldDelta : z,
          ],
        })
      })
      movePlacements(updates)
    },
    [currentProject, face, movePlacements, restSurfaces],
  )

  const onItemPointerDown = useCallback(
    (event: React.PointerEvent, item: ProjectedItem) => {
      if (event.button !== 0) return
      event.stopPropagation()
      const modifier: SelectMode = event.shiftKey
        ? 'same-product'
        : event.metaKey || event.ctrlKey
          ? 'toggle'
          : 'single'
      // Dragging a selected item moves the whole selection.
      const ids =
        selectedProductIds.includes(item.placement.id) && selectedProductIds.length > 1
          ? selectedProductIds
          : [item.placement.id]
      dragRef.current = {
        pointerId: event.pointerId,
        startClient: [event.clientX, event.clientY],
        ids,
        moved: false,
        modifier,
        primaryId: item.placement.id,
      }
      ;(event.target as Element).setPointerCapture(event.pointerId)
    },
    [selectedProductIds],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = dragRef.current
      if (!state || event.pointerId !== state.pointerId) return
      const start = clientToWorld(...state.startClient)
      const now = clientToWorld(event.clientX, event.clientY)
      if (!start || !now) return
      const du = now.u - start.u
      const dy = now.y - start.y
      if (!state.moved && Math.hypot(du, dy) < DRAG_THRESHOLD_IN) return
      state.moved = true
      setDrag({ ids: state.ids, du, dy })
    },
    [clientToWorld],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const state = dragRef.current
      if (!state || event.pointerId !== state.pointerId) return
      dragRef.current = null
      if (state.moved) {
        const start = clientToWorld(...state.startClient)
        const now = clientToWorld(event.clientX, event.clientY)
        setDrag(null)
        if (start && now) commitDrag(now.u - start.u, now.y - start.y, state.ids)
        return
      }
      // A press without movement is a click: apply the selection mode.
      selectProduct(state.primaryId, state.modifier)
    },
    [clientToWorld, commitDrag, selectProduct],
  )

  // Keyboard: Delete removes the selection, arrows nudge it in-plane.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return
      const { selectedProductIds: ids } = useDisplayStore.getState()
      if (ids.length === 0) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        removePlacements(ids)
        return
      }
      if (event.key === 'Escape') {
        selectProduct(null)
        return
      }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 0.25 : 1
        const axis = FACE_AXIS[face]
        const du =
          event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0
        const worldU = axis.sign * du
        nudgePlacements(ids, [
          axis.axis === 'x' ? worldU : 0,
          dy,
          axis.axis === 'z' ? worldU : 0,
        ])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [face, nudgePlacements, removePlacements, selectProduct])

  if (!currentProject) return null

  const dragSet = drag ? new Set(drag.ids) : null
  const structureSpan = face === 'front' || face === 'back' ? 46 : isHalf ? 20 : 38

  return (
    <div className="w-full h-full relative bg-[#f0f0f0]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-full select-none touch-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerDown={(event) => {
          if (event.button === 0 && !dragRef.current) selectProduct(null)
        }}
      >
        {/* Floor line */}
        <line x1={0} y1={sy(0)} x2={viewW} y2={sy(0)} stroke="#d4d4d4" strokeWidth={0.3} />

        {/* Pallet base */}
        <rect
          x={sx(-spanU / 2)}
          y={sy(palletHeight)}
          width={spanU}
          height={palletHeight}
          fill="#c4a882"
          stroke="#a89070"
          strokeWidth={0.15}
          rx={0.4}
        />

        {/* Max display height */}
        <line
          x1={sx(-spanU / 2 - 4)}
          y1={sy(maxDisplayHeight)}
          x2={sx(spanU / 2 + 4)}
          y2={sy(maxDisplayHeight)}
          stroke="#ef4444"
          strokeWidth={0.25}
          strokeDasharray="1.4 1"
          opacity={0.6}
        />
        <text
          x={sx(spanU / 2 + 4)}
          y={sy(maxDisplayHeight) - 0.8}
          fontSize={2}
          fill="#ef4444"
          opacity={0.75}
          textAnchor="end"
        >
          MAX {maxDisplayHeight}&quot;
        </text>

        {/* Tier platforms */}
        {tiers.map((tier) => (
          <rect
            key={tier.id}
            x={sx(-structureSpan / 2)}
            y={sy(palletHeight + tier.yOffset + 1)}
            width={structureSpan}
            height={1}
            fill="#e0d5c5"
            stroke="#cbbfae"
            strokeWidth={0.12}
          />
        ))}

        {/* Items */}
        {items.map((item) => {
          const isDragged = dragSet?.has(item.placement.id)
          const du = isDragged && drag ? drag.du : 0
          const dy = isDragged && drag ? drag.dy : 0
          const isSelected = selectedProductIds.includes(item.placement.id)
          const isPrimary = selectedProductId === item.placement.id
          const x = sx(item.u + du - item.w / 2)
          const y = sy(item.y + dy + item.h)
          return (
            <g
              key={item.placement.id}
              onPointerDown={(event) => onItemPointerDown(event, item)}
              style={{ cursor: 'grab' }}
              opacity={isDragged ? 0.85 : 1}
            >
              {item.placement.imageUrl ? (
                <>
                  <rect
                    x={x}
                    y={y}
                    width={item.w}
                    height={item.h}
                    fill="#ffffff"
                    stroke="#d4d4d4"
                    strokeWidth={0.1}
                  />
                  <image
                    href={item.placement.imageUrl}
                    x={x}
                    y={y}
                    width={item.w}
                    height={item.h}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <>
                  <rect
                    x={x}
                    y={y}
                    width={item.w}
                    height={item.h}
                    fill={item.placement.color || '#8a8a8a'}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={0.1}
                    rx={0.25}
                  />
                  {/* Label is clipped to the item so text never spills onto
                      its neighbours (a planogram must read as a shelf). */}
                  {item.w > 2.2 && item.h > 1.4 && (
                    <foreignObject
                      x={x + 0.15}
                      y={y + 0.15}
                      width={item.w - 0.3}
                      height={item.h - 0.3}
                      style={{ pointerEvents: 'none' }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: `${Math.max(0.7, Math.min(1.05, item.w / 7))}px`,
                            lineHeight: 1.25,
                            textAlign: 'center',
                            color: '#fff',
                            fontWeight: 500,
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.placement.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </>
              )}
              {isSelected && (
                <rect
                  x={x - 0.25}
                  y={y - 0.25}
                  width={item.w + 0.5}
                  height={item.h + 0.5}
                  fill="none"
                  stroke={isPrimary ? '#2563EB' : '#60A5FA'}
                  strokeWidth={0.35}
                  rx={0.3}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Navigator (face switcher, shared with 3D) */}
      <div className="absolute top-20 left-4 z-20">
        <PalletNavigator />
      </div>

      {/* Face + counts */}
      <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 backdrop-blur shadow-card text-[11px] font-medium text-[#555]">
          <span className="uppercase tracking-wider text-[10px] text-[#999]">Face</span>
          {face}
          <span className="text-[#bbb]">·</span>
          {items.length} item{items.length === 1 ? '' : 's'}
        </div>
        {!isHalf && otherFaceCount > 0 && (
          <div className="px-3 py-1.5 rounded-md bg-white/80 backdrop-blur shadow-card text-[10px] text-[#888]">
            {otherFaceCount} more on other faces
          </div>
        )}
      </div>

      {/* Hints */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-[11px] font-medium text-white">
          {selectedProductIds.length > 1
            ? `${selectedProductIds.length} selected · Drag one to move all · Arrows nudge · Del removes`
            : 'Click selects · Shift-click selects all of this item · Drag to move'}
        </div>
      </div>
    </div>
  )
}
