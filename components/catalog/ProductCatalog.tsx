"use client";

import { useMemo } from "react";
import { Package, Search } from "lucide-react";

import { useProductStore } from "@/stores/useProductStore";
import { ProductCard } from "@/components/catalog/ProductCard";

export function ProductCatalog() {
  const products = useProductStore((state) => state.products);
  const isLoading = useProductStore((state) => state.isLoading);
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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
        <input
          id="product-search"
          aria-label="Search products"
          className="input pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products..."
          type="search"
          value={search}
        />
      </div>

      {/* Category filter */}
      {categories.length > 2 && (
        <select
          aria-label="Filter by category"
          className="input text-[13px]"
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

      {/* Product list */}
      <div className="space-y-2" role="list" aria-label="Product catalog">
        {filteredProducts.map((product) => (
          <div key={product.id} role="listitem">
            <ProductCard
              active={activeProductId === product.id}
              onSelect={() => setActiveProduct(product.id)}
              product={product}
            />
          </div>
        ))}

        {isLoading && (
          <div className="rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Loading products...
          </div>
        )}

        {!isLoading && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] mb-3">
              <Package className="h-5 w-5 text-[var(--muted)]" />
            </div>
            {products.length === 0 ? (
              <>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  No products loaded
                </p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Select a customer from the sidebar to load their products.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  No results found
                </p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Try a different search term or category.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-3"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
