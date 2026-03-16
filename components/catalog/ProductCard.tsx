"use client";

import { useRef } from "react";
import { GripVertical, Package2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import type { Product } from "@/types/product";

export function ProductCard({
  active,
  product,
  onSelect,
}: {
  active: boolean;
  product: Product;
  onSelect: () => void;
}) {
  const setDraggingProductId = useUIStore(
    (state) => state.setDraggingProductId,
  );
  const isDragging = useRef(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all duration-200",
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm ring-1 ring-[var(--primary)]/15"
          : "border-[var(--line)] bg-[var(--surface-0)] hover:border-[var(--line-strong)] hover:shadow-sm",
      )}
    >
      {/* Drag handle — separate from click area */}
      <div
        className="absolute left-0 top-0 bottom-0 flex w-7 cursor-grab items-center justify-center rounded-l-xl opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        draggable
        onDragStart={(event) => {
          isDragging.current = true;
          event.dataTransfer.setData("text/plain", product.id);
          event.dataTransfer.effectAllowed = "copy";
          setDraggingProductId(product.id);
          onSelect();
        }}
        onDragEnd={() => {
          isDragging.current = false;
          setDraggingProductId(null);
        }}
        aria-hidden="true"
      >
        <GripVertical className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
      </div>

      {/* Click area */}
      <button
        type="button"
        aria-label={`${product.name} — ${product.sku}`}
        aria-pressed={active}
        className="w-full cursor-pointer p-3.5 text-left outline-none"
        onClick={onSelect}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
            style={{ backgroundColor: product.color }}
          >
            <Package2 className="h-[18px] w-[18px] text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--foreground)] leading-tight truncate">
              {product.name}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              {product.sku}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted)] font-medium">
          <span className="tabular-nums">
            {product.dimensions.width}&quot; x {product.dimensions.height}&quot; x{" "}
            {product.dimensions.depth}&quot;
          </span>
          <span className="badge badge-muted text-[10px] py-0.5 px-1.5">
            {product.unitsPerCase ?? 0}/case
          </span>
        </div>
      </button>
    </div>
  );
}
