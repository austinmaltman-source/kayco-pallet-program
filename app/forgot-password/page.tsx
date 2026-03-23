"use client";

import Link from "next/link";
import { useState } from "react";

import { forgetPassword } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await forgetPassword({
        email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        setError(result.error.message || "Unable to send reset email.");
        return;
      }

      setSuccess(true);
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
          <h1 className="text-3xl font-black uppercase tracking-tight">Forgot Password</h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and we will send you a password reset link.
          </p>

          {success ? (
            <div className="mt-8 space-y-4 text-center">
              <p className="text-sm text-muted">
                If an account exists for that email, a reset link has been sent.
              </p>
              <Link href="/login" className="font-bold text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
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

              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

              <button className="btn btn-primary w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
