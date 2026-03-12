"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { getCameraPose } from "@/lib/cameraUtils";
import { useUIStore } from "@/stores/useUIStore";
import type { PalletConfig } from "@/types/pallet";

export function CameraController({
  controlsRef,
  pallet,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  pallet: PalletConfig;
}) {
  const activeView = useUIStore((state) => state.activeView);
  const desiredPosition = useRef(new Vector3(86, 70, 88));
  const desiredTarget = useRef(new Vector3(0, 28, 0));

  useEffect(() => {
    const pose = getCameraPose(pallet, activeView);

    desiredPosition.current.copy(pose.position);
    desiredTarget.current.copy(pose.target);
  }, [activeView, pallet]);

  useFrame(({ camera }) => {
    camera.position.lerp(desiredPosition.current, 0.08);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(desiredTarget.current, 0.11);
      controlsRef.current.update();
    } else {
      camera.lookAt(desiredTarget.current);
    }
  });

  return null;
}
