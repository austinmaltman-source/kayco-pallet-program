"use client";

import {
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Users,
  Hammer,
  TrendingUp,
  Clock,
  Search,
  ArrowUpRight,
  Mail,
  Phone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const STATS = [
  {
    label: "Total Customers",
    value: "128",
    change: "+12",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary-soft",
  },
  {
    label: "Active Builds",
    value: "24",
    change: "+3",
    icon: Hammer,
    color: "text-success-fg",
    bgColor: "bg-[var(--success-soft)]",
  },
  {
    label: "Weekly Orders",
    value: "412",
    change: "+8%",
    icon: TrendingUp,
    color: "text-[var(--info)]",
    bgColor: "bg-blue-50",
  },
  {
    label: "On-Time Rate",
    value: "98.2%",
    change: "+0.4%",
    icon: Clock,
    color: "text-[var(--purple)]",
    bgColor: "bg-[var(--purple-soft)]",
  },
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
    phone: "(513) 762-4000",
    status: "Priority",
    statusClass: "badge-success",
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
    phone: "(616) 453-6711",
    status: "Standard",
    statusClass: "badge-muted",
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
    phone: "(704) 844-3100",
    status: "Urgent",
    statusClass: "badge-warning",
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
    phone: "(863) 688-1188",
    status: "Inactive",
    statusClass: "badge-muted",
  },
];

const INITIAL_COLORS: Record<string, string> = {
  K: "bg-primary-soft text-primary",
  M: "bg-blue-50 text-[var(--info)]",
  H: "bg-[var(--warning-soft)] text-[var(--warning-fg)]",
  P: "bg-[var(--purple-soft)] text-[var(--purple)]",
};

export function CustomersPage() {
  const router = useRouter();

  return (
    <DashboardLayout searchPlaceholder="Search customers, orders, or contact details...">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="eyebrow mb-2">Manage</p>
            <h2 className="text-3xl font-black tracking-tight uppercase">
              Customers
            </h2>
            <p className="text-muted text-sm mt-1">
              Review partner performance and active pallet logistics.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              aria-label="Filter customers"
              className="btn btn-secondary btn-sm"
            >
              <Filter className="size-4" /> Filter
            </button>
            <button className="btn btn-primary btn-sm">
              <Plus className="size-4" /> Add Customer
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="card-elevated p-5 flex items-start gap-4"
              >
                <div
                  className={`size-11 ${stat.bgColor} ${stat.color} flex items-center justify-center rounded-xl shrink-0`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
                    {stat.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black tracking-tight">
                      {stat.value}
                    </p>
                    <span className="text-xs font-bold text-success-fg">
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table Card */}
        <div className="card-elevated overflow-hidden">
          {/* Table toolbar */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--line)]">
            <h3 className="text-sm font-bold uppercase tracking-wider">
              All Customers
            </h3>
            <div className="relative">
              <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search customers..."
                className="input pl-9 !min-h-[36px] !text-sm w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-1">
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Customer
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Active Builds
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Recent Order
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Contact
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-muted uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {CUSTOMERS.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-1/60 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/customers/${c.slug}`)}
                    tabIndex={0}
                    role="link"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        router.push(`/customers/${c.slug}`);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-10 ${INITIAL_COLORS[c.initial] || "bg-surface-2 text-muted"} flex items-center justify-center font-bold text-sm rounded-full`}
                        >
                          {c.initial}
                        </div>
                        <div>
                          <Link
                            href={`/customers/${c.slug}`}
                            className="font-bold text-sm hover:text-primary flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.name}
                            <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </Link>
                          <p className="text-xs text-muted mt-0.5">{c.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-bold tabular-nums">
                          {c.builds}
                        </span>
                        <div
                          className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={c.buildPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${c.builds} active builds`}
                        >
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${c.buildPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{c.history}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {c.historyNote}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{c.contact}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Mail className="size-3" />
                          {c.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${c.statusClass}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        aria-label="More actions"
                        className="btn-ghost size-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-primary cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-[var(--line)]">
            <p className="text-xs text-muted font-medium">
              Showing <span className="font-bold text-foreground">1-{CUSTOMERS.length}</span> of{" "}
              <span className="font-bold text-foreground">{CUSTOMERS.length}</span> customers
            </p>
            <div className="flex gap-1.5">
              <button
                aria-label="Previous page"
                className="size-9 flex items-center justify-center border border-[var(--line-strong)] rounded-lg text-muted hover:text-primary cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                aria-label="Page 1"
                className="size-9 flex items-center justify-center bg-primary text-white text-sm font-bold cursor-pointer rounded-lg"
              >
                1
              </button>
              <button
                aria-label="Page 2"
                className="size-9 flex items-center justify-center border border-[var(--line-strong)] rounded-lg text-sm hover:text-primary cursor-pointer transition-colors"
              >
                2
              </button>
              <button
                aria-label="Page 3"
                className="size-9 flex items-center justify-center border border-[var(--line-strong)] rounded-lg text-sm hover:text-primary cursor-pointer transition-colors"
              >
                3
              </button>
              <button
                aria-label="Next page"
                className="size-9 flex items-center justify-center border border-[var(--line-strong)] rounded-lg text-muted hover:text-primary cursor-pointer transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
