import { useCallback, useEffect, useRef, useState } from 'react'
import { Edges } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { DraggedCaseProduct, FullValidationResult } from '../../types'

interface FreeformDropSurfaceProps {
  draggedCaseProduct: DraggedCaseProduct | null
  palletDimensions: { width: number; depth: number; height: number }
  onDrop?: (position: { x: number; y: number; z: number }) => void
  onCancel?: () => void
  settleDrop?: (
    position: { x: number; y: number; z: number },
  ) => { x: number; y: number; z: number }
  validateDrop?: (
    position: { x: number; y: number; z: number },
  ) => FullValidationResult | undefined
}

interface DraftPlacement {
  scenePosition: [number, number, number]
  palletPosition: { x: number; y: number; z: number }
  valid: boolean
  reason?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function snap(value: number, increment: number) {
  return Math.round(value / increment) * increment
}

const MOVE_SCALE = 0.4
const SNAP_INCHES = 0.5
const POINTER_DEAD_ZONE_PX = 4

export function FreeformDropSurface({
  draggedCaseProduct,
  palletDimensions,
  onDrop,
  onCancel,
  settleDrop,
  validateDrop,
}: FreeformDropSurfaceProps) {
  const { camera, gl } = useThree()
  const [draft, setDraftState] = useState<DraftPlacement | null>(null)
  const draftRef = useRef<DraftPlacement | null>(null)
  const dragAnchorRef = useRef({
    sceneX: null as number | null,
    sceneZ: null as number | null,
    startX: 0,
    startZ: 0,
  })
  const raycasterRef = useRef(new THREE.Raycaster())
  const ndcRef = useRef(new THREE.Vector2())
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const projectedPointRef = useRef(new THREE.Vector3())

  const dragPlaneY = Math.max(
    palletDimensions.height,
    draggedCaseProduct?.startPosition?.y ?? palletDimensions.height,
  )

  const updateDraft = useCallback((nextDraft: DraftPlacement | null) => {
    draftRef.current = nextDraft
    setDraftState(nextDraft)
  }, [])

  const projectPointerToPlane = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null

      const x = clamp(clientX, rect.left, rect.right)
      const y = clamp(clientY, rect.top, rect.bottom)
      ndcRef.current.set(
        ((x - rect.left) / rect.width) * 2 - 1,
        -(((y - rect.top) / rect.height) * 2 - 1),
      )
      raycasterRef.current.setFromCamera(ndcRef.current, camera)
      dragPlaneRef.current.set(new THREE.Vector3(0, 1, 0), -dragPlaneY)
      const hit = raycasterRef.current.ray.intersectPlane(
        dragPlaneRef.current,
        projectedPointRef.current,
      )

      return hit ? { x: hit.x, z: hit.z } : null
    },
    [camera, dragPlaneY, gl.domElement],
  )

  const makeDraftFromPalletPosition = useCallback((position: { x: number; y: number; z: number }) => {
    if (!draggedCaseProduct) return null
    const maxX = Math.max(0, palletDimensions.width - draggedCaseProduct.width)
    const maxZ = Math.max(0, palletDimensions.depth - draggedCaseProduct.depth)
    const tentativePosition = {
      x: snap(clamp(position.x, 0, maxX), SNAP_INCHES),
      y: palletDimensions.height,
      z: snap(clamp(position.z, 0, maxZ), SNAP_INCHES),
    }
    const palletPosition = settleDrop?.(tentativePosition) ?? tentativePosition
    const validation = validateDrop?.(palletPosition)
    const scenePosition: [number, number, number] = [
      palletPosition.x - palletDimensions.width / 2 + draggedCaseProduct.width / 2,
      palletPosition.y + draggedCaseProduct.height / 2,
      palletDimensions.depth / 2 - palletPosition.z - draggedCaseProduct.depth / 2,
    ]

    const nextDraft = {
      scenePosition,
      palletPosition,
      valid: validation?.valid ?? true,
      reason: validation?.errors[0]?.reason,
    }
    updateDraft(nextDraft)
    return nextDraft
  }, [
    draggedCaseProduct,
    palletDimensions.depth,
    palletDimensions.height,
    palletDimensions.width,
    settleDrop,
    updateDraft,
    validateDrop,
  ])

  const makeDraftFromScenePoint = useCallback((point: { x: number; z: number }) => {
    if (!draggedCaseProduct) return null

    if (draggedCaseProduct.startPosition) {
      if (dragAnchorRef.current.sceneX === null || dragAnchorRef.current.sceneZ === null) {
        dragAnchorRef.current.sceneX = point.x
        dragAnchorRef.current.sceneZ = point.z
        dragAnchorRef.current.startX = draggedCaseProduct.startPosition.x
        dragAnchorRef.current.startZ = draggedCaseProduct.startPosition.z
      }

      return makeDraftFromPalletPosition({
        x: dragAnchorRef.current.startX + (point.x - dragAnchorRef.current.sceneX) * MOVE_SCALE,
        y: palletDimensions.height,
        z: dragAnchorRef.current.startZ - (point.z - dragAnchorRef.current.sceneZ) * MOVE_SCALE,
      })
    }

    return makeDraftFromPalletPosition({
      x: point.x + palletDimensions.width / 2 - draggedCaseProduct.width / 2,
      y: palletDimensions.height,
      z: palletDimensions.depth / 2 - point.z - draggedCaseProduct.depth / 2,
    })
  }, [
    draggedCaseProduct,
    makeDraftFromPalletPosition,
    palletDimensions.depth,
    palletDimensions.height,
    palletDimensions.width,
  ])

  useEffect(() => {
    if (!draggedCaseProduct) {
      updateDraft(null)
      dragAnchorRef.current.sceneX = null
      dragAnchorRef.current.sceneZ = null
      return
    }

    dragAnchorRef.current.sceneX = null
    dragAnchorRef.current.sceneZ = null

    if (draggedCaseProduct.startPosition && draggedCaseProduct.startClient) {
      const point = projectPointerToPlane(
        draggedCaseProduct.startClient.x,
        draggedCaseProduct.startClient.y,
      )
      if (point) {
        dragAnchorRef.current.sceneX = point.x
        dragAnchorRef.current.sceneZ = point.z
        dragAnchorRef.current.startX = draggedCaseProduct.startPosition.x
        dragAnchorRef.current.startZ = draggedCaseProduct.startPosition.z
      }
    }

    const startedAt = draggedCaseProduct.startClient
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'grabbing'

    const isStillInsideTray = (target: EventTarget | null) =>
      draggedCaseProduct.source === 'tray' &&
      target instanceof HTMLElement &&
      Boolean(target.closest('[data-case-tray]'))

    const hasClearedDeadZone = (event: PointerEvent) => {
      if (!startedAt) return true
      return (
        Math.abs(event.clientX - startedAt.x) > POINTER_DEAD_ZONE_PX ||
        Math.abs(event.clientY - startedAt.y) > POINTER_DEAD_ZONE_PX
      )
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (event.buttons !== 1 || isStillInsideTray(event.target) || !hasClearedDeadZone(event)) {
        return
      }
      const point = projectPointerToPlane(event.clientX, event.clientY)
      if (!point) return
      event.preventDefault()
      makeDraftFromScenePoint(point)
    }

    const cancelDrag = () => {
      onCancel?.()
      updateDraft(null)
    }

    const finishDrag = (event?: PointerEvent) => {
      if (
        event &&
        (isStillInsideTray(event.target) ||
          (!draftRef.current && !hasClearedDeadZone(event)))
      ) {
        cancelDrag()
        return
      }

      const point = event ? projectPointerToPlane(event.clientX, event.clientY) : null
      const nextDraft = point ? makeDraftFromScenePoint(point) : draftRef.current
      if (nextDraft?.valid) {
        onDrop?.(nextDraft.palletPosition)
      } else {
        cancelDrag()
      }
      updateDraft(null)
    }

    const handleWindowPointerUp = (event: PointerEvent) => {
      finishDrag(event)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      cancelDrag()
    }

    const handleWindowBlur = () => {
      cancelDrag()
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [
    draggedCaseProduct,
    makeDraftFromScenePoint,
    onCancel,
    onDrop,
    projectPointerToPlane,
    updateDraft,
  ])

  const handlePlanePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!draggedCaseProduct) return
    event.stopPropagation()
    makeDraftFromScenePoint(event.point)
  }

  const handlePlanePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!draggedCaseProduct) return
    event.stopPropagation()
    const nextDraft = makeDraftFromScenePoint(event.point)
    if (nextDraft?.valid) {
      onDrop?.(nextDraft.palletPosition)
    } else {
      onCancel?.()
    }
    updateDraft(null)
  }

  if (!draggedCaseProduct) return null

  const color = draft?.valid === false ? '#dc2626' : '#16a34a'

  return (
    <group>
      <mesh
        position={[0, palletDimensions.height + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePlanePointerMove}
        onPointerUp={handlePlanePointerUp}
      >
        <planeGeometry args={[palletDimensions.width, palletDimensions.depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {draft && (
        <mesh position={draft.scenePosition}>
          <boxGeometry
            args={[
              draggedCaseProduct.width,
              draggedCaseProduct.height,
              draggedCaseProduct.depth,
            ]}
          />
          <meshStandardMaterial color={color} transparent opacity={0.38} />
          <Edges color={color} />
        </mesh>
      )}
    </group>
  )
}
