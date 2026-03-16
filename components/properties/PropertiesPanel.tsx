"use client";

import { BoxSelect, RotateCw, Trash2 } from "lucide-react";

import { WALL_LABELS } from "@/lib/constants";
import { usePlacementStore } from "@/stores/usePlacementStore";
import type { PalletConfig } from "@/types/pallet";
import type { Product } from "@/types/product";

export function PropertiesPanel({
  pallet,
  products,
  onDeleteSelected,
  onRotateSelected,
}: {
  pallet: PalletConfig;
  products: Product[];
  onDeleteSelected: () => void;
  onRotateSelected: () => void;
}) {
  const placements = usePlacementStore((state) => state.placements);
  const selectedPlacementId = usePlacementStore((state) => state.selectedPlacementId);
  const updatePlacement = usePlacementStore((state) => state.updatePlacement);
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedPlacement?.productId) ?? null;

  return (
    <section className="panel-surface rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <BoxSelect className="h-5 w-5 text-[var(--primary)]" />
        <h2 className="display-font text-lg font-semibold">Selection</h2>
      </div>

      {selectedPlacement && selectedProduct ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] p-4">
            <p className="text-sm font-semibold">{selectedProduct.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {selectedProduct.sku}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {WALL_LABELS[selectedPlacement.wall]} wall, row {selectedPlacement.shelfRow + 1}, column{" "}
              {selectedPlacement.gridCol + 1}
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--muted)]">Quantity</span>
            <input
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-4 py-3 outline-none transition-colors focus:border-[var(--primary)]"
              min={1}
              onChange={(event) =>
                updatePlacement(selectedPlacement.id, {
                  quantity: Math.max(1, Number(event.target.value) || 1),
                })
              }
              type="number"
              value={selectedPlacement.quantity}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--muted)]">Facing mode</span>
            <select
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-4 py-3 outline-none transition-colors focus:border-[var(--primary)]"
              onChange={(event) =>
                updatePlacement(selectedPlacement.id, {
                  displayMode: event.target.value as typeof selectedPlacement.displayMode,
                })
              }
              value={selectedPlacement.displayMode}
            >
              <option value="face-out">Face out</option>
              <option value="spine-out">Spine out</option>
            </select>
          </label>

          <div className="flex gap-3">
            <button
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-4 py-3 text-sm font-semibold transition-colors hover:bg-[var(--surface-1)]"
              onClick={onRotateSelected}
              type="button"
            >
              <RotateCw className="h-4 w-4" />
              Rotate
            </button>
            <button
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--danger)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#853632]"
              onClick={onDeleteSelected}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-8 text-sm leading-6 text-[var(--muted)]">
          Select a placed item in the scene to edit quantity, facing mode, or rotation.
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] p-4 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--foreground)]">Placement notes</p>
        <p className="mt-2 leading-6">
          Drag a catalog item into the viewport. Drop zones map to the currently selected wall grid, with
          collision checks against existing facings.
        </p>
        <p className="mt-2 leading-6">
          Current wall program supports {pallet.display.shelfRows} rows and per-face column density changes.
        </p>
      </div>
    </section>
  );
}
