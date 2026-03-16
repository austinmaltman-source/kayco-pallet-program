"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { CameraView, DropPreview } from "@/types/ui";
import type { WallFace } from "@/types/pallet";

interface UIStore {
  selectedCustomerId: string;
  selectedWall: WallFace;
  viewMode: "2d" | "3d";
  cameraView: CameraView | null;
  draggingProductId: string | null;
  dropPreview: DropPreview | null;
  setSelectedCustomerId: (id: string) => void;
  setSelectedWall: (face: WallFace) => void;
  setViewMode: (mode: "2d" | "3d") => void;
  setCameraView: (view: CameraView) => void;
  setDraggingProductId: (productId: string | null) => void;
  setDropPreview: (preview: DropPreview | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    immer((set) => ({
      selectedCustomerId: "kroger",
      selectedWall: "front",
      viewMode: "2d",
      cameraView: null,
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
      setViewMode: (mode) =>
        set((state) => {
          state.viewMode = mode;
        }),
      setCameraView: (view) =>
        set((state) => {
          state.cameraView = view;
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
