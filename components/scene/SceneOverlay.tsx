"use client";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import type { CameraView } from "@/types/ui";

const VIEWS: { label: string; view: CameraView }[] = [
  { label: "Front", view: "front" },
  { label: "Back", view: "back" },
  { label: "Left", view: "left" },
  { label: "Right", view: "right" },
  { label: "Orbit", view: "isometric" },
];

export function SceneOverlay() {
  const cameraView = useUIStore((s) => s.cameraView);
  const setCameraView = useUIStore((s) => s.setCameraView);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      {/* Top-right: camera view buttons */}
      <div className="flex justify-end">
        <div className="pointer-events-auto flex gap-0.5 rounded-xl bg-black/5 p-0.5 backdrop-blur-md">
          {VIEWS.map((v) => (
            <button
              key={v.view}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                cameraView === v.view
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground)]/70 hover:bg-white/50 hover:text-[var(--foreground)]",
              )}
              onClick={() => setCameraView(v.view)}
              type="button"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-left: usage hint */}
      <div className="pointer-events-none">
        <p className="text-[10px] font-medium text-black/30">
          Drag to orbit - Scroll to zoom - Right-drag to pan
        </p>
      </div>
    </div>
  );
}
