"use client";

import { Package } from "lucide-react";
import type { PackagingShape } from "@/types/product";

interface ProductMockupProps {
  shape?: PackagingShape;
  color: string;
  artworkUrl?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function adjustColor(hex: string, amount: number): string {
  const cleaned = hex.replace("#", "");
  const num = parseInt(cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

const SIZE_CONFIG = {
  sm: { frontW: 52, frontH: 64, depth: 6, iconSize: 12, fontSize: 9 },
  md: { frontW: 150, frontH: 190, depth: 16, iconSize: 32, fontSize: 14 },
  lg: { frontW: 100, frontH: 128, depth: 10, iconSize: 20, fontSize: 11 },
};

export function ProductMockup({
  shape = "box",
  color,
  artworkUrl,
  name,
  size = "sm",
  className,
}: ProductMockupProps) {
  const cfg = SIZE_CONFIG[size];
  const lighter = adjustColor(color, 30);
  const darker = adjustColor(color, -30);

  const isFlat = shape === "bag" || shape === "pouch";

  // Shape-specific overrides
  let frontW = cfg.frontW;
  let frontH = cfg.frontH;
  let depth = cfg.depth;
  let frontStyle: React.CSSProperties = {};
  let capElement: React.ReactNode = null;

  if (shape === "bottle") {
    frontW = Math.round(cfg.frontW * 0.6);
    frontH = Math.round(cfg.frontH * 1.1);
    frontStyle = { borderRadius: "999px 999px 6px 6px" };
    // cap
    const capW = Math.round(frontW * 0.45);
    const capH = Math.round(depth * 1.2);
    capElement = (
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: capW,
          height: capH,
          background: darker,
          borderRadius: "3px 3px 0 0",
          marginBottom: 1,
          boxShadow: "0 -1px 2px rgba(0,0,0,0.15)",
        }}
      />
    );
  } else if (shape === "jar") {
    frontW = Math.round(cfg.frontW * 1.15);
    frontH = Math.round(cfg.frontH * 0.75);
    frontStyle = { borderRadius: "10px 10px 4px 4px" };
    // lid
    const lidW = Math.round(frontW * 1.06);
    const lidH = Math.round(depth * 0.9);
    capElement = (
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: lidW,
          height: lidH,
          background: darker,
          borderRadius: "4px 4px 0 0",
          marginBottom: 1,
          boxShadow: "0 -1px 3px rgba(0,0,0,0.2)",
        }}
      />
    );
  } else if (shape === "tin") {
    frontH = Math.round(cfg.frontH * 0.65);
    depth = Math.round(depth * 0.4);
    frontStyle = { borderRadius: 12 };
  } else if (shape === "pouch") {
    frontW = Math.round(cfg.frontW * 0.8);
    frontStyle = { borderRadius: "35% 35% 4px 4px" };
    // seal notch
    const notchSize = Math.max(4, Math.round(cfg.frontW * 0.06));
    capElement = (
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: `${notchSize}px solid transparent`,
          borderRight: `${notchSize}px solid transparent`,
          borderBottom: `${notchSize}px solid ${color}`,
          marginBottom: -1,
        }}
      />
    );
  } else if (shape === "bag") {
    // zigzag top decoration
    const bagTopH = Math.max(5, Math.round(cfg.frontH * 0.07));
    capElement = (
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: 0,
          width: frontW,
          height: bagTopH,
          background: lighter,
          clipPath: "polygon(0% 100%, 10% 0%, 20% 100%, 30% 0%, 40% 100%, 50% 0%, 60% 100%, 70% 0%, 80% 100%, 90% 0%, 100% 100%)",
        }}
      />
    );
  }

  // bag gets clip-path trapezoid
  if (shape === "bag") {
    frontStyle = {
      ...frontStyle,
      clipPath: "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
    };
  }

  // Front face content
  const frontContent = artworkUrl ? (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${artworkUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: "inherit",
        }}
      />
      {/* vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.22) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  ) : (
    <>
      {/* solid color fill */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          borderRadius: "inherit",
        }}
      />
      {/* gradient sheen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background:
            "linear-gradient(175deg, rgba(255,255,255,0.18) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />
      {/* label content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.max(2, Math.round(cfg.iconSize * 0.2)),
          padding: "8%",
          textAlign: "center",
        }}
      >
        <Package
          size={cfg.iconSize}
          color="rgba(255,255,255,0.9)"
          strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))", flexShrink: 0 }}
        />
        {name && (
          <span
            style={{
              color: "rgba(255,255,255,0.95)",
              fontSize: cfg.fontSize,
              fontWeight: 700,
              lineHeight: 1.2,
              textShadow: "0 1px 3px rgba(0,0,0,0.4)",
              wordBreak: "break-word",
              maxWidth: "90%",
            }}
          >
            {name}
          </span>
        )}
      </div>
    </>
  );

  // Total bounding box size to avoid clipping
  const totalW = frontW + depth + 4;
  const totalH = frontH + depth + 8;

  return (
    <div
      className={className}
      style={{
        display: "inline-block",
        width: totalW,
        height: totalH,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* shadow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: depth / 2,
          width: frontW,
          height: Math.max(4, Math.round(depth * 0.8)),
          background: "rgba(0,0,0,0.18)",
          borderRadius: "50%",
          filter: `blur(${Math.max(2, depth * 0.5)}px)`,
          transform: "scaleY(0.4)",
          transformOrigin: "bottom center",
        }}
      />

      {/* main group — offset from top-left so shadow fits */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {/* top strip (skewed to simulate top face) */}
        {!isFlat && (
          <div
            style={{
              position: "absolute",
              width: frontW,
              height: depth,
              background: lighter,
              top: 0,
              left: depth,
              transform: "skewX(-45deg)",
              transformOrigin: "bottom left",
              boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.08)",
            }}
          />
        )}

        {/* front face */}
        <div
          style={{
            position: "absolute",
            width: frontW,
            height: frontH,
            top: isFlat ? 0 : depth,
            left: isFlat ? 0 : depth,
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: isFlat
              ? "2px 3px 8px rgba(0,0,0,0.2)"
              : "inset 0 0 0 1px rgba(255,255,255,0.08)",
            ...frontStyle,
          }}
        >
          {capElement && (
            <div style={{ position: "absolute", bottom: "100%", left: 0, width: "100%" }}>
              {capElement}
            </div>
          )}
          {frontContent}
        </div>

        {/* right strip (skewed to simulate right face) */}
        {!isFlat && (
          <div
            style={{
              position: "absolute",
              width: depth,
              height: frontH,
              background: darker,
              top: depth,
              left: depth + frontW,
              transform: "skewY(-45deg)",
              transformOrigin: "top left",
              boxShadow: "inset -1px 0 2px rgba(0,0,0,0.1)",
            }}
          />
        )}
      </div>
    </div>
  );
}
