"use client";

import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Package,
  User,
  Truck,
  CheckCircle2,
  Clock,
  CircleDot,
  Calendar,
  Hash,
  BarChart3,
  Plus,
  Search,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import type { Customer, PalletHistory } from "@/types/customer";
import type { Product } from "@/types/product";

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotColor: string }
> = {
  Priority: {
    label: "Priority",
    badgeClass: "badge-success",
    dotColor: "bg-[var(--success)]",
  },
  Standard: {
    label: "Standard",
    badgeClass: "badge-muted",
    dotColor: "bg-muted",
  },
  Urgent: {
    label: "Urgent",
    badgeClass: "badge-warning",
    dotColor: "bg-[var(--warning)]",
  },
  Inactive: {
    label: "Inactive",
    badgeClass: "badge-muted",
    dotColor: "bg-surface-3",
  },
};

const PALLET_STATUS_CONFIG: Record<
  PalletHistory["status"],
  { icon: typeof Truck; label: string; badgeClass: string }
> = {
  delivered: {
    icon: CheckCircle2,
    label: "Delivered",
    badgeClass: "badge-success",
  },
  "in-transit": {
    icon: Truck,
    label: "In Transit",
    badgeClass: "badge-primary",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    badgeClass: "badge-warning",
  },
  completed: {
    icon: CircleDot,
    label: "Completed",
    badgeClass: "badge-muted",
  },
};

export function CustomerDetailPage({ slug }: { slug: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<PalletHistory[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      try {
        const [customersResponse, productsResponse, historyResponse] = await Promise.all([
          fetch("/api/customers"),
          fetch(`/api/customers/${slug}/products`),
          fetch(`/api/customers/${slug}/history`),
        ]);

        if (!customersResponse.ok || !productsResponse.ok || !historyResponse.ok) {
          throw new Error("Failed to load customer detail");
        }

        const customers = (await customersResponse.json()) as Customer[];
        const products = (await productsResponse.json()) as Product[];
        const history = (await historyResponse.json()) as PalletHistory[];

        if (!cancelled) {
          setCustomer(customers.find((entry) => entry.id === slug) ?? null);
          setProducts(products);
          setHistory(history);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomer();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.sku, product.category]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [products, search]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    [products],
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Loading customer...
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-surface-2">
              <User className="size-8 text-muted" />
            </div>
            <p className="text-2xl font-black uppercase">Customer Not Found</p>
            <Link href="/customers" className="btn btn-primary btn-sm inline-flex">
              <ArrowLeft className="size-4" /> Back to Customers
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = STATUS_CONFIG[customer.status] || STATUS_CONFIG.Standard;
  const totalValue = products.reduce(
    (sum, product) => sum + (product.unitPrice || 0) * (product.unitsPerCase || 0),
    0,
  );
  const deliveredCount = history.filter(
    (entry) => entry.status === "delivered" || entry.status === "completed",
  ).length;

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <Link
          href="/customers"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" /> All Customers
        </Link>

        <div className="card-elevated mb-8 p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="size-16 shrink-0 rounded-2xl bg-primary-soft text-2xl font-black text-primary flex items-center justify-center">
                {customer.name[0]}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-3">
                  <h2 className="text-2xl font-black uppercase tracking-tight lg:text-3xl">
                    {customer.name}
                  </h2>
                  <span className={`badge ${statusInfo.badgeClass}`}>
                    <span
                      className={`mr-1.5 inline-block size-1.5 rounded-full ${statusInfo.dotColor}`}
                    />
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  Customer ID:{" "}
                  <span className="font-mono font-bold">{customer.id.toUpperCase()}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={`/editor?customer=${slug}`} className="btn btn-primary btn-sm">
                <Plus className="size-4" /> New Build
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
                Approved SKUs
              </p>
              <p className="text-xl font-black tabular-nums">{products.length}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
                Categories
              </p>
              <p className="text-xl font-black tabular-nums">{categories.length}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
                Pallets Fulfilled
              </p>
              <p className="text-xl font-black tabular-nums">{deliveredCount}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
                Catalog Value
              </p>
              <p className="text-xl font-black tabular-nums">
                ${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="card-elevated p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
                <User className="size-4" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Primary Contact
              </p>
            </div>
            <p className="mb-3 text-sm font-bold">{customer.contact}</p>
            <div className="space-y-2">
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2.5 text-sm text-muted transition-colors hover:text-primary"
              >
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{customer.email}</span>
              </a>
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2.5 text-sm text-muted transition-colors hover:text-primary"
              >
                <Phone className="size-3.5 shrink-0" />
                {customer.phone}
              </a>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-blue-50 text-[var(--info)] flex items-center justify-center">
                <MapPin className="size-4" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Shipping Address
              </p>
            </div>
            <p className="text-sm leading-relaxed">{customer.address}</p>
          </div>

          <div className="card-elevated p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-[var(--purple-soft)] text-[var(--purple)] flex items-center justify-center">
                <BarChart3 className="size-4" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Categories
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const count = products.filter((product) => product.category === category).length;
                return (
                  <span key={category} className="badge badge-muted">
                    {category}
                    <span className="ml-1 text-[10px] opacity-70">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card-elevated mb-10 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Package className="size-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Approved SKUs</h3>
              <span className="badge badge-primary">{products.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                className="input w-48 pl-9 !min-h-[36px] !text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-1">
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Product
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    SKU
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Category
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Holiday
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-muted">
                    Unit Price
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-muted">
                    Per Case
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="group transition-colors hover:bg-surface-1/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-9 shrink-0 rounded-lg shadow-sm"
                          style={{ backgroundColor: product.color }}
                        />
                        <span className="text-sm font-bold">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded bg-surface-1 px-2 py-1 text-xs text-muted">
                        {product.sku}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{product.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge badge-muted">
                        {product.holiday.replace("-", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold tabular-nums">
                        ${product.unitPrice?.toFixed(2) ?? "0.00"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-muted tabular-nums">
                        {product.unitsPerCase ?? 0} units
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] bg-surface-1 px-6 py-3.5">
            <p className="text-xs font-medium text-muted">
              <span className="font-bold text-foreground">{products.length}</span> products across{" "}
              <span className="font-bold text-foreground">{categories.length}</span> categories
            </p>
            <p className="text-xs font-medium text-muted">
              Total catalog value:{" "}
              <span className="font-bold text-foreground">
                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </div>

        <div>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Truck className="size-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Pallet History</h3>
              <span className="badge badge-primary">{history.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {history.map((entry) => {
              const config = PALLET_STATUS_CONFIG[entry.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={entry.id}
                  className="card-elevated group flex cursor-pointer items-center justify-between p-5 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 shrink-0 rounded-xl bg-surface-1 flex items-center justify-center">
                      <Package className="size-5 text-muted" />
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        {entry.name}
                        <ArrowUpRight className="size-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Hash className="size-3" />
                          {entry.skuCount} SKUs
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Calendar className="size-3" />
                          {new Date(entry.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${config.badgeClass} flex items-center gap-1.5`}>
                    <StatusIcon className="size-3" />
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
