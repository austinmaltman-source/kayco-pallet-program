"use client";

import { useMemo } from "react";

import { createHeaderTexture } from "@/lib/textureFactory";

interface HeaderTopperProps {
  width: number;
  depth: number;
  height: number;
  label: string;
  subtitle?: string;
  bgColor?: string;
  textColor?: string;
}

export function HeaderTopper({
  width,
  depth,
  height,
  label,
  subtitle,
  bgColor = "#00a3c7",
  textColor = "#ffffff",
}: HeaderTopperProps) {
  const texture = useMemo(
    () => createHeaderTexture(label, bgColor, textColor, 512, 128, subtitle),
    [label, bgColor, textColor, subtitle],
  );

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial map={texture} roughness={0.65} />
    </mesh>
  );
}
