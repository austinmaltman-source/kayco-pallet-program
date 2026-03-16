"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { createPalletConfig, getPresetDimensions } from "@/lib/palletPresets";
import type { PalletConfig, PalletPreset, PalletType, WallFace } from "@/types/pallet";

interface PalletStore {
  pallet: PalletConfig;
  reset: () => void;
  replacePallet: (pallet: PalletConfig) => void;
  setType: (type: PalletType) => void;
  setBasePreset: (preset: PalletPreset) => void;
  updateBaseDimension: (
    key: keyof Pick<PalletConfig["base"], "width" | "depth" | "height">,
    value: number,
  ) => void;
  setGridColumns: (face: WallFace, columns: number) => void;
  toggleHeader: () => void;
}

const defaultPallet = createPalletConfig("half");

export const usePalletStore = create<PalletStore>()(
  persist(
    immer((set) => ({
      pallet: defaultPallet,
      reset: () =>
        set((state) => {
          state.pallet = createPalletConfig("half");
        }),
      replacePallet: (pallet) =>
        set((state) => {
          state.pallet = pallet;
        }),
      setType: (type) =>
        set((state) => {
          const base = state.pallet.base;
          const next = createPalletConfig(type, base.preset);

          next.base.width = base.width;
          next.base.depth = base.depth;
          next.base.height = base.height;
          state.pallet = next;
        }),
      setBasePreset: (preset) =>
        set((state) => {
          state.pallet.base.preset = preset;

          if (preset !== "custom") {
            const nextBase = getPresetDimensions(preset);
            state.pallet.base.width = nextBase.width;
            state.pallet.base.depth = nextBase.depth;
            state.pallet.base.height = nextBase.height;
          }
        }),
      updateBaseDimension: (key, value) =>
        set((state) => {
          const clamped =
            key === "height"
              ? Math.min(10, Math.max(4, value))
              : Math.min(60, Math.max(30, value));

          state.pallet.base[key] = Number.isFinite(clamped) ? clamped : state.pallet.base[key];
          state.pallet.base.preset = "custom";
        }),
      setGridColumns: (face, columns) =>
        set((state) => {
          const wall = state.pallet.display.walls[face];

          if (wall.wallType !== "shelves") {
            return;
          }

          wall.gridColumns = Math.min(8, Math.max(2, columns));
        }),
      toggleHeader: () =>
        set((state) => {
          state.pallet.display.header.enabled = !state.pallet.display.header.enabled;
        }),
    })),
    {
      name: "kayco-pallet-store",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pallet: state.pallet }),
      migrate: () => ({ pallet: createPalletConfig("half") }),
    },
  ),
);
