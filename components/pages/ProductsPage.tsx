"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Package, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

  useMemo(() => {
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
      <div className="flex-1 overflow-y-auto p-8">
        {/* Breadcrumbs */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Warehouse</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">Product Catalog</span>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="px-4 py-1.5 border border-[var(--line-strong)] bg-surface-0 text-sm font-medium cursor-pointer rounded-lg"
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
                className="px-4 py-1.5 border border-[var(--line-strong)] bg-surface-0 text-sm font-medium cursor-pointer rounded-lg"
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
                  className="pl-9 pr-4 py-1.5 border border-[var(--line-strong)] bg-surface-0 text-sm w-60 rounded-lg"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="h-6 w-px bg-surface-3 mx-2" />
              <span className="text-sm text-muted">
                Showing {filtered.length} of {products.length} products
              </span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-1.5 bg-primary text-white font-bold text-sm uppercase hover:bg-primary-hover cursor-pointer rounded-xl flex items-center gap-1.5"
            >
              <Plus className="size-4" /> Add Product
            </button>
          </div>
        </div>

        {/* Product Grid — compact cards, more columns */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filtered.map((product) => (
              <div
                key={product.id}
                onClick={() => router.push(`/products/${product.id}`)}
                className="bg-surface-0 border border-[var(--line-strong)] group hover:border-primary transition-colors cursor-pointer rounded-xl overflow-hidden"
              >
                {/* Compact color bar */}
                <div className="h-24 flex items-center justify-center relative bg-surface-1">
                  <ProductMockup
                    shape={product.packaging}
                    color={product.color}
                    artworkUrl={product.artworkUrl}
                    name={product.name}
                    size="sm"
                  />
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 bg-primary text-white rounded">
                    {product.category}
                  </span>
                </div>

                <div className="p-3">
                  <h3 className="font-bold text-sm leading-tight mb-0.5 truncate">
                    {product.name}
                  </h3>
                  <p className="text-muted text-[10px] font-mono mb-2">
                    {product.sku}
                  </p>
                  <div className="flex items-center justify-between">
                    {product.unitPrice != null && (
                      <span className="text-sm font-bold text-primary">
                        ${product.unitPrice.toFixed(2)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted uppercase font-bold">
                      {product.holiday.replace("-", " ")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-14 flex items-center justify-center bg-surface-2 mb-4 rounded-2xl">
              <Package className="size-6 text-muted" />
            </div>
            <p className="font-bold text-lg">No products found</p>
            <p className="text-sm text-muted mt-1">
              {products.length === 0
                ? "Select a customer to load their product catalog."
                : "Try adjusting your search or category filter."}
            </p>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onAdd={(product) => {
            addProduct(product);
            setShowAddModal(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}

function AddProductModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
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
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-0 border border-[var(--line-strong)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-strong)]">
          <h3 className="text-lg font-black uppercase tracking-tight">
            Add Product
          </h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Name *
              </label>
              <input
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                SKU *
              </label>
              <input
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm font-mono rounded-lg"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Category + Holiday */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Category
              </label>
              <input
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Holiday
              </label>
              <select
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm cursor-pointer rounded-lg"
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
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
              Packaging Shape
            </label>
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
          </div>

          {/* Dimensions */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
              Dimensions (W x H x D inches)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="Width"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
              <input
                type="number"
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="Height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
              <input
                type="number"
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="Depth"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </div>
          </div>

          {/* Price + Units + Color */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Unit Price
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Units/Case
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-[var(--line-strong)] bg-surface-0 text-sm rounded-lg"
                placeholder="12"
                value={unitsPerCase}
                onChange={(e) => setUnitsPerCase(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
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
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-[var(--line-strong)] font-bold text-sm uppercase hover:bg-surface-1 cursor-pointer rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-white font-bold text-sm uppercase hover:bg-primary-hover cursor-pointer rounded-xl"
            >
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
