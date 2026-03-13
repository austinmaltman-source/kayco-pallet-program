import type { WallFace } from "@/types/pallet";

export const WALL_FACES: WallFace[] = ["front", "right", "back", "left"];

export const WALL_LABELS: Record<WallFace, string> = {
  front: "Front",
  right: "Right",
  back: "Back",
  left: "Left",
};

export const PROJECT_STORAGE_KEY = "kayco-builder-projects";
