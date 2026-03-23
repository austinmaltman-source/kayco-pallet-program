"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Plus, Search, X, Box, Loader2 } from "lucide-react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProductMockup } from "@/components/ui/ProductMockup";
import { useProductStore } from "@/stores/useProductStore";
import { useUIStore } from "@/stores/useUIStore";
import type { CustomerSummary } from "@/types/customer";
import type { HolidayType, PackagingShape, Product } from "@/types/product";

const HOLIDAYS: HolidayType[] = [
  "christmas",
  "hanukkah",
  "passover",
  "rosh-hashanah",
  "everyday",
];

export function ProductsPage() {
  const products = useProductStore((state) => state.products);
  const isLoading = useProductStore((state) => state.isLoading);
  const search = useProductStore((state) => state.search);
  const category = useProductStore((state) => state.category);
  const setSearch = useProductStore((state) => state.setSearch);
  const setCategory = useProductStore((state) => state.setCategory);
  const fetchProducts = useProductStore((state) => state.fetchProducts);
  const addProduct = useProductStore((state) => state.addProduct);

  const selectedCustomerId = useUIStore((state) => state.selectedCustomerId);
  const setSelectedCustomerId = useUIStore((state) => state.setSelectedCustomerId);

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      const response = await fetch("/api/customers");
      if (!response.ok) {
        throw new Error("Failed to load customers");
      }

      const data = (await response.json()) as CustomerSummary[];
      if (cancelled) {
        return;
      }

      setCustomers(data);

      const hasSelectedCustomer = data.some((customer) => customer.id === selectedCustomerId);
      if (!hasSelectedCustomer && data[0]) {
        setSelectedCustomerId(data[0].id);
      }
    }

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId, setSelectedCustomerId]);

  useEffect(() => {
    void fetchProducts(selectedCustomerId || undefined);
  }, [fetchProducts, selectedCustomerId]);

  const activeCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  const categories = useMemo(
    () => ["all", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filtered = useMemo(() => {
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

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
  }

  return (
    <DashboardLayout searchPlaceholder="Search by SKU, name or category...">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--line)] bg-surface-0 px-6 pb-6 pt-8 lg:px-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Product Catalog</h1>
              <p className="mt-1 text-sm text-muted">
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
                onAdd={async (product) => {
                  await addProduct(product, selectedCustomerId || undefined);
                  setShowAddModal(false);
                }}
              />
            </Dialog.Root>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select customer"
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[var(--line-strong)] bg-surface-1 px-3 pr-8 text-sm font-medium"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
              }}
              value={selectedCustomerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by category"
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[var(--line-strong)] bg-surface-1 px-3 pr-8 text-sm font-medium"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
              }}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry === "all" ? "All Categories" : entry}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                className="h-10 w-64 rounded-lg border border-[var(--line-strong)] bg-surface-1 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Search products..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <span className="ml-auto text-xs tabular-nums text-muted">
              <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
              {products.length} products
            </span>
          </div>
        </div>

        <div className="px-6 py-8 lg:px-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <Loader2 className="size-7 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted">Loading products...</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-surface-0 transition-all duration-200 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-lg)]"
                >
                  <div className="relative aspect-[4/3] bg-gradient-to-b from-surface-1 to-surface-2 flex items-center justify-center">
                    <ProductMockup
                      shape={product.packaging}
                      color={product.color}
                      artworkUrl={product.artworkUrl}
                      name={product.name}
                      size="sm"
                    />
                    <span className="absolute left-3 top-3 rounded-md bg-surface-0/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted backdrop-blur-sm">
                      {product.category}
                    </span>
                  </div>

                  <div className="px-4 pb-5 pt-4">
                    <p className="mb-1 text-[11px] font-mono tracking-wide text-muted">
                      {product.sku}
                    </p>
                    <h3 className="truncate text-[15px] font-bold leading-snug transition-colors group-hover:text-primary">
                      {product.name}
                    </h3>

                    <div className="mt-4 flex items-center justify-between">
                      {product.unitPrice != null ? (
                        <span className="text-lg font-black text-foreground">
                          ${product.unitPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted">No price</span>
                      )}
                      <span className="rounded-md bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {product.holiday.replace("-", " ")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-surface-2">
                <Package className="size-7 text-muted" />
              </div>
              <p className="mb-1 text-lg font-bold">No products found</p>
              <p className="max-w-xs text-sm text-muted">
                {products.length === 0
                  ? "No products are linked to this customer yet."
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
  onAdd: (product: Product) => Promise<void>;
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
  const [modelUrl, setModelUrl] = useState("");
  const [modelUploading, setModelUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modelFileName, setModelFileName] = useState("");
  const modelInputRef = useRef<HTMLInputElement>(null);

  async function handleModelUpload(file: File) {
    const validExts = [".glb", ".gltf", ".obj", ".fbx", ".usdz"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) return;

    setModelUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Upload failed");
      const { url } = (await response.json()) as { url: string };
      setModelUrl(url);
      setModelFileName(file.name);
    } finally {
      setModelUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    setIsSubmitting(true);

    try {
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
        ...(modelUrl ? { modelUrl } : {}),
      };

      await onAdd(product);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--line-strong)] bg-surface-0">
        <div className="flex items-center justify-between border-b border-[var(--line-strong)] px-6 py-4">
          <Dialog.Title className="text-lg font-black uppercase tracking-tight">
            Add Product
          </Dialog.Title>
          <Dialog.Close asChild>
            <button aria-label="Close" className="cursor-pointer text-muted hover:text-foreground">
              <X className="size-5" />
            </button>
          </Dialog.Close>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-product-name" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Name *
              </label>
              <input
                id="add-product-name"
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="add-product-sku" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                SKU *
              </label>
              <input
                id="add-product-sku"
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Category
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={cat}
                onChange={(event) => setCat(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Holiday
              </label>
              <select
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={holiday}
                onChange={(event) => setHoliday(event.target.value as HolidayType)}
              >
                {HOLIDAYS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Width
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Height
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Depth
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={depth}
                onChange={(event) => setDepth(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Packaging
              </label>
              <select
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={packaging}
                onChange={(event) => setPackaging(event.target.value as PackagingShape)}
              >
                <option value="box">Box</option>
                <option value="bottle">Bottle</option>
                <option value="jar">Jar</option>
                <option value="bag">Bag</option>
                <option value="tin">Tin</option>
                <option value="pouch">Pouch</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Color
              </label>
              <input
                className="h-[44px] w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-2"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Unit Price
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
                Units / Case
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line-strong)] bg-surface-0 px-3 py-2.5 text-sm"
                value={unitsPerCase}
                onChange={(event) => setUnitsPerCase(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
              3D Model
            </label>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => modelInputRef.current?.click()}
              disabled={modelUploading}
            >
              {modelUploading ? <Loader2 className="size-4 animate-spin" /> : <Box className="size-4" />}
              {modelFileName || "Upload model"}
            </button>
            <input
              ref={modelInputRef}
              type="file"
              className="hidden"
              accept=".glb,.gltf,.obj,.fbx,.usdz"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleModelUpload(file);
                }
              }}
            />
          </div>

          <button className="btn btn-primary w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : "Create Product"}
          </button>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
