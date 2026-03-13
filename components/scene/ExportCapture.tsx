"use client";

import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { PalletConfig } from "@/types/pallet";

export function ExportCapture({
  pallet: _pallet,
  controlsRef: _controlsRef,
}: {
  pallet: PalletConfig;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  void _pallet;
  void _controlsRef;
  return null;
}
