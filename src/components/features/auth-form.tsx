"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setRemember } from "@/lib/supabase/remember";
import { PasswordInput } from "@/components/ui/password-input";
import { tr } from "@/lib/i18n";

import { LangToggle, useStoredLang } from "@/components/features/lang-toggle";
import { Logo } from "@/components/ui/logo";
// Shown once Google is set up in Supabase (Auth → Providers → Google) and
// NEXT_PUBLIC_GOOGLE_SIGN_IN=on is set for the site.
const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "on";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [lang, changeLang] = useStoredLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Remember me: on unless this browser was last told not to.
  const [remember, setRememberState] = useState(true);
  useEffect(() => {
    try {
      setRememberState(localStorage.getItem("remember") !== "0");
    } catch {
      /* ignore */
    }
  }, []);
  const chooseRemember = (on: boolean) => {
    setRememberState(on);
    try {
      localStorage.setItem("remember", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const isSignup = mode === "signup";

  // The proxy has already enforced "must come from landing". Once we land here,
  // strip the ?from=landing query so a manual refresh has no param and the proxy
  // sends them back to the landing page. A failed Google sign-in arrives with ?error=.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const failed = new URLSearchParams(window.location.search).get("error");
    if (failed) setError(failed);
    if (window.location.search.includes("from=landing")) {
      window.history.replaceState(null, "", isSignup ? "/signup" : "/login");
    }
  }, [isSignup]);

  // Google: Supabase sends the browser to Google and back to /auth/callback.
  const google = async () => {
    setError(null);
    setLoading(true);
    setRemember(remember);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      setRemember(remember);
      const supabase = createClient();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (data.session) {
          router.push("/app");
          router.refresh();
        } else {
          setNotice(tr("Account created. Check your email to confirm, then log in."));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/app");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Something went wrong."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass w-full max-w-sm rounded-2xl p-7" lang={lang}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={tr("Back to Catalyst home")}
          className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-amber/80 transition-colors hover:text-amber"
        >
          <Logo size={22} />
          {tr("Catalyst")}
        </Link>
        <LangToggle lang={lang} onChange={changeLang} />
      </div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
        {isSignup ? tr("Create account") : tr("Welcome back")}
      </h1>
      <p className="mt-1.5 text-sm text-ink/50">
        {isSignup ? tr("Start mapping your money against your mood.") : tr("Log in to your dashboard.")}
      </p>

      {GOOGLE && (
        <>
          <button
            type="button"
            onClick={() => void google()}
            disabled={loading}
            className="mt-6 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-ink/15 px-4 text-sm font-semibold text-ink/90 transition-colors duration-200 hover:border-ink/30 hover:bg-ink/[0.04] disabled:opacity-50"
          >
            <GoogleMark />
            {tr("Continue with Google")}
          </button>
          <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-ink/30">
            <span className="h-px flex-1 bg-ink/10" />
            {tr("or with email")}
            <span className="h-px flex-1 bg-ink/10" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={GOOGLE ? "mt-4 space-y-3" : "mt-6 space-y-3"}>
        <label className="block">
          <span className="sr-only">{tr("Email")}</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="min-h-[44px] w-full rounded-xl border border-ink/10 bg-ink/[0.03] pl-10 pr-3 text-sm text-ink outline-hidden focus:border-neon-cyan/50"
            />
          </div>
        </label>
        <label className="block">
          <span className="sr-only">{tr("Password")}</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
            <PasswordInput
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={isSignup ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? tr("Create a password (min 8)") : tr("Password")}
              className="min-h-[44px] w-full rounded-xl border border-ink/10 bg-ink/[0.03] pl-10 text-sm text-ink outline-hidden focus:border-neon-cyan/50"
            />
          </div>
        </label>

        <div className="-mt-1 flex items-center justify-between gap-3">
          <label className="flex min-h-[32px] cursor-pointer items-center gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => chooseRemember(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[rgb(var(--c-accent))]"
            />
            {tr("Remember me")}
          </label>
          {!isSignup && (
            <Link href="/forgot" className="text-xs text-ink/45 transition-colors hover:text-amber">
              {tr("Forgot password?")}
            </Link>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-neon-rose/30 bg-neon-rose/10 px-3 py-2 text-xs text-neon-rose" role="alert">
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
          {isSignup ? tr("Sign up") : tr("Log in")}
        </button>
      </form>

      <div className="mt-6 border-t border-ink/[0.06] pt-5">
        <p className="mb-3 text-center text-xs text-ink/45">
          {isSignup ? tr("Already have an account?") : tr("No account yet?")}
        </p>
        <Link
          href={isSignup ? "/login?from=landing" : "/signup?from=landing"}
          className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-ink/15 px-4 text-sm font-semibold text-ink/90 transition-colors duration-200 hover:border-amber/40 hover:bg-ink/[0.04] hover:text-amber"
        >
          {isSignup ? tr("Log in instead") : tr("Create account")}
        </Link>
      </div>
    </div>
  );
}
