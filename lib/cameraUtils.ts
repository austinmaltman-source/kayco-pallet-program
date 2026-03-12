import { Vector3 } from "three";

import { getDisplayHeight, getTowerFootprint } from "@/lib/palletPresets";
import type { PalletConfig } from "@/types/pallet";
import type { CameraView } from "@/types/ui";

export function getCameraPose(pallet: PalletConfig, view: CameraView) {
  const tower = getTowerFootprint(pallet);
  const displayHeight = getDisplayHeight(pallet.display);
  const targetY = pallet.base.height + displayHeight * 0.52;
  const sideDistance = Math.max(tower.width, tower.depth) * 1.35 + 28;
  const isoHeight = displayHeight + pallet.base.height + 16;

  switch (view) {
    case "front":
      return {
        position: new Vector3(0, targetY + 5, sideDistance),
        target: new Vector3(0, targetY, 0),
      };
    case "back":
      return {
        position: new Vector3(0, targetY + 5, -sideDistance),
        target: new Vector3(0, targetY, 0),
      };
    case "left":
      return {
        position: new Vector3(-sideDistance, targetY + 5, 0),
        target: new Vector3(0, targetY, 0),
      };
    case "right":
      return {
        position: new Vector3(sideDistance, targetY + 5, 0),
        target: new Vector3(0, targetY, 0),
      };
    default:
      return {
        position: new Vector3(sideDistance * 0.92, isoHeight, sideDistance * 0.92),
        target: new Vector3(0, targetY - 2, 0),
      };
  }
}
