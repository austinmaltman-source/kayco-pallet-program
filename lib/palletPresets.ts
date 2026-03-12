import type {
  PalletConfig,
  PalletPreset,
  PalletType,
  WallConfig,
} from "@/types/pallet";

const BASE_PRESETS: Record<
  Exclude<PalletPreset, "custom">,
  { width: number; depth: number; height: number }
> = {
  "48x40": { width: 48, depth: 40, height: 6 },
  "48x48": { width: 48, depth: 48, height: 6 },
  "42x42": { width: 42, depth: 42, height: 6 },
  "48x42": { width: 48, depth: 42, height: 6 },
};

function createShelfWall(): WallConfig {
  return {
    enabled: true,
    wallType: "shelves",
    gridColumns: 4,
    backgroundColor: "#efe1cd",
    stripText: "All your holiday needs",
    stripColor: "#0f4d82",
  };
}

function createBrandedWall(): WallConfig {
  return {
    enabled: true,
    wallType: "branded-panel",
    gridColumns: 1,
    backgroundColor: "#154d7e",
    stripText: "Kayco holiday program",
    stripColor: "#d8b36d",
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
      rowHeight: 12,
      wallThickness: 1.2,
      stripHeight: 2,
      header: {
        enabled: true,
        height: 10,
        label: type === "full" ? "Holiday Program" : "Half Pallet",
      },
      walls:
        type === "full"
          ? {
              front: createShelfWall(),
              back: createShelfWall(),
              left: createShelfWall(),
              right: createShelfWall(),
            }
          : {
              front: createShelfWall(),
              back: createOpenWall(),
              left: createBrandedWall(),
              right: createBrandedWall(),
            },
    },
  };
}

export function getDisplayHeight(config: PalletConfig["display"]) {
  return config.shelfRows * config.rowHeight + (config.shelfRows - 1) * config.stripHeight + 4;
}

export function getTowerFootprint(pallet: PalletConfig) {
  const widthInset = pallet.type === "full" ? 8 : 10;
  const depthInset = pallet.type === "full" ? 8 : 10;

  return {
    width: Math.max(20, pallet.base.width - widthInset),
    depth: Math.max(18, pallet.base.depth - depthInset),
  };
}
