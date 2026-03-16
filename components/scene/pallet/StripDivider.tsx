"use client";

import { useMemo } from "react";

import { createStripTexture } from "@/lib/textureFactory";

interface StripDividerProps {
  width: number;
  height: number;
  text: string;
  bgColor: string;
  textColor?: string;
}

export function StripDivider({ width, height, text, bgColor, textColor = "#ffffff" }: StripDividerProps) {
  const texture = useMemo(
    () => createStripTexture(text, bgColor, textColor),
    [text, bgColor, textColor],
  );

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width + 0.2, height, 0.3]} />
      <meshStandardMaterial map={texture} roughness={0.6} />
    </mesh>
  );
}
