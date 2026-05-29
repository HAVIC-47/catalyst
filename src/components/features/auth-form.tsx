"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === "signup";

  // Middleware has already enforced "must come from landing". Once we land here,
  // strip the ?from=landing query so a manual refresh has no param and middleware
  // sends them back to the landing page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.search.includes("from=landing")) {
      window.history.replaceState(null, "", isSignup ? "/signup" : "/login");
    }
  }, [isSignup]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (data.session) {
          router.push("/app");
          router.refresh();
        } else {
          setNotice("Account created. Check your email to confirm, then log in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/app");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass w-full max-w-sm rounded-2xl p-7">
      <Link
        href="/"
        aria-label="Back to Catalyst home"
        className="mb-6 inline-flex cursor-pointer items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-amber/80 transition-colors hover:text-amber"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Catalyst
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
        {isSignup ? "Create account" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-sm text-ink/50">
        {isSignup ? "Start mapping your money against your mood." : "Log in to your dashboard."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="min-h-[44px] w-full rounded-xl border border-ink/10 bg-ink/[0.03] pl-10 pr-3 text-sm text-ink outline-none focus:border-neon-cyan/50"
            />
          </div>
        </label>
        <label className="block">
          <span className="sr-only">Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "Create a password (min 6)" : "Password"}
              className="min-h-[44px] w-full rounded-xl border border-ink/10 bg-ink/[0.03] pl-10 pr-3 text-sm text-ink outline-none focus:border-neon-cyan/50"
            />
          </div>
        </label>

        {error && (
          <p className="rounded-lg border border-neon-rose/30 bg-neon-rose/10 px-3 py-2 text-xs text-neon-rose">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2 text-xs text-neon-cyan">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="entry-btn inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSignup ? "Sign up" : "Log in"}
        </button>
      </form>

      <div className="mt-6 border-t border-ink/[0.06] pt-5">
        <p className="mb-3 text-center text-xs text-ink/45">
          {isSignup ? "Already have an account?" : "No account yet?"}
        </p>
        <Link
          href={isSignup ? "/login?from=landing" : "/signup?from=landing"}
          className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-ink/15 px-4 text-sm font-semibold text-ink/90 transition-colors duration-200 hover:border-amber/40 hover:bg-ink/[0.04] hover:text-amber"
        >
          {isSignup ? "Log in instead" : "Create account"}
        </Link>
      </div>
    </div>
  );
}
