import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'

interface ProductHoverEffectProps {
  isSelected: boolean
  isHovered: boolean
  productWidth: number
  productHeight: number
  productDepth: number
  position: [number, number, number]
  rotation?: [number, number, number]
  onRotate?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onDragStart?: (pointer: { clientX: number; clientY: number }) => void
  children: React.ReactNode
}

export const ProductHoverEffect: React.FC<ProductHoverEffectProps> = ({
  isSelected,
  isHovered,
  productWidth,
  productHeight,
  productDepth,
  position,
  rotation = [0, 0, 0],
  onRotate,
  onDuplicate,
  onDelete,
  onDragStart,
  children,
}) => {
  const highlightRef = useRef<THREE.Group>(null)
  const pillRef = useRef<THREE.Group>(null)

  useFrame((_state, delta) => {
    const targetScale = isSelected ? 1 : 0
    if (highlightRef.current) {
      highlightRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 10,
      )
    }
    if (pillRef.current) {
      pillRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 10,
      )
    }
  })

  return (
    <group
      position={position}
      rotation={rotation}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        onDragStart?.({ clientX: event.clientX, clientY: event.clientY })
      }}
    >
      {children}

      {/* Hover outline */}
      {isHovered && !isSelected && (
        <mesh position={[0, productHeight / 2, 0]}>
          <boxGeometry args={[productWidth + 0.1, productHeight + 0.1, productDepth + 0.1]} />
          <meshBasicMaterial visible={false} />
          <Edges scale={1} color="white" transparent opacity={0.4} />
        </mesh>
      )}

      {/* Selected highlight */}
      <group ref={highlightRef} scale={0}>
        <mesh position={[0, productHeight / 2, 0]}>
          <boxGeometry args={[productWidth + 0.2, productHeight + 0.2, productDepth + 0.2]} />
          <meshBasicMaterial
            color="#2563EB"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
          <Edges scale={1} color="#2563EB" linewidth={2} />
        </mesh>
      </group>

      {/* Floating action pill */}
      <group ref={pillRef} scale={0} position={[0, productHeight + 3, 0]}>
        <Billboard follow lockX={false} lockY={false} lockZ={false}>
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.8, 3.2, 4, 16]} />
            <meshBasicMaterial color="#1F2937" />
          </mesh>

          {/* Rotate button */}
          <group
            onClick={(e) => {
              e.stopPropagation()
              onRotate?.()
            }}
          >
            <mesh position={[-1.2, 0, 0.1]}>
              <circleGeometry args={[0.4, 16]} />
              <meshBasicMaterial color="#4B5563" />
            </mesh>
            <Text position={[-1.2, 0, 0.15]} fontSize={0.45} color="white" anchorX="center" anchorY="middle">
              ↻
            </Text>
          </group>

          {/* Duplicate button */}
          <group
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate?.()
            }}
          >
            <mesh position={[0, 0, 0.1]}>
              <circleGeometry args={[0.4, 16]} />
              <meshBasicMaterial color="#4B5563" />
            </mesh>
            <Text position={[0, 0, 0.15]} fontSize={0.45} color="white" anchorX="center" anchorY="middle">
              ⊞
            </Text>
          </group>

          {/* Delete button */}
          <group
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
          >
            <mesh position={[1.2, 0, 0.1]}>
              <circleGeometry args={[0.4, 16]} />
              <meshBasicMaterial color="#EF4444" />
            </mesh>
            <Text position={[1.2, 0, 0.15]} fontSize={0.45} color="white" anchorX="center" anchorY="middle">
              ✕
            </Text>
          </group>
        </Billboard>
      </group>
    </group>
  )
}
