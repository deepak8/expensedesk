"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    const password = fd.get("password") as string;

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Sign in failed.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-full bg-[rgb(24_24_24)] flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg text-foreground tracking-tight">
            ExpenseDesk
          </span>
        </div>

        <div className="bg-white rounded-md border border-border p-6">
          <h1 className="text-[15px] font-semibold text-foreground mb-1">Sign in</h1>
          <p className="text-xs text-muted-foreground mb-5">
            Enter your email and password to continue
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] text-xs text-foreground">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                disabled={isPending}
                className="w-full h-9 px-3 text-sm rounded-md border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground disabled:opacity-60 transition-colors"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                disabled={isPending}
                className="w-full h-9 px-3 text-sm rounded-md border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground disabled:opacity-60 transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
