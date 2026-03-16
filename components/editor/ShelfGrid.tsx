"use client";

import { useCallback, useMemo, useState } from "react";
import { Layers, Package2, Trash2 } from "lucide-react";

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
  activeProduct: Product | null;
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
  activeProduct,
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
  const placementProduct = draggingProduct ?? activeProduct;

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

  /* ─── Non-shelf wall state ─── */
  if (wallConfig.wallType !== "shelves") {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)]">
            <Layers className="h-5 w-5 text-[var(--muted)]" />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--foreground)]">
              {wallConfig.wallType === "branded-panel"
                ? "Branded Panel"
                : "Open Back"}
            </p>
            <p className="mt-1.5 text-sm text-[var(--muted)] max-w-xs">
              {wallConfig.wallType === "branded-panel"
                ? "This wall displays a branded graphic panel."
                : "This wall is open for against-wall placement."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col"
      role="grid"
      aria-label={`Shelf grid for ${wall} wall`}
      onClick={() => onSelectPlacement(null)}
    >
      {/* Column headers */}
      <div className="mb-2 flex pl-14" role="row" aria-hidden="true">
        {Array.from({ length: columns }).map((_, col) => (
          <div
            key={col}
            className="flex-1 text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide"
          >
            Col {col + 1}
          </div>
        ))}
      </div>

      {/* Grid rows - top row = highest shelf number */}
      <div className="flex flex-1 flex-col gap-1.5">
        {Array.from({ length: rows }).map((_, visualRow) => {
          const shelfRow = rows - 1 - visualRow;

          return (
            <div key={shelfRow} className="flex items-stretch gap-0" role="row">
              {/* Row label */}
              <div className="flex w-14 shrink-0 items-center justify-end pr-3" role="rowheader">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] tabular-nums">
                  Row {shelfRow + 1}
                </span>
              </div>

              {/* Cells */}
              <div className="flex flex-1 gap-1">
                {Array.from({ length: columns }).map((_, col) => {
                  const existingPlacement = getPlacementAt(shelfRow, col);
                  const existingProduct = existingPlacement
                    ? productMap.get(existingPlacement.productId)
                    : null;

                  const isPlacementStart =
                    existingPlacement && existingPlacement.gridCol === col;
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

                  /* ─── Placed product cell ─── */
                  if (isPlacementStart && existingProduct) {
                    return (
                      <div
                        key={col}
                        role="gridcell"
                        aria-label={`${existingProduct.name}, row ${shelfRow + 1}, column ${col + 1}`}
                        className={cn(
                          "relative flex min-h-[76px] cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all duration-150",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm"
                            : "border-transparent hover:border-[var(--line-strong)] hover:shadow-sm",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlacement(existingPlacement.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectPlacement(existingPlacement.id);
                          }
                          if (e.key === "Delete" || e.key === "Backspace") {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeletePlacement(existingPlacement.id);
                          }
                        }}
                        tabIndex={0}
                        style={{
                          flex: existingPlacement.colSpan,
                          backgroundColor: isSelected
                            ? undefined
                            : existingProduct.color + "12",
                        }}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
                          style={{ backgroundColor: existingProduct.color }}
                        >
                          <Package2 className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[var(--foreground)] leading-tight">
                            {existingProduct.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--muted)]">
                            {existingProduct.sku} &middot; x
                            {existingPlacement.quantity}
                          </p>
                        </div>
                        {isSelected && (
                          <button
                            aria-label={`Remove ${existingProduct.name}`}
                            className="btn btn-danger btn-icon btn-sm shrink-0"
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

                  /* ─── Empty cell — drop target ─── */
                  return (
                    <div
                      key={col}
                      role="gridcell"
                      aria-label={`Empty cell, row ${shelfRow + 1}, column ${col + 1}${activeProduct ? `, click to place ${activeProduct.name}` : ""}`}
                      className={cn(
                        "flex min-h-[76px] flex-1 items-center justify-center rounded-lg border-2 border-dashed transition-all duration-150",
                        isHovered && hoverCell?.valid
                          ? "border-[var(--success)] bg-[var(--success-soft)]"
                          : isHovered && !hoverCell?.valid
                            ? "border-[var(--danger)] bg-[var(--danger-soft)]"
                            : "border-[var(--line)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] hover:border-[var(--line-strong)]",
                        activeProduct && "cursor-copy",
                      )}
                      tabIndex={activeProduct ? 0 : -1}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (!activeProduct) {
                          return;
                        }

                        onPlace({
                          wall,
                          shelfRow,
                          gridCol: col,
                          product: activeProduct,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (!activeProduct) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onPlace({
                            wall,
                            shelfRow,
                            gridCol: col,
                            product: activeProduct,
                          });
                        }
                      }}
                      onDragLeave={() => setHoverCell(null)}
                      onDragOver={(e) => handleDragOver(e, shelfRow, col)}
                      onDrop={(e) => handleDrop(e, shelfRow, col)}
                    >
                      {isHovered && placementProduct && (
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            hoverCell?.valid
                              ? "text-[var(--success-fg)]"
                              : "text-[var(--danger)]",
                          )}
                        >
                          {hoverCell?.valid ? "Drop here" : "Occupied"}
                        </span>
                      )}
                      {!isHovered && activeProduct && !draggingProduct && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]/40">
                          Place
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

      {/* Strip divider */}
      <div className="mt-4 flex items-center gap-3 pl-14">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          {activeProduct
            ? `Click open cells to place ${activeProduct.name}`
            : wallConfig.stripText || "Shelf display"}
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>
    </div>
  );
}
