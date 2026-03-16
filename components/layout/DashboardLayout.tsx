"use client";

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
  return (
    <div className="flex min-h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header searchPlaceholder={searchPlaceholder} />
        <div className="flex-1 flex flex-col overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
