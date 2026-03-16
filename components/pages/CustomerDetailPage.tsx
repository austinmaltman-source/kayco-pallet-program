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
} from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getCustomerById } from "@/lib/customers";
import type { PalletHistory } from "@/lib/customers";

const STATUS_STYLES: Record<string, string> = {
  Priority: "bg-green-100 text-green-700",
  Standard: "bg-surface-2 text-muted",
  Urgent: "bg-amber-100 text-amber-700",
  Inactive: "bg-surface-2 text-muted",
};

const PALLET_STATUS_CONFIG: Record<
  PalletHistory["status"],
  { icon: typeof Truck; label: string; style: string }
> = {
  delivered: {
    icon: CheckCircle2,
    label: "Delivered",
    style: "text-green-600",
  },
  "in-transit": { icon: Truck, label: "In Transit", style: "text-blue-600" },
  pending: { icon: Clock, label: "Pending", style: "text-amber-600" },
  completed: {
    icon: CircleDot,
    label: "Completed",
    style: "text-muted",
  },
};

export function CustomerDetailPage({ slug }: { slug: string }) {
  const customer = getCustomerById(slug);

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-black uppercase mb-2">
              Customer Not Found
            </p>
            <Link
              href="/customers"
              className="text-primary font-bold text-sm uppercase hover:underline"
            >
              Back to Customers
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const categories = [
    ...new Set(customer.products.map((p) => p.category)),
  ].sort();

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto p-8">
        {/* Back + Header */}
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-primary mb-6 uppercase tracking-wide"
        >
          <ArrowLeft className="size-4" /> All Customers
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="size-14 bg-surface-2 flex items-center justify-center font-black text-xl text-primary rounded-full">
              {customer.name[0]}
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase">
                {customer.name}
              </h2>
              <span
                className={`inline-block mt-1 px-2 py-0.5 ${STATUS_STYLES[customer.status] || "bg-surface-2 text-muted"} text-[10px] font-bold uppercase tracking-tighter rounded-md`}
              >
                {customer.status}
              </span>
            </div>
          </div>
          <Link
            href="/editor"
            className="px-6 py-2 bg-primary text-white font-bold text-sm uppercase hover:bg-primary-hover rounded-xl"
          >
            New Build
          </Link>
        </div>

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface-0 border border-[var(--line-strong)] p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <User className="size-4 text-muted" />
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Contact
              </p>
            </div>
            <p className="font-bold mb-1">{customer.contact}</p>
            <div className="flex items-center gap-2 text-sm text-muted mb-1">
              <Mail className="size-3.5" /> {customer.email}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Phone className="size-3.5" /> {customer.phone}
            </div>
          </div>

          <div className="bg-surface-0 border border-[var(--line-strong)] p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="size-4 text-muted" />
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Address
              </p>
            </div>
            <p className="text-sm">{customer.address}</p>
          </div>

          <div className="bg-surface-0 border border-[var(--line-strong)] p-6 rounded-xl border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-3">
              <Package className="size-4 text-muted" />
              <p className="text-xs font-bold text-muted uppercase tracking-widest">
                Catalog
              </p>
            </div>
            <p className="text-2xl font-black">{customer.products.length}</p>
            <p className="text-xs text-muted">
              Approved SKUs across {categories.length} categories
            </p>
          </div>
        </div>

        {/* Approved SKUs */}
        <div className="mb-8">
          <h3 className="text-xl font-black uppercase tracking-tight mb-4">
            Approved SKUs
          </h3>
          <div className="bg-surface-0 border border-[var(--line-strong)] overflow-x-auto rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-1 border-b border-[var(--line-strong)]">
                  <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                    Product
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                    SKU
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                    Category
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                    Holiday
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest text-right">
                    Unit Price
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest text-right">
                    Per Case
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {customer.products.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-surface-1/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-8 rounded-lg"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-bold text-sm">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted">
                      {p.sku}
                    </td>
                    <td className="px-6 py-4 text-sm">{p.category}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        {p.holiday.replace("-", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-right">
                      ${p.unitPrice?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-muted">
                      {p.unitsPerCase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Previous Pallets */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight mb-4">
            Previous Pallets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customer.palletHistory.map((pallet) => {
              const config = PALLET_STATUS_CONFIG[pallet.status];
              const StatusIcon = config.icon;
              return (
                <div
                  key={pallet.id}
                  className="bg-surface-0 border border-[var(--line-strong)] p-5 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-sm">{pallet.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {pallet.skuCount} SKUs &middot; {pallet.date}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-xs font-bold uppercase ${config.style}`}
                  >
                    <StatusIcon className="size-3.5" />
                    {config.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
