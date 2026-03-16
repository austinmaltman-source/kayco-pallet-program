"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";

import { createBrandedPanelTexture } from "@/lib/textureFactory";

interface BrandedPanelProps {
  width: number;
  height: number;
  thickness: number;
  text: string;
  bgColor: string;
  textColor?: string;
}

export function BrandedPanel({
  width,
  height,
  thickness,
  text,
  bgColor,
  textColor = "#ffffff",
}: BrandedPanelProps) {
  const texture = useMemo(
    () => createBrandedPanelTexture(text, bgColor, textColor),
    [text, bgColor, textColor],
  );

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width, height, thickness]} />
      <meshStandardMaterial
        color="#ffffff"
        map={texture}
        roughness={0.7}
        side={DoubleSide}
      />
    </mesh>
  );
}
