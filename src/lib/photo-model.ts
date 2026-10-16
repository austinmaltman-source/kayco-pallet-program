// Turn ONE front product photo (a cut-out on white, as the Kayco API serves
// them) into the inputs for a 3D model: where the product sits in the frame,
// its silhouette profile row by row, an edge color for the unphotographed
// sides, and whether it reads as round (bottle/jar/cup/can) or a box.
//
// Pure functions over raw RGBA pixels so they are unit-testable; the
// browser-side loader lives in the renderer.

export interface PhotoProfile {
  // Product bounding box inside the photo, in pixels.
  bbox: { x: number; y: number; width: number; height: number }
  // Half-width of the silhouette for PROFILE_ROWS rows, top to bottom, as a
  // fraction of the widest row (1 = widest). Drives the lathe radius.
  profile: number[]
  // Horizontal center of each sampled row relative to the bbox, 0..1. Lets
  // the photo be wrapped around a silhouette that is not perfectly centered.
  centers: number[]
  // True when the silhouette curves (neck, shoulders, taper) rather than
  // being a straight-sided rectangle.
  curved: boolean
  // Average color of the outermost product pixels: paints the sides, top and
  // bottom that the photo does not show.
  edgeColor: [number, number, number]
}

export const PROFILE_ROWS = 32

// Kayco shots sit on white; a few are transparent. Near-white or nearly
// transparent pixels are background.
export function isBackground(r: number, g: number, b: number, a: number): boolean {
  return a < 24 || (r > 242 && g > 242 && b > 242)
}

export function analyzePhoto(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): PhotoProfile | null {
  const rowSpans: ({ left: number; right: number } | null)[] = []
  for (let y = 0; y < height; y += 1) {
    let left = -1
    let right = -1
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (!isBackground(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) {
        if (left < 0) left = x
        right = x
      }
    }
    rowSpans.push(left < 0 ? null : { left, right })
  }

  const top = rowSpans.findIndex((span) => span !== null)
  if (top < 0) return null
  let bottom = height - 1
  while (rowSpans[bottom] === null) bottom -= 1
  let minX = width
  let maxX = 0
  for (let y = top; y <= bottom; y += 1) {
    const span = rowSpans[y]
    if (!span) continue
    minX = Math.min(minX, span.left)
    maxX = Math.max(maxX, span.right)
  }
  const bbox = { x: minX, y: top, width: maxX - minX + 1, height: bottom - top + 1 }
  // Specks and tiny thumbnails are not a product.
  if (bbox.width < 4 || bbox.height < 4) return null

  // Sample the silhouette at fixed rows. A row with no product pixels (a gap
  // in a label, a stray anti-alias line) borrows its nearest neighbour.
  const rawHalf: number[] = []
  const rawCenter: number[] = []
  for (let i = 0; i < PROFILE_ROWS; i += 1) {
    const y = Math.round(top + ((i + 0.5) / PROFILE_ROWS) * (bbox.height - 1))
    let span = rowSpans[y]
    for (let d = 1; !span && d < 6; d += 1) span = rowSpans[y - d] ?? rowSpans[y + d] ?? null
    if (!span) {
      rawHalf.push(rawHalf[rawHalf.length - 1] ?? 0)
      rawCenter.push(rawCenter[rawCenter.length - 1] ?? 0.5)
      continue
    }
    rawHalf.push((span.right - span.left + 1) / 2)
    rawCenter.push((span.left + span.right + 1) / 2 - minX)
  }
  const widest = Math.max(...rawHalf, 1)
  const profile = rawHalf.map((half) => Math.max(0.04, half / widest))
  const centers = rawCenter.map((center) => center / bbox.width)

  // Curved = the body narrows meaningfully somewhere (bottle neck, cup taper)
  // away from the very top and bottom rows, which anti-aliasing rounds off.
  const inner = profile.slice(2, -2)
  const curved = inner.length > 0 && Math.min(...inner) < 0.88

  // Edge color: the outermost product pixel of every row, both sides.
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = top; y <= bottom; y += 1) {
    const span = rowSpans[y]
    if (!span) continue
    for (const x of [span.left + 1, span.right - 1]) {
      const i = (y * width + Math.min(Math.max(x, 0), width - 1)) * 4
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      n += 1
    }
  }
  const edgeColor: [number, number, number] =
    n > 0 ? [r / n, g / n, b / n] : [200, 200, 200]

  return { bbox, profile, centers, curved, edgeColor }
}

const ROUND_WORDS =
  /\b(BOTTLE|BTL|JAR|CAN|CANS|CUP|CUPS|JUICE|OIL|VINEGAR|SAUCE|HONEY|WINE|GRAPE|SODA|SELTZER|WATER|SYRUP|DRESSING|MAYO|KETCHUP|MUSTARD|SPRAY|TUB|PICKLES?|OLIVES)\b/

// Round model only when the footprint is round-ish (width ~ depth) AND either
// the outline curves or the name says it is a round container. A square
// footprint alone is not enough: plenty of square boxes exist.
export function looksRound(
  dims: { width: number; depth: number },
  name: string,
  profile: Pick<PhotoProfile, 'curved'> | null,
): boolean {
  const big = Math.max(dims.width, dims.depth)
  if (big <= 0) return false
  const squareFootprint = Math.abs(dims.width - dims.depth) / big < 0.15
  if (!squareFootprint) return false
  return Boolean(profile?.curved) || ROUND_WORDS.test(name.toUpperCase())
}
