"use client";

import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { Package2 } from "lucide-react";

import { ProductMockup } from "@/components/ui/ProductMockup";
import { useUIStore } from "@/stores/useUIStore";
import type { Product } from "@/types/product";

interface DndProviderProps {
  children: React.ReactNode;
  products: Product[];
  onDrop: (productId: string, droppableId: string) => void;
}

/** Parses a droppable ID like "cell-front-2-3" → { wall, row, col } */
export function parseCellId(id: string) {
  const parts = id.split("-");
  // cell-{wall}-{row}-{col}
  if (parts[0] !== "cell" || parts.length !== 4) return null;
  return {
    wall: parts[1],
    row: parseInt(parts[2], 10),
    col: parseInt(parts[3], 10),
  };
}

export function DndProvider({ children, products, onDrop }: DndProviderProps) {
  const setDraggingProductId = useUIStore((s) => s.setDraggingProductId);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [dropTargetValid, setDropTargetValid] = useState<boolean | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6, // 6px before drag starts — prevents accidental drags
    },
  });
  const sensors = useSensors(pointerSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const productId = event.active.data.current?.productId as string;
      const product = products.find((p) => p.id === productId);
      if (product) {
        setActiveProduct(product);
        setDraggingProductId(productId);
      }
    },
    [products, setDraggingProductId],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (event.over) {
      setDropTargetValid(event.over.data.current?.valid ?? true);
    } else {
      setDropTargetValid(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const productId = event.active.data.current?.productId as string;
      if (event.over && productId) {
        const isValid = event.over.data.current?.valid;
        if (isValid !== false) {
          onDrop(productId, event.over.id as string);
        }
      }
      setActiveProduct(null);
      setDraggingProductId(null);
      setDropTargetValid(null);
    },
    [onDrop, setDraggingProductId],
  );

  const handleDragCancel = useCallback(() => {
    setActiveProduct(null);
    setDraggingProductId(null);
    setDropTargetValid(null);
  }, [setDraggingProductId]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      {/* Floating drag overlay — follows the cursor */}
      <DragOverlay dropAnimation={{
        duration: 250,
        easing: "cubic-bezier(0.2, 0, 0.2, 1)",
      }}>
        <AnimatePresence>
          {activeProduct && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -1 }}
              animate={{
                scale: 1.05,
                opacity: 1,
                rotate: 0,
                boxShadow: dropTargetValid === false
                  ? "0 12px 40px -8px rgba(239, 68, 68, 0.35), 0 4px 12px rgba(0,0,0,0.15)"
                  : "0 12px 40px -8px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.1)",
              }}
              transition={{
                type: "spring",
                stiffness: 350,
                damping: 25,
                mass: 0.8,
              }}
              className="pointer-events-none rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3.5 py-3"
              style={{ width: 200 }}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <ProductMockup
                    shape={activeProduct.packaging}
                    color={activeProduct.color}
                    artworkUrl={activeProduct.artworkUrl}
                    name={activeProduct.name}
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--foreground)] leading-tight truncate">
                    {activeProduct.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                    {activeProduct.sku}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DragOverlay>
    </DndContext>
  );
}
