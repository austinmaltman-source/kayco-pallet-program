// @ts-nocheck — 3D scene not active in current layout; kept for future use
"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { getCameraPose } from "@/lib/cameraUtils";
import { useUIStore } from "@/stores/useUIStore";
import type { PalletConfig } from "@/types/pallet";
import type { CameraView } from "@/types/ui";

const CAPTURE_VIEWS: CameraView[] = ["isometric", "front", "back", "left", "right"];

export function ExportCapture({
  pallet,
  controlsRef,
}: {
  pallet: PalletConfig;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { gl, camera, scene } = useThree();
  const captureResolver = useUIStore((state) => state.captureResolver);
  const clearCaptureRequest = useUIStore((state) => state.clearCaptureRequest);

  useEffect(() => {
    if (!captureResolver) return;

    const captures: Record<string, string> = {};

    // Save current camera state
    const savedPos = camera.position.clone();
    const savedTarget = controlsRef.current?.target.clone() ?? new Vector3(0, 28, 0);

    for (const view of CAPTURE_VIEWS) {
      const pose = getCameraPose(pallet, view);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.copy(pose.target);
        controlsRef.current.update();
      }

      gl.render(scene, camera);
      captures[view] = gl.domElement.toDataURL("image/png");
    }

    // Restore camera
    camera.position.copy(savedPos);
    if (controlsRef.current) {
      controlsRef.current.target.copy(savedTarget);
      controlsRef.current.update();
    }
    camera.lookAt(savedTarget);
    camera.updateProjectionMatrix();
    gl.render(scene, camera);

    captureResolver(captures);
    clearCaptureRequest();
  }, [captureResolver, clearCaptureRequest, camera, gl, scene, pallet, controlsRef]);

  return null;
}
