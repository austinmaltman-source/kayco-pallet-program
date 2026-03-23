"use client";

import { useSession } from "@/lib/auth-client";

export function useAuth() {
  const { data: session, isPending } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: isPending,
    isAuthenticated: Boolean(session?.user),
  };
}
