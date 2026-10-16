import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { DisplaySpec } from '../../lib/builder/display-spec'
import { Pallet } from '../PalletDisplay/Pallet'
import { getCardboardMaterial } from '../PalletDisplay/materials/cardboardMaterial'

// The Kayco display itself, drawn from the same spec the placement engine
// uses: wood pallet, corrugate trays with printed lips, the cardboard core
// (full) or printed side/back panels with cubby dividers (half), and the
// header sign.

interface DisplayModelProps {
  spec: DisplaySpec
  lipColor: string
  lipText: string
  lipTextColor: string
  headerText: string
  headerTextColor: string
  headerBackground: string
  showHeader: boolean
  // Printed art (photo crops or uploads); null = drawn fallback.
  art?: { header: string | null; side: string | null; lip: string | null }
}

// Load an art image as a texture; re-render once it arrives (the canvas
// renders on demand).
function useArtTexture(url: string | null | undefined) {
  const invalidate = useThree((s) => s.invalidate)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) {
      setTex(null)
      return
    }
    let dead = false
    new THREE.TextureLoader().load(url, (t) => {
      if (dead) {
        t.dispose()
        return
      }
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      setTex(t)
      invalidate()
    })
    return () => {
      dead = true
    }
  }, [url, invalidate])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

// A copy of an art texture tiled `repeat` times across (for the repeating
// full-pallet lip print).
function useTiled(tex: THREE.Texture | null, repeat: number) {
  const out = useMemo(() => {
    if (!tex) return null
    const t = tex.clone()
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(repeat, 1)
    t.needsUpdate = true
    return t
  }, [tex, repeat])
  useEffect(() => () => out?.dispose(), [out])
  return out
}

