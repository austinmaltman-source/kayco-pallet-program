import type { ExtremePoint } from './types'
import type { AABB } from '../geometry/aabb'

function key(point: ExtremePoint): string {
  return `${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`
}

function insideBox(point: ExtremePoint, box: AABB): boolean {
  return (
    point.x >= box.min.x &&
    point.x < box.max.x &&
    point.y >= box.min.y &&
    point.y < box.max.y &&
    point.z >= box.min.z &&
    point.z < box.max.z
  )
}

export function updateExtremePoints(
  points: ExtremePoint[],
  placedBox: AABB,
  placedBoxes: AABB[],
  bounds: { width: number; depth: number; maxY: number },
): ExtremePoint[] {
  const next = [
    ...points.filter((point) => !insideBox(point, placedBox)),
    { x: placedBox.max.x, y: placedBox.min.y, z: placedBox.min.z },
    { x: placedBox.min.x, y: placedBox.max.y, z: placedBox.min.z },
    { x: placedBox.min.x, y: placedBox.min.y, z: placedBox.max.z },
  ].filter(
    (point) =>
      point.x >= 0 &&
      point.z >= 0 &&
      point.y >= 0 &&
      point.x <= bounds.width &&
      point.z <= bounds.depth &&
      point.y <= bounds.maxY &&
      !placedBoxes.some((box) => insideBox(point, box)),
  )

  const deduped = new Map<string, ExtremePoint>()
  for (const point of next) deduped.set(key(point), point)

  return Array.from(deduped.values()).sort(
    (a, b) => a.y - b.y || a.z - b.z || a.x - b.x,
  )
}
