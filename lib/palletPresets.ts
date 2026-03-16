import type {
  PalletConfig,
  PalletPreset,
  PalletType,
  WallConfig,
} from "@/types/pallet";

/** Gentle slope drop from front to back on side panel top edges (inches) */
export const SLOPE_DROP = 3;

const BASE_PRESETS: Record<
  Exclude<PalletPreset, "custom">,
  { width: number; depth: number; height: number }
> = {
  "48x40": { width: 48, depth: 40, height: 6 },
  "48x48": { width: 48, depth: 48, height: 6 },
  "42x42": { width: 42, depth: 42, height: 6 },
  "48x42": { width: 48, depth: 42, height: 6 },
};

function createShelfWall(columns: number = 6): WallConfig {
  return {
    enabled: true,
    wallType: "shelves",
    gridColumns: columns,
    backgroundColor: "#c8b898",
    stripText: "All your holiday needs",
    stripColor: "#00a3c7",
  };
}

function createBrandedWall(): WallConfig {
  return {
    enabled: true,
    wallType: "branded-panel",
    gridColumns: 1,
    backgroundColor: "#00a3c7",
    stripText: "All your holiday needs",
    stripColor: "#ffffff",
  };
}

function createOpenWall(): WallConfig {
  return {
    enabled: false,
    wallType: "open",
    gridColumns: 1,
    backgroundColor: "#d7dbe2",
    stripText: "",
    stripColor: "#d7dbe2",
  };
}

export function getPresetDimensions(preset: PalletPreset) {
  if (preset === "custom") {
    return BASE_PRESETS["48x40"];
  }

  return BASE_PRESETS[preset];
}

export function createPalletConfig(
  type: PalletType,
  preset: PalletPreset = "48x40",
): PalletConfig {
  const base = getPresetDimensions(preset);

  return {
    id: `${type}-${preset}`,
    name: type === "full" ? "Full Pallet" : "Half Pallet",
    type,
    base: {
      ...base,
      preset,
    },
    display: {
      shelfRows: 4,
      rowHeight: 9,
      wallThickness: 1.2,
      stripHeight: 2,
      header: {
        enabled: true,
        height: 6,
        label: "Happy Passover",
      },
      walls:
        type === "full"
          ? {
              front: createShelfWall(6),
              back: createShelfWall(6),
              left: createShelfWall(5),
              right: createShelfWall(5),
            }
          : {
              front: createShelfWall(5),
              back: createOpenWall(),
              left: createBrandedWall(),
              right: createBrandedWall(),
            },
    },
  };
}

export function getDisplayHeight(config: PalletConfig["display"]) {
  return config.shelfRows * config.rowHeight + (config.shelfRows - 1) * config.stripHeight + 2;
}

export function getTowerFootprint(pallet: PalletConfig) {
  const widthInset = pallet.type === "full" ? 8 : 10;
  const depthInset = pallet.type === "full" ? 8 : 24;

  return {
    width: Math.max(20, pallet.base.width - widthInset),
    depth: Math.max(10, pallet.base.depth - depthInset),
  };
}
