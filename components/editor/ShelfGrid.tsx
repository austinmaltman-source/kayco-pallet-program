"use client";

import { useCallback, useMemo, useState } from "react";
import { Package2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { detectPlacementConflict, getProductColSpan } from "@/lib/gridMath";
import type { PalletConfig, WallFace } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

interface ShelfGridProps {
  pallet: PalletConfig;
  wall: WallFace;
  placements: PlacedItem[];
  products: Product[];
  draggingProductId: string | null;
  selectedPlacementId: string | null;
  onPlace: (params: {
    wall: WallFace;
    shelfRow: number;
    gridCol: number;
    product: Product;
  }) => void;
  onSelectPlacement: (id: string | null) => void;
  onDeletePlacement: (id: string) => void;
}

interface HoverCell {
  row: number;
  col: number;
  valid: boolean;
  colSpan: number;
}

export function ShelfGrid({
  pallet,
  wall,
  placements,
  products,
  draggingProductId,
  selectedPlacementId,
  onPlace,
  onSelectPlacement,
  onDeletePlacement,
}: ShelfGridProps) {
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null);

  const wallConfig = pallet.display.walls[wall];
  const columns = wallConfig.gridColumns;
  const rows = pallet.display.shelfRows;

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const draggingProduct = draggingProductId
    ? productMap.get(draggingProductId) ?? null
    : null;

  const wallPlacements = useMemo(
    () => placements.filter((p) => p.wall === wall),
    [placements, wall],
  );

  const getPlacementAt = useCallback(
    (row: number, col: number) => {
      return wallPlacements.find(
        (p) =>
          p.shelfRow === row &&
          col >= p.gridCol &&
          col < p.gridCol + p.colSpan,
      );
    },
    [wallPlacements],
  );

  function handleDragOver(
    e: React.DragEvent,
    row: number,
    col: number,
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";

    if (!draggingProduct) return;

    const colSpan = getProductColSpan(draggingProduct, pallet, wall);
    const clampedCol = Math.min(col, columns - colSpan);

    const conflict = detectPlacementConflict(placements, {
      wall,
      shelfRow: row,
      gridCol: clampedCol,
      colSpan,
    });

    setHoverCell({
      row,
      col: clampedCol,
      valid: !conflict,
      colSpan,
    });
  }

  function handleDrop(
    e: React.DragEvent,
    row: number,
    col: number,
  ) {
    e.preventDefault();

    if (!draggingProduct) return;

    const colSpan = getProductColSpan(draggingProduct, pallet, wall);
    const clampedCol = Math.min(col, columns - colSpan);

    const conflict = detectPlacementConflict(placements, {
      wall,
      shelfRow: row,
      gridCol: clampedCol,
      colSpan,
    });

    if (!conflict) {
      onPlace({
        wall,
        shelfRow: row,
        gridCol: clampedCol,
        product: draggingProduct,
      });
    }

    setHoverCell(null);
  }

  if (wallConfig.wallType !== "shelves") {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--line)] p-12 text-center text-[var(--muted)]">
        <div>
          <p className="text-lg font-semibold">
            {wallConfig.wallType === "branded-panel"
              ? "Branded Panel"
              : "Open Back"}
          </p>
          <p className="mt-2 text-sm">
            {wallConfig.wallType === "branded-panel"
              ? "This wall displays a branded graphic panel."
              : "This wall is open for against-wall placement."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col"
      onClick={() => onSelectPlacement(null)}
    >
      {/* Column headers */}
      <div className="mb-1 flex pl-14">
        {Array.from({ length: columns }).map((_, col) => (
          <div
            key={col}
            className="flex-1 text-center text-xs font-medium text-[var(--muted)]"
          >
            Col {col + 1}
          </div>
        ))}
      </div>

      {/* Grid rows - top row = highest shelf number */}
      <div className="flex flex-1 flex-col gap-1">
        {Array.from({ length: rows }).map((_, visualRow) => {
          const shelfRow = rows - 1 - visualRow;

          return (
            <div key={shelfRow} className="flex items-stretch gap-0">
              {/* Row label */}
              <div className="flex w-14 shrink-0 items-center justify-end pr-3 text-xs font-medium text-[var(--muted)]">
                Row {shelfRow + 1}
              </div>

              {/* Cells */}
              <div className="flex flex-1 gap-0">
                {Array.from({ length: columns }).map((_, col) => {
                  const existingPlacement = getPlacementAt(shelfRow, col);
                  const existingProduct = existingPlacement
                    ? productMap.get(existingPlacement.productId)
                    : null;

                  // Only render the placement block on its first column
                  const isPlacementStart =
                    existingPlacement && existingPlacement.gridCol === col;
                  // Skip rendering on spanned columns (they're covered by the wide block)
                  const isSpannedCell =
                    existingPlacement && existingPlacement.gridCol !== col;

                  const isHovered =
                    hoverCell &&
                    hoverCell.row === shelfRow &&
                    col >= hoverCell.col &&
                    col < hoverCell.col + hoverCell.colSpan;

                  const isSelected =
                    existingPlacement?.id === selectedPlacementId;

                  if (isSpannedCell) return null;

                  if (isPlacementStart && existingProduct) {
                    return (
                      <div
                        key={col}
                        className={cn(
                          "relative flex min-h-[80px] cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                          isSelected
                            ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                            : "border-transparent hover:border-[var(--line-strong)]",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlacement(existingPlacement.id);
                        }}
                        style={{
                          flex: existingPlacement.colSpan,
                          backgroundColor: existingProduct.color + "18",
                        }}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: existingProduct.color }}
                        >
                          <Package2 className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-tight">
                            {existingProduct.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {existingProduct.sku} - x
                            {existingPlacement.quantity}
                          </p>
                        </div>
                        {isSelected && (
                          <button
                            aria-label="Remove placement"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--danger)] text-white transition-colors hover:bg-[#853632]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePlacement(existingPlacement.id);
                            }}
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  // Empty cell - drop target
                  return (
                    <div
                      key={col}
                      className={cn(
                        "flex min-h-[80px] flex-1 items-center justify-center rounded-xl border-2 border-dashed transition-colors",
                        isHovered && hoverCell?.valid
                          ? "border-[var(--success)] bg-[var(--success)]/8"
                          : isHovered && !hoverCell?.valid
                            ? "border-[var(--danger)] bg-[var(--danger)]/8"
                            : "border-[var(--line)] bg-white/40 hover:bg-white/60",
                      )}
                      onDragLeave={() => setHoverCell(null)}
                      onDragOver={(e) => handleDragOver(e, shelfRow, col)}
                      onDrop={(e) => handleDrop(e, shelfRow, col)}
                    >
                      {isHovered && draggingProduct && (
                        <span className="text-xs font-medium text-[var(--muted)]">
                          {hoverCell?.valid ? "Drop here" : "Occupied"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Strip divider accent */}
      <div className="mt-3 flex items-center gap-3 pl-14">
        <div className="h-1 flex-1 rounded-full bg-[var(--primary)]/15" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]/50">
          {wallConfig.stripText || "Shelf display"}
        </span>
        <div className="h-1 flex-1 rounded-full bg-[var(--primary)]/15" />
      </div>
    </div>
  );
}
