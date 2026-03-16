"use client";

import { useCallback, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
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

/* ─── Droppable cell wrapper ─── */
function DroppableCell({
  id,
  valid,
  children,
}: {
  id: string;
  valid: boolean;
  children: (isOver: boolean) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { valid },
  });

  return (
    <div ref={setNodeRef} className="flex flex-1">
      {children(isOver)}
    </div>
  );
}

/* ─── Spring config for placed items ─── */
const placedItemVariants = {
  initial: { scale: 0.85, opacity: 0, y: 8 },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 22,
      mass: 0.8,
    },
  },
  exit: {
    scale: 0.85,
    opacity: 0,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
};

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

  /** Check if a drop at (row, col) would be valid for the current dragging product */
  const isCellValid = useCallback(
    (row: number, col: number) => {
      if (!draggingProduct) return true;
      const colSpan = getProductColSpan(draggingProduct, pallet, wall);
      const clampedCol = Math.min(col, columns - colSpan);
      const conflict = detectPlacementConflict(placements, {
        wall,
        shelfRow: row,
        gridCol: clampedCol,
        colSpan,
      });
      return !conflict;
    },
    [draggingProduct, pallet, wall, columns, placements],
  );

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
                <AnimatePresence mode="popLayout">
                  {Array.from({ length: columns }).map((_, col) => {
                    const existingPlacement = getPlacementAt(shelfRow, col);
                    const existingProduct = existingPlacement
                      ? productMap.get(existingPlacement.productId)
                      : null;

                    const isPlacementStart =
                      existingPlacement && existingPlacement.gridCol === col;
                    const isSpannedCell =
                      existingPlacement && existingPlacement.gridCol !== col;

                    const isSelected =
                      existingPlacement?.id === selectedPlacementId;

                    if (isSpannedCell) return null;

                    /* ─── Placed product cell ─── */
                    if (isPlacementStart && existingProduct) {
                      return (
                        <motion.div
                          key={existingPlacement.id}
                          variants={placedItemVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          layout
                          layoutId={existingPlacement.id}
                          role="gridcell"
                          aria-label={`${existingProduct.name}, row ${shelfRow + 1}, column ${col + 1}`}
                          className={cn(
                            "relative flex min-h-[76px] cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors duration-150",
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
                          <AnimatePresence>
                            {isSelected && (
                              <motion.button
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                aria-label={`Remove ${existingProduct.name}`}
                                className="btn btn-danger btn-icon btn-sm shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeletePlacement(existingPlacement.id);
                                }}
                                type="button"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    }

                    /* ─── Empty cell — droppable target ─── */
                    const cellId = `cell-${wall}-${shelfRow}-${col}`;
                    const valid = isCellValid(shelfRow, col);

                    return (
                      <DroppableCell key={col} id={cellId} valid={valid}>
                        {(isOver) => (
                          <div
                            role="gridcell"
                            aria-label={`Empty cell, row ${shelfRow + 1}, column ${col + 1}${activeProduct ? `, click to place ${activeProduct.name}` : ""}`}
                            className={cn(
                              "flex min-h-[76px] flex-1 items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200",
                              isOver && valid
                                ? "border-[var(--success)] bg-[var(--success-soft)] scale-[1.02] shadow-md"
                                : isOver && !valid
                                  ? "border-[var(--danger)] bg-[var(--danger-soft)] scale-[0.98]"
                                  : draggingProduct
                                    ? "border-[var(--line-strong)] bg-[var(--surface-1)]/80 border-solid"
                                    : "border-[var(--line)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] hover:border-[var(--line-strong)]",
                              activeProduct && !draggingProduct && "cursor-copy",
                            )}
                            tabIndex={activeProduct ? 0 : -1}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!activeProduct) return;
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
                          >
                            <AnimatePresence mode="wait">
                              {isOver && draggingProduct && (
                                <motion.span
                                  key="hover-label"
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.15 }}
                                  className={cn(
                                    "text-[11px] font-semibold",
                                    valid
                                      ? "text-[var(--success-fg)]"
                                      : "text-[var(--danger)]",
                                  )}
                                >
                                  {valid ? "Drop here" : "Occupied"}
                                </motion.span>
                              )}
                              {!isOver && activeProduct && !draggingProduct && (
                                <motion.span
                                  key="place-label"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 0.4 }}
                                  className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                                >
                                  Place
                                </motion.span>
                              )}
                              {!isOver && draggingProduct && (
                                <motion.div
                                  key="drop-indicator"
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 0.3, scale: 1 }}
                                  transition={{ duration: 0.2 }}
                                  className="h-2.5 w-2.5 rounded-full bg-[var(--muted-foreground)]"
                                />
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </DroppableCell>
                    );
                  })}
                </AnimatePresence>
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
