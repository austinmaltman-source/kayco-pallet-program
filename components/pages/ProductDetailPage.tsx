"use client";

import {
  ArrowLeft,
  Package,
  Ruler,
  DollarSign,
  Layers,
  Tag,
  Calendar,
  Palette,
  Upload,
  X,
  Save,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CUSTOMERS } from "@/lib/customers";
import { useProductStore } from "@/stores/useProductStore";
import { ProductMockup } from "@/components/ui/ProductMockup";
import type { Product, PackagingShape } from "@/types/product";

// ─── Shape definitions ────────────────────────────────────────────────────────

const SHAPES: { value: PackagingShape; label: string }[] = [
  { value: "box", label: "Box" },
  { value: "bottle", label: "Bottle" },
  { value: "jar", label: "Jar" },
  { value: "bag", label: "Bag" },
  { value: "tin", label: "Tin" },
  { value: "pouch", label: "Pouch" },
];

// ─── findProduct ──────────────────────────────────────────────────────────────

function findProduct(productId: string): {
  product: Product;
  customerName: string;
} | null {
  for (const c of CUSTOMERS) {
    const product = c.products.find((p) => p.id === productId);
    if (product) return { product, customerName: c.name };
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductDetailPage({ productId }: { productId: string }) {
  const upsertProduct = useProductStore((s) => s.upsertProduct);
  const updateProduct = useProductStore((s) => s.updateProduct);
  const storeProduct = useProductStore((s) =>
    s.products.find((p) => p.id === productId)
  );

  const baseResult = findProduct(productId);

  // Seed the product into the store on mount so updates have somewhere to go
  useEffect(() => {
    if (baseResult) {
      upsertProduct({ ...baseResult.product });
    }
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read live values from the store (falls back to base data before store is seeded)
  const product: Product | null = storeProduct ?? baseResult?.product ?? null;

  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if anything changed from base
  const hasChanges = product && baseResult
    ? product.packaging !== baseResult.product.packaging ||
      product.artworkUrl !== baseResult.product.artworkUrl
    : false;

  function handleSave() {
    if (!product) return;
    // Persist to store (already there via updateProduct calls)
    // In a real app this would POST to an API
    upsertProduct({ ...product });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeShape = product?.packaging ?? "box";
  const artworkUrl = product?.artworkUrl;

  function handleArtworkFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      updateProduct(productId, { artworkUrl: url });
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleArtworkFile(file);
    },
    [productId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleArtworkFile(file);
    },
    [productId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleRemoveArtwork() {
    updateProduct(productId, { artworkUrl: undefined });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleShapeSelect(shape: PackagingShape) {
    updateProduct(productId, { packaging: shape });
  }

  // ── Not found ────────────────────────────────────────────────────────────────

  if (!baseResult || !product) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-black uppercase mb-2">
              Product Not Found
            </p>
            <Link
              href="/products"
              className="text-primary font-bold text-sm uppercase hover:underline"
            >
              Back to Products
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { customerName } = baseResult;
  const dim = product.dimensions;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto p-8">

        {/* 1. Back link + Save */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-primary uppercase tracking-wide transition-colors"
          >
            <ArrowLeft className="size-4" /> All Products
          </Link>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`inline-flex items-center gap-2 px-6 py-2 font-bold text-sm uppercase rounded-xl cursor-pointer transition-all ${
              saved
                ? "bg-green-500 text-white"
                : hasChanges
                  ? "bg-primary text-white hover:bg-primary-hover ring-2 ring-primary/30"
                  : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {saved ? (
              <>
                <Check className="size-4" /> Saved
              </>
            ) : (
              <>
                <Save className="size-4" /> Save Product
              </>
            )}
          </button>
        </div>

        {/* 2. Hero: mockup + info */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 items-start mb-8">
          {/* LEFT – 3D Mockup */}
          <div className="flex items-center justify-center bg-surface-0 border border-[var(--line-strong)] rounded-2xl p-8 min-w-[220px]">
            <ProductMockup
              shape={activeShape}
              color={product.color}
              artworkUrl={artworkUrl}
              name={product.name}
              size="md"
            />
          </div>

          {/* RIGHT – Info */}
          <div className="flex flex-col gap-4 pt-1">
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase leading-tight">
                {product.name}
              </h2>
              <p className="text-sm text-muted mt-1.5">
                SKU:{" "}
                <span className="font-mono font-semibold">{product.sku}</span>
                {" "}·{" "}
                <span>{customerName}</span>
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase rounded-md tracking-wide">
                {product.category}
              </span>
              <span className="px-3 py-1 bg-surface-2 text-muted text-xs font-bold uppercase rounded-md tracking-wide">
                {product.holiday.replace("-", " ")}
              </span>
            </div>

            {/* Quick-stats strip */}
            <div className="flex flex-wrap gap-4 mt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  Dimensions
                </span>
                <span className="text-sm font-black">
                  {dim.width}" × {dim.height}" × {dim.depth}"
                </span>
              </div>
              {product.unitPrice != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    Unit Price
                  </span>
                  <span className="text-sm font-black text-primary">
                    ${product.unitPrice.toFixed(2)}
                  </span>
                </div>
              )}
              {product.unitsPerCase != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    Units / Case
                  </span>
                  <span className="text-sm font-black">
                    {product.unitsPerCase}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  Color
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="size-4 rounded border border-[var(--line)]"
                    style={{ backgroundColor: product.color }}
                  />
                  <span className="text-sm font-mono font-bold">
                    {product.color}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Shape Selector */}
        <div className="bg-surface-0 border border-[var(--line-strong)] rounded-2xl p-6 mb-6">
          <p className="text-xs font-black text-muted uppercase tracking-widest mb-4">
            Packaging Shape
          </p>
          <div className="flex flex-wrap gap-3">
            {SHAPES.map(({ value, label }) => {
              const isActive = activeShape === value;
              return (
                <button
                  key={value}
                  onClick={() => handleShapeSelect(value)}
                  className={[
                    "flex flex-col items-center gap-2 px-5 py-3.5 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-wide cursor-pointer select-none",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-[var(--line-strong)] bg-surface-1 text-muted hover:border-primary/50 hover:text-primary/80",
                  ].join(" ")}
                >
                  <ShapeIcon shape={value} active={isActive} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Artwork Drop Zone */}
        <div className="bg-surface-0 border border-[var(--line-strong)] rounded-2xl p-6 mb-8">
          <p className="text-xs font-black text-muted uppercase tracking-widest mb-4">
            Product Artwork
          </p>

          {artworkUrl ? (
            /* Artwork preview */
            <div className="flex items-center gap-5">
              <img
                src={artworkUrl}
                alt="Product artwork"
                className="size-24 object-contain rounded-xl border border-[var(--line-strong)] bg-surface-1"
              />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold">Artwork loaded</p>
                <p className="text-xs text-muted">
                  Showing on the 3D mockup to the left.
                </p>
                <button
                  onClick={handleRemoveArtwork}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-red-500 hover:text-red-400 transition-colors mt-1"
                >
                  <X className="size-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            /* Drop zone */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-12 px-6",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-[var(--line-strong)] hover:border-primary/60 hover:bg-surface-1",
              ].join(" ")}
            >
              <Upload
                className={[
                  "size-8 transition-colors",
                  isDragging ? "text-primary" : "text-muted",
                ].join(" ")}
              />
              <div className="text-center">
                <p className="text-sm font-bold">
                  Drop product artwork here
                </p>
                <p className="text-xs text-muted mt-1">
                  or{" "}
                  <span className="text-primary font-bold">click to browse</span>
                  {" "}— PNG, JPG, SVG, WebP
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* 5. Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface-0 border border-[var(--line-strong)] p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="size-4 text-muted" />
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Dimensions
              </p>
            </div>
            <p className="text-xl font-black">
              {dim.width}" × {dim.height}" × {dim.depth}"
            </p>
          </div>

          {product.unitPrice != null && (
            <div className="bg-surface-0 border border-[var(--line-strong)] border-l-4 border-l-primary p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="size-4 text-muted" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest">
                  Unit Price
                </p>
              </div>
              <p className="text-xl font-black text-primary">
                ${product.unitPrice.toFixed(2)}
              </p>
            </div>
          )}

          {product.unitsPerCase != null && (
            <div className="bg-surface-0 border border-[var(--line-strong)] p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="size-4 text-muted" />
                <p className="text-xs font-bold text-muted uppercase tracking-widest">
                  Units Per Case
                </p>
              </div>
              <p className="text-xl font-black">{product.unitsPerCase}</p>
            </div>
          )}

          <div className="bg-surface-0 border border-[var(--line-strong)] p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="size-4 text-muted" />
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Color
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="size-8 rounded-lg border border-[var(--line)]"
                style={{ backgroundColor: product.color }}
              />
              <span className="text-sm font-mono font-bold">
                {product.color}
              </span>
            </div>
          </div>
        </div>

        {/* 6. Details Table */}
        <div className="bg-surface-0 border border-[var(--line-strong)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--line-strong)] bg-surface-1">
            <h3 className="text-sm font-black uppercase tracking-wider">
              Product Details
            </h3>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {[
              { icon: Tag, label: "Product ID", value: product.id },
              { icon: Tag, label: "SKU", value: product.sku },
              { icon: Package, label: "Category", value: product.category },
              {
                icon: Calendar,
                label: "Holiday",
                value: product.holiday.replace("-", " "),
              },
              { icon: Ruler, label: "Width", value: `${dim.width}"` },
              { icon: Ruler, label: "Height", value: `${dim.height}"` },
              { icon: Ruler, label: "Depth", value: `${dim.depth}"` },
              ...(product.unitCost != null
                ? [
                    {
                      icon: DollarSign,
                      label: "Unit Cost",
                      value: `$${product.unitCost.toFixed(2)}`,
                    },
                  ]
                : []),
              ...(product.unitPrice != null
                ? [
                    {
                      icon: DollarSign,
                      label: "Unit Price",
                      value: `$${product.unitPrice.toFixed(2)}`,
                    },
                  ]
                : []),
              ...(product.unitsPerCase != null
                ? [
                    {
                      icon: Layers,
                      label: "Units Per Case",
                      value: `${product.unitsPerCase}`,
                    },
                  ]
                : []),
            ].map((row) => (
              <div key={row.label} className="flex items-center px-6 py-3.5">
                <div className="flex items-center gap-2 w-48">
                  <row.icon className="size-3.5 text-muted" />
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">
                    {row.label}
                  </span>
                </div>
                <span className="text-sm font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

// ─── Shape Icon helper ────────────────────────────────────────────────────────

function ShapeIcon({
  shape,
  active,
}: {
  shape: PackagingShape;
  active: boolean;
}) {
  const cls = active ? "text-primary" : "text-muted";

  switch (shape) {
    case "box":
      return (
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${cls}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "bottle":
      return (
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${cls}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3V3z" />
          <line x1="9" y1="3" x2="15" y2="3" />
        </svg>
      );
    case "jar":
      return (
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${cls}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="7" y="2" width="10" height="3" rx="1" />
          <path d="M6 5h12l1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 5z" />
        </svg>
      );
    case "bag":
      return (
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${cls}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "tin":
      return (
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${cls}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="5" rx="8" ry="2" />
          <path d="M4 5v14c0 1.1 3.58 2 8 2s8-.9 8-2V5" />
          <ellipse cx="12" cy="5" rx="8" ry="2" />
        </svg>
      );
    case "pouch":
      return (
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${cls}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 3c0 0-2 1-2 4v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7c0-3-2-4-2-4" />
          <path d="M8 3h8" />
          <path d="M9 11h6" />
        </svg>
      );
    default:
      return <Package className={`size-6 ${cls}`} />;
  }
}
