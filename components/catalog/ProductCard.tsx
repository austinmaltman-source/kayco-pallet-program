"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { ProductMockup } from "@/components/ui/ProductMockup";
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
  const draggingProductId = useUIStore((s) => s.draggingProductId);
  const isDragging = draggingProductId === product.id;

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } =
    useDraggable({
      id: `product-${product.id}`,
      data: { productId: product.id },
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border transition-all duration-200",
        isDragging
          ? "border-[var(--primary)]/40 bg-[var(--primary-soft)]/50 opacity-50 scale-[0.97] shadow-none"
          : active
            ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm ring-1 ring-[var(--primary)]/15"
            : "border-[var(--line)] bg-[var(--surface-0)] hover:border-[var(--line-strong)] hover:shadow-sm",
      )}
    >
      {/* Drag handle — activator */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 flex w-7 cursor-grab items-center justify-center rounded-l-xl opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
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
          <div className="shrink-0 transition-transform duration-200 group-hover:scale-[1.03]">
            <ProductMockup
              shape={product.packaging}
              color={product.color}
              artworkUrl={product.artworkUrl}
              name={product.name}
              size="sm"
            />
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
