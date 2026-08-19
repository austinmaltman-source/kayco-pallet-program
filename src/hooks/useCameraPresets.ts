import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraPreset } from '../types';

const LOOK_TARGET = new THREE.Vector3(0, 24, 0);

const PRESET_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  front: [0, 30, 80],
  back: [0, 30, -80],
  side: [80, 30, 0], // right side
  left: [-80, 30, 0],
  top: [0, 90, 0.1],
  isometric: [72, 48, 72],
};

// Animates the camera to a preset viewpoint. resetToken: bump it to re-run
// the current preset (camera reset / re-clicking the active face).
//
// isAnimating MUST be reactive state, not a ref read: OrbitControls'
// `enabled` prop is computed from it at render time, and a stale ref left
// the controls permanently disabled after any re-render landed mid-animation
// (the "camera won't spin" bug).
export function useCameraPresets(preset?: CameraPreset, resetToken = 0) {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as unknown as {
      target?: THREE.Vector3;
      update?: () => void;
    } | null,
  }));
  const [isAnimating, setIsAnimating] = useState(false);
  const startPosRef = useRef(new THREE.Vector3());
  const endPosRef = useRef(new THREE.Vector3());
  const progressRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!preset && resetToken === 0) return;

    startPosRef.current.copy(camera.position);
    endPosRef.current.set(...PRESET_POSITIONS[preset ?? 'isometric']);
    progressRef.current = 0;
    activeRef.current = true;
    setIsAnimating(true);
  }, [preset, resetToken, camera]);

  useFrame((_, delta) => {
    if (!activeRef.current) return;

    // 600ms ease-out cubic flight.
    progressRef.current = Math.min(1, progressRef.current + delta / 0.6);
    const t = progressRef.current;
    const ease = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPosRef.current, endPosRef.current, ease);
    camera.lookAt(LOOK_TARGET);

    if (t >= 1) {
      activeRef.current = false;
      // Hand the final pose to OrbitControls so it resumes from here instead
      // of snapping back to its own stale spherical coordinates.
      if (controls?.target) controls.target.copy(LOOK_TARGET);
      controls?.update?.();
      setIsAnimating(false);
    }
  });

  return { isAnimating };
}
