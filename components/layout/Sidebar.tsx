"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Grid3X3,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/editor", label: "Pallet Builder", icon: Grid3X3 },
  { href: "/products", label: "Products", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: Users },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen flex flex-col bg-sidebar-bg text-white shrink-0 border-r border-sidebar-border relative z-20">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="size-10 bg-primary flex items-center justify-center rounded-xl">
          <Package className="size-5 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-bold text-lg leading-none text-white uppercase tracking-tight">
            Kayco
          </h1>
          <p className="text-[10px] text-primary/70 font-bold uppercase tracking-widest mt-1">
            Pallet Program
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                isActive
                  ? "sidebar-active text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn("size-[22px]", !isActive && "text-primary/80")}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="mt-auto border-t border-white/10 pt-4 pb-4">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                  isActive
                    ? "sidebar-active text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "size-[22px]",
                    !isActive && "text-primary/80"
                  )}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* New Build CTA */}
      <div className="p-4 border-t border-white/10">
        <Link
          href="/editor"
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-lg text-sm uppercase tracking-wider cursor-pointer rounded-xl"
          style={{ boxShadow: "0 4px 14px -3px rgba(236, 91, 19, 0.3)" }}
        >
          <Plus className="size-4" />
          New Build
        </Link>
      </div>
    </aside>
  );
}
