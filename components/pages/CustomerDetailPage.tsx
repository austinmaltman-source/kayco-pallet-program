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
  ExternalLink,
  Calendar,
  Hash,
  TrendingUp,
  BarChart3,
  Plus,
  Search,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getCustomerById } from "@/lib/customers";
import type { PalletHistory } from "@/lib/customers";

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
  const customer = getCustomerById(slug);

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="size-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto">
              <User className="size-8 text-muted" />
            </div>
            <p className="text-2xl font-black uppercase">Customer Not Found</p>
            <Link
              href="/customers"
              className="btn btn-primary btn-sm inline-flex"
            >
              <ArrowLeft className="size-4" /> Back to Customers
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const categories = [
    ...new Set(customer.products.map((p) => p.category)),
  ].sort();

  const statusInfo = STATUS_CONFIG[customer.status] || STATUS_CONFIG.Standard;

  const totalValue = customer.products.reduce(
    (sum, p) => sum + (p.unitPrice || 0) * (p.unitsPerCase || 0),
    0
  );

  const deliveredCount = customer.palletHistory.filter(
    (p) => p.status === "delivered" || p.status === "completed"
  ).length;

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {/* Breadcrumb */}
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-primary mb-8 uppercase tracking-wide transition-colors"
        >
          <ArrowLeft className="size-4" /> All Customers
        </Link>

        {/* Hero Header */}
        <div className="card-elevated p-6 lg:p-8 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="size-16 bg-primary-soft flex items-center justify-center font-black text-2xl text-primary rounded-2xl shrink-0">
                {customer.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">
                    {customer.name}
                  </h2>
                  <span className={`badge ${statusInfo.badgeClass}`}>
                    <span
                      className={`size-1.5 rounded-full ${statusInfo.dotColor} mr-1.5 inline-block`}
                    />
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  Customer ID: <span className="font-mono font-bold">{customer.id.toUpperCase()}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/editor?customer=${slug}`}
                className="btn btn-primary btn-sm"
              >
                <Plus className="size-4" /> New Build
              </Link>
            </div>
          </div>

          {/* Quick stats row inside hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[var(--line)]">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
                Approved SKUs
              </p>
              <p className="text-xl font-black tabular-nums">
                {customer.products.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
                Categories
              </p>
              <p className="text-xl font-black tabular-nums">
                {categories.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
                Pallets Fulfilled
              </p>
              <p className="text-xl font-black tabular-nums">
                {deliveredCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
                Catalog Value
              </p>
              <p className="text-xl font-black tabular-nums">
                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {/* Contact */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-8 bg-primary-soft text-primary flex items-center justify-center rounded-lg">
                <User className="size-4" />
              </div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Primary Contact
              </p>
            </div>
            <p className="font-bold text-sm mb-3">{customer.contact}</p>
            <div className="space-y-2">
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2.5 text-sm text-muted hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{customer.email}</span>
              </a>
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2.5 text-sm text-muted hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="size-3.5 shrink-0" />
                {customer.phone}
              </a>
            </div>
          </div>

          {/* Address */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-8 bg-blue-50 text-[var(--info)] flex items-center justify-center rounded-lg">
                <MapPin className="size-4" />
              </div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Shipping Address
              </p>
            </div>
            <p className="text-sm leading-relaxed">{customer.address}</p>
          </div>

          {/* Category Breakdown */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-8 bg-[var(--purple-soft)] text-[var(--purple)] flex items-center justify-center rounded-lg">
                <BarChart3 className="size-4" />
              </div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Categories
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const count = customer.products.filter(
                  (p) => p.category === cat
                ).length;
                return (
                  <span
                    key={cat}
                    className="badge badge-muted"
                  >
                    {cat}
                    <span className="ml-1 text-[10px] opacity-70">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Approved SKUs Table */}
        <div className="card-elevated overflow-hidden mb-10">
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]">
            <div className="flex items-center gap-2.5">
              <Package className="size-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Approved SKUs
              </h3>
              <span className="badge badge-primary">
                {customer.products.length}
              </span>
            </div>
            <div className="relative">
              <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products..."
                className="input pl-9 !min-h-[36px] !text-sm w-48"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-1">
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Product
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    SKU
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Category
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Holiday
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest text-right">
                    Unit Price
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest text-right">
                    Per Case
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {customer.products.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-surface-1/60 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-9 rounded-lg shrink-0 shadow-sm"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-bold text-sm">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-surface-1 px-2 py-1 rounded text-muted">
                        {p.sku}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{p.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge badge-muted">
                        {p.holiday.replace("-", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold tabular-nums">
                        ${p.unitPrice?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-muted tabular-nums">
                        {p.unitsPerCase} units
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3.5 bg-surface-1 border-t border-[var(--line)] flex items-center justify-between">
            <p className="text-xs text-muted font-medium">
              <span className="font-bold text-foreground">{customer.products.length}</span> products across{" "}
              <span className="font-bold text-foreground">{categories.length}</span> categories
            </p>
            <p className="text-xs text-muted font-medium">
              Total catalog value:{" "}
              <span className="font-bold text-foreground">
                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </div>

        {/* Previous Pallets */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Truck className="size-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Pallet History
              </h3>
              <span className="badge badge-primary">
                {customer.palletHistory.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customer.palletHistory.map((pallet) => {
              const config = PALLET_STATUS_CONFIG[pallet.status];
              const StatusIcon = config.icon;
              return (
                <div
                  key={pallet.id}
                  className="card-elevated p-5 flex items-center justify-between group hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 bg-surface-1 flex items-center justify-center rounded-xl shrink-0">
                      <Package className="size-5 text-muted" />
                    </div>
                    <div>
                      <p className="font-bold text-sm flex items-center gap-1.5">
                        {pallet.name}
                        <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Hash className="size-3" />
                          {pallet.skuCount} SKUs
                        </span>
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(pallet.date).toLocaleDateString("en-US", {
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
