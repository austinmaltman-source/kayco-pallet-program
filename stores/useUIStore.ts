"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { CameraView, DropPreview } from "@/types/ui";
import type { WallFace } from "@/types/pallet";

interface UIStore {
  activeView: CameraView;
  selectedWall: WallFace;
  showGrid: boolean;
  draggingProductId: string | null;
  dropPreview: DropPreview | null;
  captureResolver: ((captures: Record<string, string>) => void) | null;
  setSelectedWall: (face: WallFace) => void;
  setActiveView: (view: CameraView) => void;
  toggleGrid: () => void;
  setDraggingProductId: (productId: string | null) => void;
  setDropPreview: (preview: DropPreview | null) => void;
  requestCaptures: () => Promise<Record<string, string>>;
  clearCaptureRequest: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    immer((set) => ({
      activeView: "isometric",
      selectedWall: "front",
      showGrid: true,
      draggingProductId: null,
      dropPreview: null,
      captureResolver: null,
      setSelectedWall: (face) =>
        set((state) => {
          state.selectedWall = face;
          state.activeView = face;
        }),
      setActiveView: (view) =>
        set((state) => {
          state.activeView = view;

          if (view !== "isometric") {
            state.selectedWall = view;
          }
        }),
      toggleGrid: () =>
        set((state) => {
          state.showGrid = !state.showGrid;
        }),
      setDraggingProductId: (productId) =>
        set((state) => {
          state.draggingProductId = productId;
        }),
      setDropPreview: (preview) =>
        set((state) => {
          state.dropPreview = preview;
        }),
      requestCaptures: () =>
        new Promise<Record<string, string>>((resolve) => {
          set((state) => {
            state.captureResolver = resolve as typeof state.captureResolver;
          });
        }),
      clearCaptureRequest: () =>
        set((state) => {
          state.captureResolver = null;
        }),
    })),
    {
      name: "kayco-ui-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeView: state.activeView,
        selectedWall: state.selectedWall,
        showGrid: state.showGrid,
      }),
    },
  ),
);
