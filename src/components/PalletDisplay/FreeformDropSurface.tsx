import { useEffect, useMemo, useState } from 'react'
import { Edges } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { DraggedCaseProduct, FullValidationResult } from '../../types'

interface FreeformDropSurfaceProps {
  draggedCaseProduct: DraggedCaseProduct | null
  palletDimensions: { width: number; depth: number; height: number }
  onDrop?: (position: { x: number; y: number; z: number }) => void
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

export function FreeformDropSurface({
  draggedCaseProduct,
  palletDimensions,
  onDrop,
  validateDrop,
}: FreeformDropSurfaceProps) {
  const { camera, gl } = useThree()
  const [draft, setDraft] = useState<DraftPlacement | null>(null)

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse = useMemo(() => new THREE.Vector2(), [])
  const dropPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -palletDimensions.height),
    [palletDimensions.height],
  )

  useEffect(() => {
    if (!draggedCaseProduct) {
      setDraft(null)
      return
    }

    const canvas = gl.domElement

    const updateDraft = (event: DragEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      mouse.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1)
      raycaster.setFromCamera(mouse, camera)

      const intersection = new THREE.Vector3()
      const hit = raycaster.ray.intersectPlane(dropPlane, intersection)
      if (!hit) {
        setDraft(null)
        return null
      }

      const maxX = Math.max(0, palletDimensions.width - draggedCaseProduct.width)
      const maxZ = Math.max(0, palletDimensions.depth - draggedCaseProduct.depth)
      const palletPosition = {
        x: clamp(
          intersection.x + palletDimensions.width / 2 - draggedCaseProduct.width / 2,
          0,
          maxX,
        ),
        y: palletDimensions.height,
        z: clamp(
          palletDimensions.depth / 2 - intersection.z - draggedCaseProduct.depth / 2,
          0,
          maxZ,
        ),
      }
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
      setDraft(nextDraft)
      return nextDraft
    }

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      updateDraft(event)
    }

    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      const nextDraft = updateDraft(event)
      if (nextDraft?.valid) {
        onDrop?.(nextDraft.palletPosition)
      }
      setDraft(null)
    }

    const handleDragEnd = () => setDraft(null)

    canvas.addEventListener('dragover', handleDragOver)
    canvas.addEventListener('drop', handleDrop)
    window.addEventListener('dragend', handleDragEnd)

    return () => {
      canvas.removeEventListener('dragover', handleDragOver)
      canvas.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragend', handleDragEnd)
    }
  }, [
    camera,
    draggedCaseProduct,
    dropPlane,
    gl.domElement,
    mouse,
    onDrop,
    palletDimensions.depth,
    palletDimensions.height,
    palletDimensions.width,
    raycaster,
    validateDrop,
  ])

  if (!draggedCaseProduct || !draft) return null

  const color = draft.valid ? '#16a34a' : '#dc2626'

  return (
    <group>
      <mesh
        position={[0, palletDimensions.height + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[palletDimensions.width, palletDimensions.depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
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
    </group>
  )
}
