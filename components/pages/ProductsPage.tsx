"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Package, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProductMockup } from "@/components/ui/ProductMockup";
import { useProductStore } from "@/stores/useProductStore";
import { useUIStore } from "@/stores/useUIStore";
import { CUSTOMERS, getCustomerById } from "@/lib/customers";
import type { Product, HolidayType, PackagingShape } from "@/types/product";

const HOLIDAYS: HolidayType[] = [
  "christmas",
  "hanukkah",
  "passover",
  "rosh-hashanah",
  "everyday",
];

export function ProductsPage() {
  const products = useProductStore((s) => s.products);
  const search = useProductStore((s) => s.search);
  const category = useProductStore((s) => s.category);
  const setSearch = useProductStore((s) => s.setSearch);
  const setCategory = useProductStore((s) => s.setCategory);
  const replaceProducts = useProductStore((s) => s.replaceProducts);
  const addProduct = useProductStore((s) => s.addProduct);

  const selectedCustomerId = useUIStore((s) => s.selectedCustomerId);
  const setSelectedCustomerId = useUIStore((s) => s.setSelectedCustomerId);

  const activeCustomer = getCustomerById(selectedCustomerId);

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (products.length === 0 && activeCustomer) {
      replaceProducts(activeCustomer.products);
    }
  }, []);

  const categories = useMemo(
    () => ["all", ...new Set(products.map((p) => p.category))],
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesCat = category === "all" || p.category === category;
      return matchesSearch && matchesCat;
    });
  }, [products, search, category]);

  function handleCustomerChange(customerId: string) {
    const customer = getCustomerById(customerId);
    if (!customer) return;
    setSelectedCustomerId(customerId);
    replaceProducts(customer.products);
  }

  return (
    <DashboardLayout searchPlaceholder="Search by SKU, name or category...">
      <div className="flex-1 overflow-y-auto">
        {/* Page Header */}
        <div className="px-6 lg:px-10 pt-8 pb-6 border-b border-[var(--line)] bg-surface-0">
          <div className="flex items-center gap-2 text-xs text-muted mb-3">
            <span>Warehouse</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">Product Catalog</span>
          </div>

          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Product Catalog
              </h1>
              <p className="text-sm text-muted mt-1">
                {activeCustomer
                  ? `Showing products for ${activeCustomer.name}`
                  : "Select a customer to view products"}
              </p>
            </div>
            <Dialog.Root open={showAddModal} onOpenChange={setShowAddModal}>
              <Dialog.Trigger asChild>
                <button className="btn btn-primary">
                  <Plus className="size-4" /> Add Product
                </button>
              </Dialog.Trigger>
              <AddProductModal
                onAdd={(product) => {
                  addProduct(product);
                  setShowAddModal(false);
                }}
              />
            </Dialog.Root>
          </div>

          {/* Filters — inline in header */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select customer"
              className="h-10 px-3 border border-[var(--line-strong)] bg-surface-1 text-sm font-medium cursor-pointer rounded-lg appearance-none pr-8"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
              value={selectedCustomerId ?? ""}
              onChange={(e) => handleCustomerChange(e.target.value)}
            >
              {CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by category"
              className="h-10 px-3 border border-[var(--line-strong)] bg-surface-1 text-sm font-medium cursor-pointer rounded-lg appearance-none pr-8"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : cat}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <input
                className="h-10 pl-9 pr-4 w-64 border border-[var(--line-strong)] bg-surface-1 text-sm rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <span className="ml-auto text-xs text-muted tabular-nums">
              <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
              {products.length} products
            </span>
          </div>
        </div>

        {/* Product Grid */}
        <div className="px-6 lg:px-10 py-8">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filtered.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="bg-surface-0 border border-[var(--line)] rounded-2xl overflow-hidden group hover:shadow-[var(--shadow-lg)] hover:border-[var(--line-strong)] transition-all duration-200"
                >
                  {/* Product Preview */}
                  <div className="aspect-[4/3] flex items-center justify-center relative bg-gradient-to-b from-surface-1 to-surface-2">
                    <ProductMockup
                      shape={product.packaging}
                      color={product.color}
                      artworkUrl={product.artworkUrl}
                      name={product.name}
                      size="sm"
                    />
                    <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-surface-0/90 text-muted rounded-md backdrop-blur-sm">
                      {product.category}
                    </span>
                  </div>

                  {/* Product Info */}
                  <div className="px-4 pt-4 pb-5">
                    <p className="text-[11px] font-mono text-muted mb-1 tracking-wide">
                      {product.sku}
                    </p>
                    <h3 className="font-bold text-[15px] leading-snug truncate group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>

                    <div className="flex items-center justify-between mt-4">
                      {product.unitPrice != null ? (
                        <span className="text-lg font-black text-foreground">
                          ${product.unitPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted italic">No price</span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-surface-2 px-2 py-1 rounded-md">
                        {product.holiday.replace("-", " ")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="size-16 flex items-center justify-center bg-surface-2 mb-5 rounded-2xl">
                <Package className="size-7 text-muted" />
              </div>
              <p className="font-bold text-lg mb-1">No products found</p>
              <p className="text-sm text-muted max-w-xs">
                {products.length === 0
                  ? "Select a customer to load their product catalog."
                  : "Try adjusting your search or category filter."}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function AddProductModal({
  onAdd,
}: {
  onAdd: (product: Product) => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [cat, setCat] = useState("Candy");
  const [holiday, setHoliday] = useState<HolidayType>("everyday");
  const [packaging, setPackaging] = useState<PackagingShape>("box");
  const [width, setWidth] = useState("6");
  const [height, setHeight] = useState("8");
  const [depth, setDepth] = useState("4");
  const [color, setColor] = useState("#ec5b13");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitsPerCase, setUnitsPerCase] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    const product: Product = {
      id: `custom-${Date.now()}`,
      sku: sku.trim(),
      name: name.trim(),
      category: cat,
      holiday,
      dimensions: {
        width: Number(width) || 6,
        height: Number(height) || 8,
        depth: Number(depth) || 4,
      },
      color,
      packaging,
      ...(unitPrice ? { unitPrice: Number(unitPrice) } : {}),
      ...(unitsPerCase ? { unitsPerCase: Number(unitsPerCase) } : {}),
    };
    onAdd(product);
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface-0 border border-[var(--line-strong)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-strong)]">
          <Dialog.Title className="text-lg font-black uppercase tracking-tight">
            Add Product
          </Dialog.Title>
          <Dialog.Close asChild>
            <button
              aria-label="Close"
              className="text-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </Dialog.Close>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-product-name" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Name *
              </label>
              <input
                id="add-product-name"
                className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="add-product-sku" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                SKU *
              </label>
              <input
                id="add-product-sku"
                className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm font-mono rounded-lg"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Category + Holiday */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-product-category" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Category
              </label>
              <input
                id="add-product-category"
                className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="add-product-holiday" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Holiday
              </label>
              <select
                id="add-product-holiday"
                className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm cursor-pointer rounded-lg"
                value={holiday}
                onChange={(e) => setHoliday(e.target.value as HolidayType)}
              >
                {HOLIDAYS.map((h) => (
                  <option key={h} value={h}>
                    {h.replace("-", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Packaging Shape */}
          <fieldset>
            <legend className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
              Packaging Shape
            </legend>
            <div className="flex gap-2">
              {(["box", "bottle", "jar", "bag", "tin", "pouch"] as PackagingShape[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPackaging(s)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg border cursor-pointer transition-colors ${
                    packaging === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-[var(--line-strong)] hover:border-primary/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Dimensions */}
          <fieldset>
            <legend className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
              Dimensions (W x H x D inches)
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="add-product-width" className="sr-only">Width</label>
                <input
                  id="add-product-width"
                  type="number"
                  className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                  placeholder="Width"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="add-product-height" className="sr-only">Height</label>
                <input
                  id="add-product-height"
                  type="number"
                  className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                  placeholder="Height"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="add-product-depth" className="sr-only">Depth</label>
                <input
                  id="add-product-depth"
                  type="number"
                  className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                  placeholder="Depth"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* Price + Units + Color */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="add-product-price" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Unit Price
              </label>
              <input
                id="add-product-price"
                type="number"
                step="0.01"
                className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="add-product-units" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Units/Case
              </label>
              <input
                id="add-product-units"
                type="number"
                className="w-full px-3 py-2.5 min-h-[44px] border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="12"
                value={unitsPerCase}
                onChange={(e) => setUnitsPerCase(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="add-product-color" className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="add-product-color"
                  type="color"
                  className="size-9 border border-[var(--line-strong)] rounded-lg cursor-pointer p-0.5"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="text-xs font-mono text-muted">{color}</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-5 py-2.5 min-h-[44px] border border-[var(--line-strong)] font-bold text-sm uppercase hover:bg-surface-1 cursor-pointer rounded-xl"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="submit"
              className="px-5 py-2.5 min-h-[44px] bg-primary text-white font-bold text-sm uppercase hover:bg-primary-hover cursor-pointer rounded-xl"
            >
              Add Product
            </button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
