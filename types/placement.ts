import type { WallFace } from "@/types/pallet";

export interface PlacedItem {
  id: string;
  productId: string;
  wall: WallFace;
  shelfRow: number;
  gridCol: number;
  colSpan: number;
  rotation: number;
  quantity: number;
  displayMode: "face-out" | "spine-out";
  offsetX?: number;
}
