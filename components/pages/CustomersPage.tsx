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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import type { CustomerSummary } from "@/types/customer";

const STATUS_CLASS: Record<CustomerSummary["status"], string> = {
  Priority: "badge-success",
  Standard: "badge-muted",
  Urgent: "badge-warning",
  Inactive: "badge-muted",
};

const INITIAL_COLORS: Record<string, string> = {
  K: "bg-primary-soft text-primary",
  M: "bg-blue-50 text-[var(--info)]",
  H: "bg-[var(--warning-soft)] text-[var(--warning-fg)]",
  P: "bg-[var(--purple-soft)] text-[var(--purple)]",
};

export function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      try {
        const response = await fetch("/api/customers");
        if (!response.ok) {
          throw new Error("Failed to load customers");
        }

        const data = (await response.json()) as CustomerSummary[];
        if (!cancelled) {
          setCustomers(data);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.contact, customer.email, customer.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    const activeBuilds = customers.reduce((sum, customer) => sum + customer.builds, 0);
    const priorityCount = customers.filter((customer) => customer.status === "Priority").length;
    const withHistory = customers.filter((customer) => customer.history).length;

    return [
      {
        label: "Total Customers",
        value: String(customers.length),
        change: `${filteredCustomers.length} shown`,
        icon: Users,
        color: "text-primary",
        bgColor: "bg-primary-soft",
      },
      {
        label: "Active Builds",
        value: String(activeBuilds),
        change: `${priorityCount} priority`,
        icon: Hammer,
        color: "text-success-fg",
        bgColor: "bg-[var(--success-soft)]",
      },
      {
        label: "With History",
        value: String(withHistory),
        change: "DB-backed",
        icon: TrendingUp,
        color: "text-[var(--info)]",
        bgColor: "bg-blue-50",
      },
      {
        label: "Loading State",
        value: isLoading ? "..." : "Ready",
        change: "Live API",
        icon: Clock,
        color: "text-[var(--purple)]",
        bgColor: "bg-[var(--purple-soft)]",
      },
    ];
  }, [customers, filteredCustomers.length, isLoading]);

  return (
    <DashboardLayout searchPlaceholder="Search customers, orders, or contact details...">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Manage</p>
            <h2 className="text-3xl font-black tracking-tight uppercase">Customers</h2>
            <p className="mt-1 text-sm text-muted">
              Review partner performance and active pallet logistics.
            </p>
          </div>
          <div className="flex gap-3">
            <button aria-label="Filter customers" className="btn btn-secondary btn-sm">
              <Filter className="size-4" /> Filter
            </button>
            <button className="btn btn-primary btn-sm">
              <Plus className="size-4" /> Add Customer
            </button>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="card-elevated flex items-start gap-4 p-5">
                <div
                  className={`size-11 ${stat.bgColor} ${stat.color} flex shrink-0 items-center justify-center rounded-xl`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
                    {stat.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                    <span className="text-xs font-bold text-success-fg">{stat.change}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider">All Customers</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search customers..."
                className="input w-56 pl-9 !min-h-[36px] !text-sm"
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
                    Customer
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Active Builds
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Recent Order
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Contact
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-10 text-sm text-muted" colSpan={6}>
                      Loading customers...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-sm text-muted" colSpan={6}>
                      No customers matched the current search.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => {
                    const initial = customer.name.charAt(0).toUpperCase();
                    const buildPct = Math.min(100, customer.builds * 10);

                    return (
                      <tr
                        key={customer.id}
                        className="group cursor-pointer transition-colors hover:bg-surface-1/60"
                        onClick={() => router.push(`/customers/${customer.id}`)}
                        tabIndex={0}
                        role="link"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            router.push(`/customers/${customer.id}`);
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`size-10 ${INITIAL_COLORS[initial] || "bg-surface-2 text-muted"} flex items-center justify-center rounded-full text-sm font-bold`}
                            >
                              {initial}
                            </div>
                            <div>
                              <Link
                                href={`/customers/${customer.id}`}
                                className="flex items-center gap-1 text-sm font-bold hover:text-primary"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {customer.name}
                                <ArrowUpRight className="size-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                              </Link>
                              <p className="mt-0.5 text-xs text-muted">{customer.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-bold tabular-nums">
                              {customer.builds}
                            </span>
                            <div
                              className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2"
                              role="progressbar"
                              aria-valuenow={buildPct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${buildPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium">{customer.history || "No recent pallets"}</p>
                          <p className="mt-0.5 text-xs capitalize text-muted">
                            {customer.historyNote || "No status"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium">{customer.contact || "No contact"}</p>
                          <div className="mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs text-muted">
                              <Mail className="size-3" />
                              {customer.email || "No email"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${STATUS_CLASS[customer.status]}`}>
                            {customer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            aria-label="More actions"
                            className="btn-ghost inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:text-primary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] px-6 py-4">
            <p className="text-xs font-medium text-muted">
              Showing <span className="font-bold text-foreground">1-{filteredCustomers.length}</span>{" "}
              of <span className="font-bold text-foreground">{customers.length}</span> customers
            </p>
            <div className="flex gap-1.5">
              <button
                aria-label="Previous page"
                className="size-9 cursor-not-allowed rounded-lg border border-[var(--line-strong)] text-muted"
                disabled
              >
                <ChevronLeft className="mx-auto size-4" />
              </button>
              <button
                aria-label="Page 1"
                className="size-9 rounded-lg bg-primary text-sm font-bold text-white"
              >
                1
              </button>
              <button
                aria-label="Next page"
                className="size-9 cursor-not-allowed rounded-lg border border-[var(--line-strong)] text-muted"
                disabled
              >
                <ChevronRight className="mx-auto size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
