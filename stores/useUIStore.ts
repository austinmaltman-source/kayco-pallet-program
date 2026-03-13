"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { DropPreview } from "@/types/ui";
import type { WallFace } from "@/types/pallet";

interface UIStore {
  selectedCustomerId: string;
  selectedWall: WallFace;
  draggingProductId: string | null;
  dropPreview: DropPreview | null;
  setSelectedCustomerId: (id: string) => void;
  setSelectedWall: (face: WallFace) => void;
  setDraggingProductId: (productId: string | null) => void;
  setDropPreview: (preview: DropPreview | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    immer((set) => ({
      selectedCustomerId: "kroger",
      selectedWall: "front",
      draggingProductId: null,
      dropPreview: null,
      setSelectedCustomerId: (id) =>
        set((state) => {
          state.selectedCustomerId = id;
        }),
      setSelectedWall: (face) =>
        set((state) => {
          state.selectedWall = face;
        }),
      setDraggingProductId: (productId) =>
        set((state) => {
          state.draggingProductId = productId;
        }),
      setDropPreview: (preview) =>
        set((state) => {
          state.dropPreview = preview;
        }),
    })),
    {
      name: "kayco-ui-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedWall: state.selectedWall,
        selectedCustomerId: state.selectedCustomerId,
      }),
    },
  ),
);
