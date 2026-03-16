"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  searchPlaceholder?: string;
}

export function DashboardLayout({
  children,
  searchPlaceholder,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Desktop sidebar — always visible at lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile sidebar — slides in from left */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={closeSidebar} />
      </div>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          searchPlaceholder={searchPlaceholder}
          onMenuToggle={openSidebar}
        />
        <div className="flex-1 flex flex-col overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
