export type PalletType = "full" | "half";
export type WallFace = "front" | "back" | "left" | "right";
export type WallType = "shelves" | "branded-panel" | "open";
export type PalletPreset = "48x40" | "48x48" | "42x42" | "48x42" | "custom";

export interface BaseConfig {
  width: number;
  depth: number;
  height: number;
  preset: PalletPreset;
}

export interface WallConfig {
  enabled: boolean;
  wallType: WallType;
  gridColumns: number;
  backgroundColor: string;
  stripText: string;
  stripColor: string;
}

export interface DisplayConfig {
  shelfRows: number;
  rowHeight: number;
  wallThickness: number;
  stripHeight: number;
  header: {
    enabled: boolean;
    height: number;
    label: string;
  };
  walls: Record<WallFace, WallConfig>;
}

export interface PalletConfig {
  id: string;
  name: string;
  type: PalletType;
  base: BaseConfig;
  display: DisplayConfig;
}
