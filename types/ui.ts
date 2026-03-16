import type { WallFace } from "@/types/pallet";

export type CameraView = WallFace | "isometric";

export interface DropPreview {
  wall: WallFace;
  shelfRow: number;
  gridCol: number;
  valid: boolean;
}

export interface UIState {
  selectedWall: WallFace;
  selectedCustomerId: string;
  viewMode: "2d" | "3d";
  draggingProductId: string | null;
  dropPreview: DropPreview | null;
}
