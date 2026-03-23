"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetSuccess] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("reset") === "success";
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await signIn.email({ email, password });

      if (result.error) {
        try {
          const response = await fetch("/api/auth/check-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });

          if (response.ok) {
            const data = (await response.json()) as { status: string | null };
            if (data.status === "pending") {
              setError(
                "Your account is pending approval. You will receive an email once an admin approves your access.",
              );
              setIsSubmitting(false);
              return;
            }
          }
        } catch {
          // Fall back to the auth error below.
        }

        setError(result.error.message || "Unable to sign in.");
        setIsSubmitting(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface-1 px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <div className="w-full rounded-3xl border border-[var(--line)] bg-surface-0 p-8 shadow-[var(--shadow-lg)]">
          <p className="eyebrow mb-3">Kayco</p>
          <h1 className="text-3xl font-black uppercase tracking-tight">Sign In</h1>
          <p className="mt-2 text-sm text-muted">
            Access the pallet builder, customer catalog, and saved projects.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {showResetSuccess ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                Your password has been reset. Sign in with your new password.
              </p>
            ) : null}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Email
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

            <button className="btn btn-primary w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            Need an account?{" "}
            <Link className="font-bold text-primary hover:underline" href="/register">
              Register
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
