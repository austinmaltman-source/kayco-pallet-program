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
        "group cursor-grab rounded-[20px] border p-4 transition-all duration-300 active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5",
        active
          ? "border-[var(--primary)] bg-cyan-50/50 shadow-sm ring-1 ring-[var(--primary)]/20"
          : "border-slate-200 bg-white hover:border-[var(--primary)]/30",
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
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundColor: product.color }}
        >
          <Package2 className="h-6 w-6 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold text-slate-800 leading-tight">{product.name}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
                {product.sku}
              </p>
            </div>
          </div>

          {product.description ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{product.description}</p>
          ) : null}

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
