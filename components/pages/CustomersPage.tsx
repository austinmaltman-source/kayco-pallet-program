"use client";

import {
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const STATS = [
  { label: "Total Customers", value: "128", accent: false },
  { label: "Active Builds", value: "24", accent: true },
  { label: "Weekly Orders", value: "412", accent: false },
  { label: "On-Time Rate", value: "98.2%", accent: false },
];

const CUSTOMERS = [
  {
    name: "Kroger Co.",
    id: "KR-90210",
    slug: "kroger",
    initial: "K",
    builds: 12,
    buildPct: 70,
    history: "Mixed Produce #482",
    historyNote: "Delivered 2h ago",
    contact: "Sarah Jenkins",
    email: "s.jenkins@kroger.com",
    status: "Priority",
    statusStyle: "bg-green-100 text-green-700",
  },
  {
    name: "Meijer Inc.",
    id: "MJ-44102",
    slug: "meijer",
    initial: "M",
    builds: 4,
    buildPct: 25,
    history: "Dry Goods #991",
    historyNote: "In Transit",
    contact: "David Vane",
    email: "d.vane@meijer.com",
    status: "Standard",
    statusStyle: "bg-surface-2 text-muted",
  },
  {
    name: "Harris Teeter",
    id: "HT-55092",
    slug: "harris-teeter",
    initial: "H",
    builds: 8,
    buildPct: 50,
    history: "Frozen Tier #112",
    historyNote: "Pending Pickup",
    contact: "Michael Ross",
    email: "mross@ht.com",
    status: "Urgent",
    statusStyle: "bg-amber-100 text-amber-700",
  },
  {
    name: "Publix Markets",
    id: "PB-10042",
    slug: "publix",
    initial: "P",
    builds: 0,
    buildPct: 0,
    history: "Bakery Mix #301",
    historyNote: "Completed 4d ago",
    contact: "Linda Chao",
    email: "lchao@publix.com",
    status: "Inactive",
    statusStyle: "bg-surface-2 text-muted",
  },
];

export function CustomersPage() {
  const router = useRouter();

  return (
    <DashboardLayout searchPlaceholder="Search customers, orders, or contact details...">
      <div className="flex-1 overflow-y-auto p-8">
        {/* Title */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">
              Customer Management
            </h2>
            <p className="text-muted">
              Review partner performance and active pallet logistics.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-6 py-2 bg-surface-0 border border-[var(--line-strong)] font-bold text-sm uppercase flex items-center gap-2 hover:bg-surface-1 cursor-pointer rounded-xl">
              <Filter className="size-4" /> Filter
            </button>
            <button className="px-6 py-2 bg-primary text-white font-bold text-sm uppercase hover:bg-primary-hover cursor-pointer rounded-xl">
              Add Customer
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className={`bg-surface-0 border border-[var(--line-strong)] p-6 rounded-xl ${
                stat.accent ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-black">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-surface-0 border border-[var(--line-strong)] overflow-x-auto rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-1 border-b border-[var(--line-strong)]">
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                  Customer Entity
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                  Active Builds
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                  Recent History
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                  Contact Point
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {CUSTOMERS.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-surface-1/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/customers/${c.slug}`)}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-surface-2 flex items-center justify-center font-bold text-primary rounded-full">
                        {c.initial}
                      </div>
                      <div>
                        <p className="font-bold">{c.name}</p>
                        <p className="text-xs text-muted">ID: {c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">
                        {c.builds} Builds
                      </span>
                      <div className="w-24 h-1.5 bg-surface-2 rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${c.buildPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm">{c.history}</p>
                    <p className="text-xs text-muted">{c.historyNote}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-medium">{c.contact}</p>
                    <p className="text-xs text-muted">{c.email}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`px-2 py-1 ${c.statusStyle} text-[10px] font-bold uppercase tracking-tighter rounded-md`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="text-muted hover:text-primary cursor-pointer">
                      <MoreVertical className="size-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-surface-1 flex items-center justify-between border-t border-[var(--line-strong)]">
            <p className="text-xs text-muted font-medium">
              Showing 1-4 of 128 customers
            </p>
            <div className="flex gap-2">
              <button className="size-8 flex items-center justify-center border border-[var(--line-strong)] rounded-lg text-muted hover:text-primary cursor-pointer">
                <ChevronLeft className="size-4" />
              </button>
              <button className="size-8 flex items-center justify-center border border-primary bg-primary text-white cursor-pointer rounded-lg">
                1
              </button>
              <button className="size-8 flex items-center justify-center border border-[var(--line-strong)] rounded-lg hover:text-primary cursor-pointer">
                2
              </button>
              <button className="size-8 flex items-center justify-center border border-[var(--line-strong)] rounded-lg hover:text-primary cursor-pointer">
                3
              </button>
              <button className="size-8 flex items-center justify-center border border-[var(--line-strong)] rounded-lg text-muted hover:text-primary cursor-pointer">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
