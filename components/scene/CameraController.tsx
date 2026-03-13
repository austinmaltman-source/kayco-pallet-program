"use client";

import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { PalletConfig } from "@/types/pallet";

export function CameraController({
  controlsRef: _controlsRef,
  pallet: _pallet,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  pallet: PalletConfig;
}) {
  void _controlsRef;
  void _pallet;
  return null;
}