const noRaycast = () => null

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)))
  return `#${c.getHexString()}`
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Printed tray lip: brand colour, a lighter wave, the lip text repeated.
function lipTexture(text: string, bg: string, fg: string, inches: number) {
  const pxPerIn = 48
  const w = Math.round(inches * pxPerIn)
  const h = Math.round(3.25 * pxPerIn)
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = shade(bg, 0.12)
    ctx.beginPath()
    ctx.moveTo(0, h * 0.78)
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.78 + Math.sin(x / 60) * h * 0.08)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = shade(bg, -0.12)
    ctx.fillRect(0, 0, w, h * 0.06)
    if (text) {
      ctx.fillStyle = fg
      ctx.font = `italic 800 ${Math.round(h * 0.42)}px "Maniz Display", "Arial Black", Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const repeats = Math.max(1, Math.floor(inches / 26))
      for (let i = 0; i < repeats; i += 1) {
        ctx.fillText(text, (w / repeats) * (i + 0.5), h * 0.45, (w / repeats) * 0.92)
      }
    }
  })
}

// Tall printed panel (half pallet sides/back).
function panelTexture(text: string, bg: string, fg: string, vertical: boolean, wIn: number, hIn: number) {
  const pxPerIn = 16
  const w = Math.round(wIn * pxPerIn)
  const h = Math.round(hIn * pxPerIn)
  return canvasTexture(w, h, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, shade(bg, 0.06))
    grad.addColorStop(1, shade(bg, -0.06))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = shade(bg, 0.18)
    ctx.lineWidth = 3
    for (let y = h * 0.1; y < h; y += h / 7) {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, y + Math.sin(x / 30 + y) * 6)
      ctx.stroke()
    }
    if (text) {
      ctx.save()
      ctx.fillStyle = fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (vertical) {
        ctx.translate(w / 2, h / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.font = `italic 800 ${Math.round(w * 0.32)}px "Maniz Display", "Arial Black", Arial, sans-serif`
        ctx.fillText(text, 0, 0, h * 0.9)
      } else {
        ctx.font = `italic 800 ${Math.round(h * 0.12)}px "Maniz Display", "Arial Black", Arial, sans-serif`
        ctx.fillText(text, w / 2, h * 0.5, w * 0.9)
      }
      ctx.restore()
    }
  })
}

const BRANDS = ['KEDEM', 'GEFEN', 'BARTENURA', 'YEHUDA', 'MANISCHEWITZ']

function headerTexture(text: string, bg: string, fg: string, wIn: number, hIn: number, withBrands: boolean) {
  const pxPerIn = 24
  const w = Math.round(wIn * pxPerIn)
  const h = Math.round(hIn * pxPerIn)
  return canvasTexture(w, h, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, shade(bg, 0.1))
    grad.addColorStop(1, shade(bg, -0.08))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = shade(bg, -0.25)
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (withBrands) {
      ctx.fillStyle = '#ffffff'
      const band = h * 0.3
      ctx.fillRect(0, 0, w, band)
      ctx.font = `800 ${Math.round(band * 0.42)}px "Arial Black", Arial, sans-serif`
      const slot = w / BRANDS.length
      const colors = ['#5b2a86', '#c8102e', '#1d4f91', '#0f7a3d', '#b5121b']
      BRANDS.forEach((brand, i) => {
        ctx.fillStyle = colors[i]
        ctx.fillText(brand, slot * (i + 0.5), band / 2, slot * 0.9)
      })
    }
    ctx.fillStyle = fg
    ctx.font = `italic 800 ${Math.round(h * (withBrands ? 0.36 : 0.3))}px "Maniz Display", Georgia, serif`
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    ctx.fillText(text, w / 2, withBrands ? h * 0.66 : h * 0.5, w * 0.9)
  })
}

function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps)
  useEffect(() => () => value.dispose(), [value])
  return value
}

export function DisplayModel({
  spec,
  lipColor,
  lipText,
  lipTextColor,
  headerText,
  headerTextColor,
  headerBackground,
  showHeader,
  art,
}: DisplayModelProps) {
  const cardboard = useMemo(() => getCardboardMaterial(), [])
  const isHalfType = spec.type === 'half'
  const artHeader = useArtTexture(art?.header)
  const artSide = useArtTexture(isHalfType ? art?.side : null)
  const artLip = useArtTexture(art?.lip)
  const lipImg = artLip?.image as { width: number; height: number } | undefined
  const lipAspect = lipImg ? lipImg.width / lipImg.height : 1
  // Half: one lip print spans the shelf. Full: the print repeats round the tray.
  const lipLongArt = useTiled(artLip, isHalfType ? 1 : Math.max(1, Math.round(spec.width / (spec.lipHeight * lipAspect))))
  const lipShortArt = useTiled(artLip, isHalfType ? 1 : Math.max(1, Math.round(spec.depth / (spec.lipHeight * lipAspect))))
  const panelColor = isHalfType ? '#05b5d3' : lipColor
  const panelPlain = useDisposable(() => new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.65 }), [panelColor])
  const dividerMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#eef6f7', roughness: 0.8 }), [])
  const yellowPlain = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#fcf405', roughness: 0.6 }), [])
  const coreMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c49a63', roughness: 0.92 }), [])
  const lipLong = useDisposable(() => lipTexture(lipText, lipColor, lipTextColor, spec.width), [lipText, lipColor, lipTextColor, spec.width])
  const lipShort = useDisposable(() => lipTexture(lipText, lipColor, lipTextColor, spec.depth), [lipText, lipColor, lipTextColor, spec.depth])
  const lipLongMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: lipLongArt ?? lipLong, roughness: 0.55 }), [lipLong, lipLongArt])
  const lipShortMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: lipShortArt ?? lipShort, roughness: 0.55 }), [lipShort, lipShortArt])
  const lipPlain = useDisposable(() => new THREE.MeshStandardMaterial({ color: artLip ? panelColor : lipColor, roughness: 0.55 }), [lipColor, artLip, panelColor])

  const isHalf = spec.type === 'half'
  const panelHeight = spec.structureTop - spec.palletHeight
  const sideTex = useDisposable(
    () => panelTexture(lipText, lipColor, lipTextColor, true, spec.depth, panelHeight),
    [lipText, lipColor, lipTextColor, spec.depth, panelHeight],
  )
  const sideMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: artSide ?? sideTex, roughness: 0.6 }), [sideTex, artSide])
  const backTex = useDisposable(
    () => panelTexture('', lipColor, lipTextColor, false, spec.width, panelHeight),
    [lipColor, lipTextColor, spec.width, panelHeight],
  )
  const backMat = useDisposable(
    () => (art?.side ? new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.65 }) : new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.6 })),
    [backTex, art?.side, panelColor],
  )
  const headerTex = useDisposable(
    () => headerTexture(headerText, headerBackground, headerTextColor, spec.header.width, spec.header.height, isHalf),
    [headerText, headerBackground, headerTextColor, spec.header.width, spec.header.height, isHalf],
  )
  const headerMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: artHeader ?? headerTex, roughness: 0.5 }), [headerTex, artHeader])

  const W = spec.width
  const D = spec.depth
  const t = spec.trayThickness
  const lt = spec.lipThickness
  const lh = spec.lipHeight

  // Box face order: +x, -x, +y, -y, +z, -z. Lips print on the outward face.
  const lipFront = [lipPlain, lipPlain, lipPlain, lipPlain, lipLongMat, lipPlain]
  const lipBack = [lipPlain, lipPlain, lipPlain, lipPlain, lipPlain, lipLongMat]
  const lipRight = [lipShortMat, lipPlain, lipPlain, lipPlain, lipPlain, lipPlain]
  const lipLeft = [lipPlain, lipShortMat, lipPlain, lipPlain, lipPlain, lipPlain]

  return (
    <group>
      <Pallet width={W} depth={D} height={spec.palletHeight} />

      {spec.levels.map((level, index) => {
        const floorBottom = level.floorY - t
        const next = spec.levels[index + 1]
        const lipY = floorBottom + lh / 2
        return (
          <group key={level.level}>
            {/* tray floor */}
            <mesh position={[0, level.floorY - t / 2, 0]} material={cardboard} castShadow receiveShadow raycast={noRaycast}>
              <boxGeometry args={[W, t, D]} />
            </mesh>
            {/* printed front lip (+ back / sides on the full island) */}
            <mesh position={[0, lipY, D / 2 - lt / 2]} material={lipFront} castShadow raycast={noRaycast}>
              <boxGeometry args={[W, lh, lt]} />
            </mesh>
            {!isHalf && (
              <>
                <mesh position={[0, lipY, -D / 2 + lt / 2]} material={lipBack} castShadow raycast={noRaycast}>
                  <boxGeometry args={[W, lh, lt]} />
                </mesh>
                <mesh position={[W / 2 - lt / 2, lipY, 0]} material={lipRight} castShadow raycast={noRaycast}>
                  <boxGeometry args={[lt, lh, D]} />
                </mesh>
                <mesh position={[-W / 2 + lt / 2, lipY, 0]} material={lipLeft} castShadow raycast={noRaycast}>
                  <boxGeometry args={[lt, lh, D]} />
                </mesh>
              </>
            )}

            {/* full: cardboard core carrying the next tray */}
            {!isHalf && level.core && next && (
              <mesh
                position={[
                  (level.core.x0 + level.core.x1) / 2,
                  level.floorY + (next.floorY - t - level.floorY) / 2,
                  (level.core.z0 + level.core.z1) / 2,
                ]}
                material={coreMaterial}
                castShadow
                receiveShadow
                raycast={noRaycast}
              >
                <boxGeometry args={[level.core.x1 - level.core.x0, next.floorY - t - level.floorY, level.core.z1 - level.core.z0]} />
              </mesh>
            )}

            {/* half: cubby dividers up to the next shelf */}
            {isHalf &&
              level.cubbies &&
              next &&
              level.cubbies.slice(0, -1).map((c, k) => (
                <mesh
                  key={k}
                  position={[c.x1 + spec.dividerThickness / 2, level.floorY + (next.floorY - t - level.floorY) / 2, (c.z0 + c.z1) / 2 - 0.5]}
                  material={dividerMat}
                  castShadow
                  raycast={noRaycast}
                >
                  <boxGeometry args={[spec.dividerThickness, next.floorY - t - level.floorY, c.z1 - c.z0 - 1]} />
                </mesh>
              ))}
          </group>
        )
      })}

      {isHalf ? (
        <>
          {/* printed side panels + back panel */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * (W / 2 - spec.panelThickness / 2), spec.palletHeight + panelHeight / 2, 0]}
              material={
                side < 0
                  ? [panelPlain, sideMat, panelPlain, panelPlain, panelPlain, panelPlain]
                  : [sideMat, panelPlain, panelPlain, panelPlain, panelPlain, panelPlain]
              }
              castShadow
              receiveShadow
              raycast={noRaycast}
            >
              <boxGeometry args={[spec.panelThickness, panelHeight, D]} />
            </mesh>
          ))}
          <mesh
            position={[0, spec.palletHeight + panelHeight / 2, -D / 2 + spec.panelThickness / 2]}
            material={[panelPlain, panelPlain, panelPlain, panelPlain, backMat, panelPlain]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <boxGeometry args={[W, panelHeight, spec.panelThickness]} />
          </mesh>
          {showHeader && (
            <mesh
              position={[0, spec.header.y + spec.header.height / 2, -D / 2 + spec.panelThickness / 2]}
              material={[panelPlain, panelPlain, panelPlain, panelPlain, headerMat, panelPlain]}
              castShadow
              raycast={noRaycast}
            >
              <boxGeometry args={[spec.header.width, spec.header.height, 0.6]} />
            </mesh>
          )}
        </>
      ) : (
        showHeader && (
          <group>
            {/* pop-up header box in the middle of the top tray, printed on all four faces */}
            <mesh
              position={[0, spec.header.y + spec.header.height / 2, 0]}
              material={artHeader ? [headerMat, headerMat, yellowPlain, yellowPlain, headerMat, headerMat] : [cardboard, cardboard, cardboard, cardboard, headerMat, headerMat]}
              castShadow
              raycast={noRaycast}
            >
              <boxGeometry args={[spec.header.width, spec.header.height, artHeader ? spec.header.width : 0.5]} />
            </mesh>
          </group>
        )
      )}
    </group>
  )
}
