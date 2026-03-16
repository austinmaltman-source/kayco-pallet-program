"use client";

import { useMemo } from "react";

import { useProductStore } from "@/stores/useProductStore";
import { ProductCard } from "@/components/catalog/ProductCard";

export function ProductCatalog() {
  const products = useProductStore((state) => state.products);
  const search = useProductStore((state) => state.search);
  const category = useProductStore((state) => state.category);
  const activeProductId = useProductStore((state) => state.activeProductId);
  const setSearch = useProductStore((state) => state.setSearch);
  const setCategory = useProductStore((state) => state.setCategory);
  const setActiveProduct = useProductStore((state) => state.setActiveProduct);

  const categories = useMemo(
    () => ["all", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      const matchesCategory = category === "all" || product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [category, products, search]);

  return (
    <div className="flex flex-col gap-3">
      <input
        aria-label="Search products"
        className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-[var(--primary)] focus:bg-white focus:shadow-md focus:shadow-[var(--primary)]/10"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search SKU, name, or category"
        value={search}
      />
      {categories.length > 2 && (
        <select
          aria-label="Filter by category"
          className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-[var(--primary)] focus:bg-white focus:shadow-md focus:shadow-[var(--primary)]/10"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          {categories.map((entry) => (
            <option key={entry} value={entry}>
              {entry === "all" ? "All categories" : entry}
            </option>
          ))}
        </select>
      )}

      <div className="space-y-2">
        {filteredProducts.map((product) => (
          <ProductCard
            active={activeProductId === product.id}
            key={product.id}
            onSelect={() => setActiveProduct(product.id)}
            product={product}
          />
        ))}

        {filteredProducts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            {products.length === 0
              ? "Select a customer to load products."
              : "No products match your search."}
          </div>
        )}
      </div>
    </div>
  );
}
