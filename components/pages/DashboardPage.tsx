"use client";

import Link from "next/link";
import { Plus, Grid3X3, ShoppingCart, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div
            className="w-16 h-16 bg-primary text-white flex items-center justify-center mx-auto rounded-2xl"
            style={{ boxShadow: "0 10px 25px -5px rgba(236, 91, 19, 0.3)" }}
          >
            <Plus className="size-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase">
              Welcome to Kayco
            </h2>
            <p className="text-muted mt-2 text-sm">
              Build and manage pallet display layouts for your customers.
            </p>
          </div>
          <Link
            href="/editor"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 text-sm uppercase tracking-wider transition-colors cursor-pointer rounded-xl"
          >
            <Grid3X3 className="size-4" />
            Open Layout Editor
          </Link>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Link
              href="/products"
              className="bg-surface-0 border border-[var(--line-strong)] py-4 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer rounded-xl"
            >
              <ShoppingCart className="size-5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-tighter">
                Products
              </span>
            </Link>
            <Link
              href="/customers"
              className="bg-surface-0 border border-[var(--line-strong)] py-4 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer rounded-xl"
            >
              <Users className="size-5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-tighter">
                Customers
              </span>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
