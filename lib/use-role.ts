"use client";

import { useSession } from "@/lib/auth-client";

export type UserRole = "admin" | "editor" | "viewer";

export function useUserRole() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown> | undefined)
    ?.role as string | undefined;
  return {
    role: (role ?? "viewer") as UserRole,
    isAdmin: role === "admin",
    isEditor: role === "editor",
    canWrite: role === "admin" || role === "editor",
    isViewer: !role || role === "viewer",
  };
}
