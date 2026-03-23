"use client";

import Link from "next/link";
import { useState } from "react";

import { signUp } from "@/lib/auth-client";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name) {
      setError("First and last name are required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        const message = (result.error.message || "").toLowerCase();
        if (
          message.includes("already") ||
          message.includes("exist") ||
          message.includes("taken")
        ) {
          setError("An account with this email already exists. Try signing in instead.");
        } else {
          setSuccess(true);
        }
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
          <h1 className="text-3xl font-black uppercase tracking-tight">Create Account</h1>
          <p className="mt-2 text-sm text-muted">
            Register a workspace user for the shared pallet program backend.
          </p>

          {success ? (
            <div className="mt-8 space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Account Pending Approval</h2>
              <p className="text-sm text-muted">
                Your account request was submitted. You will receive an email once an admin approves access.
              </p>
              <Link href="/login" className="font-bold text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                      First Name
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                      Last Name
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      required
                    />
                  </div>
                </div>
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
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Password
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
                  {isSubmitting ? "Creating Account..." : "Request Access"}
                </button>
              </form>

              <p className="mt-6 text-sm text-muted">
                Already have an account?{" "}
                <Link className="font-bold text-primary hover:underline" href="/login">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
