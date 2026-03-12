"use client";

import { Package2 } from "lucide-react";

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
  const setDraggingProductId = useUIStore((state) => state.setDraggingProductId);

  return (
    <div
      aria-label={`${product.name} — ${product.sku}`}
      aria-pressed={active}
      className={cn(
        "cursor-grab rounded-3xl border p-4 transition-colors active:cursor-grabbing",
        active
          ? "border-[var(--primary)] bg-[rgba(20,78,131,0.08)]"
          : "border-[var(--line)] bg-white/75 hover:border-[var(--line-strong)] hover:bg-white",
      )}
      draggable
      onClick={onSelect}
      onDragEnd={() => setDraggingProductId(null)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", product.id);
        event.dataTransfer.effectAllowed = "copy";
        setDraggingProductId(product.id);
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: product.color }}
        >
          <Package2 className="h-5 w-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{product.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {product.sku}
              </p>
            </div>
            <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {product.category}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{product.description}</p>

          <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>
              {product.dimensions.width}&quot; x {product.dimensions.height}&quot; x{" "}
              {product.dimensions.depth}&quot;
            </span>
            <span>{product.unitsPerCase ?? 0} / case</span>
          </div>
        </div>
      </div>
    </div>
  );
}
