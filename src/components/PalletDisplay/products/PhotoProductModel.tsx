import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { PlacedProduct } from '../../../types'
import { analyzePhoto, looksRound, PROFILE_ROWS, type PhotoProfile } from '../../../lib/photo-model'

// A 3D model built from ONE front product photo:
//   round items -> a turned (lathe) body whose profile is the photo's own
//                  silhouette, with the photo wrapped across the front;
//   everything else -> a box with the photo front and back and the sides
//                  painted in the photo's edge color.
// Photos, geometry and materials are cached per product, so every facing of
// the same item shares one GPU copy.

interface PhotoAsset {
  profile: PhotoProfile
  texture: THREE.Texture
  mirrored: THREE.Texture
}

const assetCache = new Map<string, Promise<PhotoAsset | null>>()

function loadPhotoAsset(url: string): Promise<PhotoAsset | null> {
  let pending = assetCache.get(url)
  if (pending) return pending
  pending = new Promise<PhotoAsset | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // Kayco photos send Access-Control-Allow-Origin: *
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const profile = analyzePhoto(data.data, canvas.width, canvas.height)
        if (!profile) return resolve(null)

        // Texture = the product only, cropped out of its white margin, so the
        // label fills the model's face instead of shrinking into the middle.
        const { x, y, width, height } = profile.bbox
        const crop = document.createElement('canvas')
        crop.width = width
        crop.height = height
        crop.getContext('2d')!.drawImage(canvas, x, y, width, height, 0, 0, width, height)

        const texture = new THREE.CanvasTexture(crop)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 4
        const mirrored = texture.clone()
        mirrored.wrapS = THREE.RepeatWrapping
        mirrored.repeat.x = -1
        mirrored.offset.x = 1
        mirrored.needsUpdate = true
        resolve({ profile, texture, mirrored })
      } catch {
        // Tainted canvas or decode failure: caller keeps the plain box.
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  assetCache.set(url, pending)
  return pending
}

function usePhotoAsset(url: string | undefined) {
  const [asset, setAsset] = useState<PhotoAsset | null | undefined>(undefined)
  useEffect(() => {
    if (!url) {
      setAsset(null)
      return
    }
    let alive = true
    void loadPhotoAsset(url).then((result) => {
      if (alive) setAsset(result)
    })
    return () => {
      alive = false
    }
  }, [url])
  return asset
}

const SEGMENTS = 28

// Lathe body with custom UVs: each vertex samples the photo where an
// orthographic front view would see it (x = r * sin(theta)), so the label
// reads straight on and the back shows the same art mirrored. Group 0 is the
// photo-wrapped body, group 1 the flat caps.
function buildRoundGeometry(
  profile: PhotoProfile,
  dims: { width: number; height: number; depth: number },
): THREE.BufferGeometry {
  const rx = dims.width / 2
  const rz = dims.depth / 2
  const rows: { y: number; r: number; center: number; v: number }[] = []
  // Cap rings at the very top and bottom use the end rows' radius.
  rows.push({ y: dims.height, r: profile.profile[0], center: profile.centers[0], v: 1 })
  for (let i = 0; i < PROFILE_ROWS; i += 1) {
    const t = (i + 0.5) / PROFILE_ROWS
    rows.push({ y: dims.height * (1 - t), r: profile.profile[i], center: profile.centers[i], v: 1 - t })
  }
  const last = PROFILE_ROWS - 1
  rows.push({ y: 0, r: profile.profile[last], center: profile.centers[last], v: 0 })

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const ringSize = SEGMENTS + 1
  rows.forEach((row) => {
    for (let s = 0; s <= SEGMENTS; s += 1) {
      const theta = (s / SEGMENTS) * Math.PI * 2
      const sin = Math.sin(theta)
      positions.push(rx * row.r * sin, row.y, rz * row.r * Math.cos(theta))
      uvs.push(Math.min(1, Math.max(0, row.center + 0.5 * row.r * sin)), row.v)
    }
  })
  for (let i = 0; i < rows.length - 1; i += 1) {
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = i * ringSize + s
      const b = a + ringSize
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const bodyCount = indices.length

  // Caps: fan from a center vertex to the top and bottom rings.
  const capRing = (ringIndex: number, y: number, up: boolean) => {
    const center = positions.length / 3
    positions.push(0, y, 0)
    uvs.push(0.5, 0.5)
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = ringIndex * ringSize + s
      if (up) indices.push(center, a + 1, a)
      else indices.push(center, a, a + 1)
    }
  }
  capRing(0, dims.height, true)
  capRing(rows.length - 1, 0, false)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.addGroup(0, bodyCount, 0)
  geometry.addGroup(bodyCount, indices.length - bodyCount, 1)
  geometry.computeVertexNormals()
  return geometry
}

const geometryCache = new Map<string, THREE.BufferGeometry>()
const materialCache = new Map<string, THREE.Material | THREE.Material[]>()

function edgeMaterial(profile: PhotoProfile) {
  const [r, g, b] = profile.edgeColor
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(r / 255, g / 255, b / 255).convertSRGBToLinear(),
    roughness: 0.75,
    metalness: 0.02,
  })
}

// The photo-built model (geometry + materials, shared through the caches
// above) for a product at the given size; undefined while the photo loads,
// null when there is no usable photo. Exported for the instanced case
// renderer in the v2 builder.
export function usePhotoModel(
  product: Pick<PlacedProduct, 'imageUrl' | 'label' | 'width' | 'height' | 'depth'>,
): { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] } | null | undefined {
  const asset = usePhotoAsset(product.imageUrl)
  const dims = { width: product.width, height: product.height, depth: product.depth }

  return useMemo(() => {
    if (asset === undefined) return undefined
    if (!asset) return null
    const round = looksRound(dims, product.label ?? '', asset.profile)
    const key = `${product.imageUrl}|${dims.width}|${dims.height}|${dims.depth}|${round}`
    let geometry = geometryCache.get(key)
    let material = materialCache.get(key)
    if (!geometry || !material) {
      if (round) {
        geometry = buildRoundGeometry(asset.profile, dims)
        material = [
          new THREE.MeshStandardMaterial({ map: asset.texture, roughness: 0.45, metalness: 0.05 }),
          edgeMaterial(asset.profile),
        ]
      } else {
        geometry = new THREE.BoxGeometry(dims.width, dims.height, dims.depth)
        geometry.translate(0, dims.height / 2, 0)
        const side = edgeMaterial(asset.profile)
        // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back).
        material = [
          side,
          side,
          side,
          side,
          new THREE.MeshStandardMaterial({ map: asset.texture, roughness: 0.6, metalness: 0.02 }),
          new THREE.MeshStandardMaterial({ map: asset.mirrored, roughness: 0.6, metalness: 0.02 }),
        ]
      }
      geometryCache.set(key, geometry)
      materialCache.set(key, material)
    }
    return { geometry, material }
    // dims are primitives read above; product identity beyond them is irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, product.imageUrl, product.label, dims.width, dims.height, dims.depth])

}

interface PhotoProductModelProps {
  product: PlacedProduct
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
  // Rendered until the photo is analyzed, or if it cannot be.
  fallback: React.ReactNode
}

export const PhotoProductModel: React.FC<PhotoProductModelProps> = ({
  product,
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  onClick,
  onPointerOver,
  onPointerOut,
  fallback,
}) => {
  const model = usePhotoModel(product)

  if (!model) return <>{fallback}</>

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onPointerOver?.()
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onPointerOut?.()
      }}
    >
      <mesh geometry={model.geometry} material={model.material} castShadow receiveShadow />
    </group>
  )
}
