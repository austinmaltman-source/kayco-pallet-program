"use client";

import { Bell, Search } from "lucide-react";

interface HeaderProps {
  searchPlaceholder?: string;
}

export function Header({
  searchPlaceholder = "Search orders, pallets, or routes...",
}: HeaderProps) {
  return (
    <header className="h-16 bg-surface-0 border-b border-[var(--line-strong)] flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center flex-1">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
          <input
            className="w-full bg-surface-2 border-none py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary/50 text-sm rounded-xl"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 text-muted hover:bg-surface-2 relative cursor-pointer rounded-lg">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-surface-0" />
        </button>
        <div className="h-8 w-[1px] bg-surface-3 mx-2" />
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="text-right">
            <p className="text-sm font-bold leading-none">Alex Rivera</p>
            <p className="text-xs text-muted">Fleet Manager</p>
          </div>
          <div className="w-10 h-10 bg-surface-2 overflow-hidden border border-surface-3 flex items-center justify-center rounded-full">
            <span className="text-sm font-bold text-muted">AR</span>
          </div>
        </div>
      </div>
    </header>
  );
}
