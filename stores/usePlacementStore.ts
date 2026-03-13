"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { detectPlacementConflict, getProductColSpan } from "@/lib/gridMath";
import type { PalletConfig, WallFace } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

interface PlacementStore {
  placements: PlacedItem[];
  selectedPlacementId: string | null;
  past: PlacedItem[][];
  future: PlacedItem[][];
  selectPlacement: (id: string | null) => void;
  placeProduct: (params: {
    pallet: PalletConfig;
    product: Product;
    wall: WallFace;
    shelfRow: number;
    gridCol: number;
  }) => { ok: boolean; reason?: string; placementId?: string };
  removeSelected: () => void;
  removePlacement: (id: string) => void;
  updatePlacement: (id: string, patch: Partial<PlacedItem>) => void;
  rotateSelected: (products: Product[], pallet: PalletConfig) => void;
  clear: () => void;
  replacePlacements: (placements: PlacedItem[]) => void;
  undo: () => void;
  redo: () => void;
}

function clonePlacements(placements: PlacedItem[]) {
  return placements.map((placement) => ({ ...placement }));
}

export const usePlacementStore = create<PlacementStore>()(
  immer((set, get) => ({
    placements: [],
    selectedPlacementId: null,
    past: [],
    future: [],
    selectPlacement: (id) =>
      set((state) => {
        state.selectedPlacementId = id;
      }),
    placeProduct: ({ pallet, product, wall, shelfRow, gridCol }) => {
      const colSpan = getProductColSpan(product, pallet, wall);
      const maxStart = pallet.display.walls[wall].gridColumns - colSpan;
      const clampedCol = Math.max(0, Math.min(gridCol, maxStart));
      const conflict = detectPlacementConflict(get().placements, {
        wall,
        shelfRow,
        gridCol: clampedCol,
        colSpan,
      });

      if (conflict) {
        return { ok: false, reason: "Cell is already occupied." };
      }

      const id = nanoid();

      set((state) => {
        state.past.push(clonePlacements(state.placements));
        state.future = [];
        state.placements.push({
          id,
          productId: product.id,
          wall,
          shelfRow,
          gridCol: clampedCol,
          colSpan,
          rotation: 0,
          quantity: 1,
          displayMode: "face-out",
        });
        state.selectedPlacementId = id;
      });

      return { ok: true, placementId: id };
    },
    removeSelected: () =>
      set((state) => {
        if (!state.selectedPlacementId) {
          return;
        }

        state.past.push(clonePlacements(state.placements));
        state.future = [];
        state.placements = state.placements.filter(
          (placement) => placement.id !== state.selectedPlacementId,
        );
        state.selectedPlacementId = null;
      }),
    removePlacement: (id) =>
      set((state) => {
        state.past.push(clonePlacements(state.placements));
        state.future = [];
        state.placements = state.placements.filter(
          (placement) => placement.id !== id,
        );

        if (state.selectedPlacementId === id) {
          state.selectedPlacementId = null;
        }
      }),
    updatePlacement: (id, patch) =>
      set((state) => {
        const placement = state.placements.find((entry) => entry.id === id);

        if (!placement) {
          return;
        }

        state.past.push(clonePlacements(state.placements));
        state.future = [];
        Object.assign(placement, patch);
      }),
    rotateSelected: (products, pallet) => {
      const selectedPlacementId = get().selectedPlacementId;

      if (!selectedPlacementId) {
        return;
      }

      const placement = get().placements.find((entry) => entry.id === selectedPlacementId);

      if (!placement) {
        return;
      }

      const product = products.find((entry) => entry.id === placement.productId);

      if (!product) {
        return;
      }

      const nextRotation = (placement.rotation + 90) % 360;
      const nextColSpan = getProductColSpan(product, pallet, placement.wall, nextRotation);
      const maxStart = pallet.display.walls[placement.wall].gridColumns - nextColSpan;
      const nextCol = Math.max(0, Math.min(placement.gridCol, maxStart));
      const conflict = detectPlacementConflict(
        get().placements,
        {
          wall: placement.wall,
          shelfRow: placement.shelfRow,
          gridCol: nextCol,
          colSpan: nextColSpan,
        },
        placement.id,
      );

      if (conflict) {
        return;
      }

      set((state) => {
        state.past.push(clonePlacements(state.placements));
        state.future = [];
        const selected = state.placements.find((entry) => entry.id === selectedPlacementId);

        if (!selected) {
          return;
        }

        selected.rotation = nextRotation;
        selected.colSpan = nextColSpan;
        selected.gridCol = nextCol;
      });
    },
    clear: () =>
      set((state) => {
        state.past.push(clonePlacements(state.placements));
        state.future = [];
        state.placements = [];
        state.selectedPlacementId = null;
      }),
    replacePlacements: (placements) =>
      set((state) => {
        state.placements = placements;
        state.selectedPlacementId = null;
        state.past = [];
        state.future = [];
      }),
    undo: () =>
      set((state) => {
        const previous = state.past.pop();

        if (!previous) {
          return;
        }

        state.future.unshift(clonePlacements(state.placements));
        state.placements = clonePlacements(previous);
        state.selectedPlacementId = null;
      }),
    redo: () =>
      set((state) => {
        const next = state.future.shift();

        if (!next) {
          return;
        }

        state.past.push(clonePlacements(state.placements));
        state.placements = clonePlacements(next);
        state.selectedPlacementId = null;
      }),
  })),
);
