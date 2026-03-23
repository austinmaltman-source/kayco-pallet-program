"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth-client";
import { useUserRole } from "@/lib/use-role";

interface HeaderProps {
  searchPlaceholder?: string;
  onMenuToggle?: () => void;
}

export function Header({
  searchPlaceholder = "Search orders, pallets, or routes...",
  onMenuToggle,
}: HeaderProps) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "NA";

  return (
    <header className="h-16 bg-surface-0 border-b border-[var(--line-strong)] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
      <div className="flex items-center flex-1 gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 text-muted hover:bg-surface-2 rounded-lg cursor-pointer lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}
        <div className="relative w-full max-w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
          <input
            aria-label="Search"
            className="w-full bg-surface-2 border-none py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary/50 text-sm rounded-xl"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button aria-label="Notifications" className="p-2 text-muted hover:bg-surface-2 relative cursor-pointer rounded-lg">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-surface-0" />
        </button>
        <div className="h-8 w-[1px] bg-surface-3 mx-2" />
        <button
          aria-label="User profile"
          className="flex items-center gap-3 bg-transparent border-none p-0"
        >
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <p className="text-sm font-bold leading-none">
                {user?.name ?? "Workspace User"}
              </p>
              <span className="badge badge-muted text-[10px]">{role}</span>
            </div>
            <p className="text-xs text-muted">{user?.email ?? "Not signed in"}</p>
          </div>
          <div className="w-10 h-10 bg-surface-2 overflow-hidden border border-surface-3 flex items-center justify-center rounded-full">
            <span className="text-sm font-bold text-muted">{initials}</span>
          </div>
        </button>
        <button
          aria-label="Sign out"
          className="p-2 text-muted hover:bg-surface-2 cursor-pointer rounded-lg"
          onClick={() => {
            void signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/login";
                },
              },
            });
          }}
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </header>
  );
}
