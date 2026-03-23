"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { resetPassword } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!token) {
      setError("Reset token is missing.");
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message || "Unable to reset password.");
        return;
      }

      router.push("/login?reset=success");
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
          <h1 className="text-3xl font-black uppercase tracking-tight">Reset Password</h1>
          <p className="mt-2 text-sm text-muted">
            Choose a new password for your account.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                New Password
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>

            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

            <button className="btn btn-primary w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            <Link href="/login" className="font-bold text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="min-h-screen bg-surface-1 px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <div className="w-full rounded-3xl border border-[var(--line)] bg-surface-0 p-8 shadow-[var(--shadow-lg)]">
          <p className="eyebrow mb-3">Kayco</p>
          <h1 className="text-3xl font-black uppercase tracking-tight">Reset Password</h1>
          <p className="mt-2 text-sm text-muted">Loading reset form...</p>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
