"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { getCameraPose } from "@/lib/cameraUtils";
import type { PalletConfig } from "@/types/pallet";
import type { CameraView } from "@/types/ui";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CameraController({
  controlsRef,
  pallet,
  targetView,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  pallet: PalletConfig;
  targetView: CameraView | null;
}) {
  const { camera } = useThree();
  const animating = useRef(false);
  const startPos = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const endPos = useRef(new Vector3());
  const endTarget = useRef(new Vector3());
  const progress = useRef(0);
  const lastView = useRef<CameraView | null>(null);

  // Set initial camera position on mount
  useEffect(() => {
    const pose = getCameraPose(pallet, "isometric");
    camera.position.copy(pose.position);
    if (controlsRef.current) {
      controlsRef.current.target.copy(pose.target);
      controlsRef.current.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When targetView changes, start animation
  useEffect(() => {
    if (!targetView || targetView === lastView.current || !controlsRef.current) return;
    lastView.current = targetView;

    const pose = getCameraPose(pallet, targetView);
    startPos.current.copy(camera.position);
    startTarget.current.copy(controlsRef.current.target);
    endPos.current.copy(pose.position);
    endTarget.current.copy(pose.target);
    progress.current = 0;
    animating.current = true;
  }, [targetView, pallet, camera, controlsRef]);

  // Smooth interpolation each frame
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    if (animating.current) {
      progress.current = Math.min(1, progress.current + delta * 3.5);
      const t = easeInOutCubic(progress.current);

      camera.position.lerpVectors(startPos.current, endPos.current, t);
      controlsRef.current.target.lerpVectors(startTarget.current, endTarget.current, t);
      controlsRef.current.update();

      if (progress.current >= 1) {
        animating.current = false;
      }
    }

    // Clamp pan target to stay near the pallet
    const maxPanOffset = 30;
    controlsRef.current.target.x = MathUtils.clamp(
      controlsRef.current.target.x,
      -maxPanOffset,
      maxPanOffset,
    );
    controlsRef.current.target.z = MathUtils.clamp(
      controlsRef.current.target.z,
      -maxPanOffset,
      maxPanOffset,
    );
  });

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.08}
      enableDamping
      enablePan
      makeDefault
      maxDistance={350}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={20}
      minPolarAngle={0.1}
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={1.0}
    />
  );
}
