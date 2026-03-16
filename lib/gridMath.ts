import { WALL_FACES } from "@/lib/constants";
import { getDisplayHeight, getTowerFootprint } from "@/lib/palletPresets";
import type { PalletConfig, WallFace } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

export interface WallMetrics {
  width: number;
  height: number;
  cellWidth: number;
  rowHeight: number;
}

export function getShelfWalls(pallet: PalletConfig) {
  return WALL_FACES.filter((face) => pallet.display.walls[face].wallType === "shelves");
}

export function getWallMetrics(pallet: PalletConfig, face: WallFace): WallMetrics {
  const tower = getTowerFootprint(pallet);
  const displayHeight = getDisplayHeight(pallet.display);
  const width = face === "front" || face === "back" ? tower.width : tower.depth;
  const gridColumns = Math.max(1, pallet.display.walls[face].gridColumns);

  return {
    width,
    height: displayHeight,
    cellWidth: width / gridColumns,
    rowHeight: pallet.display.rowHeight,
  };
}

export function getProductColSpan(
  product: Product,
  pallet: PalletConfig,
  face: WallFace,
  rotation = 0,
) {
  const metrics = getWallMetrics(pallet, face);
  const width = rotation % 180 === 0 ? product.dimensions.width : product.dimensions.depth;

  return Math.max(1, Math.min(pallet.display.walls[face].gridColumns, Math.ceil(width / metrics.cellWidth)));
}

export function detectPlacementConflict(
  placements: PlacedItem[],
  candidate: Pick<PlacedItem, "wall" | "shelfRow" | "gridCol" | "colSpan">,
  ignoreId?: string,
) {
  const start = candidate.gridCol;
  const end = candidate.gridCol + candidate.colSpan - 1;

  return placements.some((placement) => {
    if (ignoreId && placement.id === ignoreId) {
      return false;
    }

    if (placement.wall !== candidate.wall || placement.shelfRow !== candidate.shelfRow) {
      return false;
    }

    const placementStart = placement.gridCol;
    const placementEnd = placement.gridCol + placement.colSpan - 1;

    return start <= placementEnd && placementStart <= end;
  });
}

export function getPlacementTransform(
  pallet: PalletConfig,
  placement: PlacedItem,
  product: Product,
) {
  const tower = getTowerFootprint(pallet);
  const displayHeight = getDisplayHeight(pallet.display);
  const metrics = getWallMetrics(pallet, placement.wall);
  const wallThickness = pallet.display.wallThickness;
  const towerCenterY = pallet.base.height + displayHeight / 2 + 0.6;
  const usableHeight = displayHeight - 8;
  const rowStride = pallet.display.rowHeight + pallet.display.stripHeight;
  const rowCenter =
    towerCenterY -
    displayHeight / 2 +
    2 +
    pallet.display.rowHeight / 2 +
    placement.shelfRow * rowStride;
  const colCenter =
    -metrics.width / 2 + metrics.cellWidth * placement.gridCol + (metrics.cellWidth * placement.colSpan) / 2;
  const itemWidth = Math.min(metrics.cellWidth * placement.colSpan - 0.8, product.dimensions.width);
  const itemHeight = Math.min(pallet.display.rowHeight - 1.2, product.dimensions.height);
  const itemDepth = Math.max(2.4, Math.min(12, product.dimensions.depth));
  // Products sit inside the recessed shelf (negative = inward from wall face)
  const forwardOffset = -(itemDepth / 2 + 0.6);

  switch (placement.wall) {
    case "front":
      return {
        position: [colCenter, rowCenter, tower.depth / 2 + forwardOffset] as const,
        rotation: [0, 0, 0] as const,
        size: [itemWidth, itemHeight, itemDepth] as const,
        maxHeight: usableHeight,
      };
    case "back":
      return {
        position: [-colCenter, rowCenter, -tower.depth / 2 - forwardOffset] as const,
        rotation: [0, Math.PI, 0] as const,
        size: [itemWidth, itemHeight, itemDepth] as const,
        maxHeight: usableHeight,
      };
    case "left":
      return {
        position: [-tower.width / 2 - forwardOffset, rowCenter, -colCenter] as const,
        rotation: [0, Math.PI / 2, 0] as const,
        size: [itemWidth, itemHeight, itemDepth] as const,
        maxHeight: usableHeight,
      };
    case "right":
      return {
        position: [tower.width / 2 + forwardOffset, rowCenter, colCenter] as const,
        rotation: [0, -Math.PI / 2, 0] as const,
        size: [itemWidth, itemHeight, itemDepth] as const,
        maxHeight: usableHeight,
      };
  }
}

export function getDropCellFromPoint(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
}) {
  const left = 0.18;
  const right = 0.82;
  const top = 0.16;
  const bottom = 0.84;

  const xNorm = params.x / params.width;
  const yNorm = params.y / params.height;
  const inBounds = xNorm >= left && xNorm <= right && yNorm >= top && yNorm <= bottom;

  if (!inBounds) {
    return { valid: false, gridCol: 0, shelfRow: 0 };
  }

  const colRange = (xNorm - left) / (right - left);
  const rowRange = (yNorm - top) / (bottom - top);

  return {
    valid: true,
    gridCol: Math.min(params.columns - 1, Math.max(0, Math.floor(colRange * params.columns))),
    shelfRow: Math.min(params.rows - 1, Math.max(0, Math.floor((1 - rowRange) * params.rows))),
  };
}
