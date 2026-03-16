"use client";

import { useMemo } from "react";
import { ChevronRight, Package, Plus, Search } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useProductStore } from "@/stores/useProductStore";
import { useUIStore } from "@/stores/useUIStore";
import { CUSTOMERS, getCustomerById } from "@/lib/customers";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

export function ProductsPage() {
  const products = useProductStore((s) => s.products);
  const search = useProductStore((s) => s.search);
  const category = useProductStore((s) => s.category);
  const setSearch = useProductStore((s) => s.setSearch);
  const setCategory = useProductStore((s) => s.setCategory);
  const replaceProducts = useProductStore((s) => s.replaceProducts);

  const selectedCustomerId = useUIStore((s) => s.selectedCustomerId);
  const setSelectedCustomerId = useUIStore((s) => s.setSelectedCustomerId);

  const activeCustomer = getCustomerById(selectedCustomerId);

  // Load customer products if store is empty
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
              {/* Customer selector */}
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

              {/* Category filter */}
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

              {/* Search */}
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
          </div>
        </div>

        {/* Product Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => (
              <ProductGridCard key={product.id} product={product} />
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
    </DashboardLayout>
  );
}

function ProductGridCard({ product }: { product: Product }) {
  const dim = product.dimensions;

  return (
    <div className="bg-surface-0 border border-[var(--line-strong)] group hover:border-primary transition-colors cursor-pointer rounded-2xl overflow-hidden">
      {/* Color swatch / image area */}
      <div className="aspect-[4/3] overflow-hidden relative flex items-center justify-center"
        style={{ backgroundColor: product.color + "18" }}
      >
        <div
          className="size-16 flex items-center justify-center rounded-2xl"
          style={{ backgroundColor: product.color }}
        >
          <Package className="size-7 text-white" />
        </div>
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-surface-0 border border-[var(--line)] text-muted rounded-md">
            {product.holiday}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-primary text-white rounded-md">
            {product.category}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-base mb-1">{product.name}</h3>
        <p className="text-muted text-xs mb-4">SKU: {product.sku}</p>

        <div className="grid grid-cols-2 gap-y-3 gap-x-2 border-t border-[var(--line)] pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-muted font-semibold">
              Dimensions
            </span>
            <span className="text-sm font-medium">
              {dim.width}" x {dim.height}" x {dim.depth}"
            </span>
          </div>
          {product.unitPrice != null && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted font-semibold">
                Unit Price
              </span>
              <span className="text-sm font-bold text-primary">
                ${product.unitPrice.toFixed(2)}
              </span>
            </div>
          )}
          {product.unitsPerCase != null && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted font-semibold">
                Units/Case
              </span>
              <span className="text-sm font-medium">
                {product.unitsPerCase}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-muted font-semibold">
              Color
            </span>
            <div className="flex items-center gap-2">
              <div
                className="size-4 border border-[var(--line)] rounded"
                style={{ backgroundColor: product.color }}
              />
              <span className="text-sm font-medium">{product.color}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
