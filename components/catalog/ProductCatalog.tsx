"use client";

import { useId, useMemo, useState } from "react";
import { FileDown, Upload } from "lucide-react";

import { importProductsFromFile } from "@/services/importService";
import { useProductStore } from "@/stores/useProductStore";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductForm } from "@/components/catalog/ProductForm";

export function ProductCatalog({
  onStatus,
}: {
  onStatus: (message: string) => void;
}) {
  const products = useProductStore((state) => state.products);
  const search = useProductStore((state) => state.search);
  const category = useProductStore((state) => state.category);
  const activeProductId = useProductStore((state) => state.activeProductId);
  const setSearch = useProductStore((state) => state.setSearch);
  const setCategory = useProductStore((state) => state.setCategory);
  const setActiveProduct = useProductStore((state) => state.setActiveProduct);
  const addProduct = useProductStore((state) => state.addProduct);
  const importProducts = useProductStore((state) => state.importProducts);
  const inputId = useId();
  const [isImporting, setIsImporting] = useState(false);

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
    <section className="panel-surface rounded-[32px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-[11px] text-[var(--muted)]">Catalog</p>
          <h2 className="display-font mt-1 text-lg font-semibold">Products</h2>
        </div>

        <label
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white/75 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white"
          htmlFor={inputId}
        >
          {isImporting ? <FileDown className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          Import
        </label>
        <input
          className="hidden"
          id={inputId}
          onChange={async (event) => {
            const file = event.target.files?.[0];

            if (!file) {
              return;
            }

            setIsImporting(true);

            try {
              const result = await importProductsFromFile(file);
              importProducts(result.products);
              onStatus(`Imported ${result.imported} products. Rejected ${result.rejected}.`);
            } finally {
              setIsImporting(false);
              event.target.value = "";
            }
          }}
          type="file"
        />
      </div>

      <div className="mt-4 grid gap-3">
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition-colors focus:border-[var(--primary)]"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search SKU, name, or category"
          value={search}
        />
        <select
          className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition-colors focus:border-[var(--primary)]"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          {categories.map((entry) => (
            <option key={entry} value={entry}>
              {entry === "all" ? "All categories" : entry}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {filteredProducts.map((product) => (
          <ProductCard
            active={activeProductId === product.id}
            key={product.id}
            onSelect={() => setActiveProduct(product.id)}
            product={product}
          />
        ))}

        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
            No products match the current search and filter.
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold">Manual product entry</p>
        <ProductForm
          onCreate={(product) => {
            addProduct(product);
            setActiveProduct(product.id);
            onStatus(`Added ${product.name}.`);
          }}
        />
      </div>
    </section>
  );
}
