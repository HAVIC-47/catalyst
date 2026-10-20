"use client";

// Forgot password (email a reset link) and Reset password (set a new one after
// following that link — the link signs you in for this one purpose).
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/ui/password-input";
import { tr } from "@/lib/i18n";
import { useStoredLang } from "@/components/features/lang-toggle";
import { Logo } from "@/components/ui/logo";

const input =
  "min-h-[44px] w-full rounded-xl border border-ink/10 bg-ink/[0.03] pl-10 pr-3 text-sm text-ink outline-hidden focus:border-neon-cyan/50";

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="glass w-full max-w-sm rounded-2xl p-7">
      <Link
        href="/"
        aria-label={tr("Back to Catalyst home")}
        className="mb-6 inline-flex cursor-pointer items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-amber/80 transition-colors hover:text-amber"
      >
        <Logo size={22} />
        {tr("Catalyst")}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-1.5 text-sm text-ink/50">{sub}</p>
      {children}
    </div>
  );
}

function Message({ error, notice }: { error?: string | null; notice?: string | null }) {
  return (
    <>
      {error && (
        <p className="rounded-lg border border-neon-rose/30 bg-neon-rose/10 px-3 py-2 text-xs text-neon-rose" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2 text-xs text-neon-cyan" role="status">
          {notice}
        </p>
      )}
    </>
  );
}

export function ForgotForm() {
  useStoredLang();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A link that didn't work comes back here with ?error=.
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setError(e);
  }, []);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
      });
      if (error) throw error;
      setNotice(tr("If that email has an account, a reset link is on its way. Open it on this device."));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Couldn't send the email — try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={tr("Forgot password")} sub={tr("We'll email you a link to set a new one.")}>
      <form onSubmit={submit} className="mt-6 space-y-3">
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
              className={input}
            />
          </div>
        </label>
        <Message error={error} notice={notice} />
        <button
          type="submit"
          disabled={loading}
          className="entry-btn inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {tr("Send reset link")}
        </button>
      </form>
      <p className="mt-6 border-t border-ink/[0.06] pt-5 text-center text-xs text-ink/45">
        {tr("Remembered it?")}{" "}
        <Link href="/login?from=landing" className="text-amber hover:underline">
          {tr("Log in")}
        </Link>
      </p>
    </Card>
  );
}

export function ResetForm() {
  useStoredLang();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [ready, setReady] = useState<boolean | null>(null); // null = checking the link's session
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setReady(!!data.user));
  }, []);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (password.length < 8) return setError(tr("Use at least 8 characters."));
    if (password !== again) return setError(tr("The two passwords don't match."));
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Couldn't save the password — try again."));
      setLoading(false);
    }
  };

  if (ready === false) {
    return (
      <Card title={tr("Link expired")} sub={tr("This reset link has expired or was already used.")}>
        <Link
          href="/forgot"
          className="entry-btn mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-paper shadow-entry"
        >
          {tr("Send a new link")}
        </Link>
      </Card>
    );
  }

  return (
    <Card title={tr("New password")} sub={tr("Choose a new password for your account.")}>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {(["New password (min 8)", "Type it again"] as const).map((placeholder, i) => (
          <label key={placeholder} className="block">
            <span className="sr-only">{tr(placeholder)}</span>
            <div className="relative">
              {i === 0 ? (
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
              ) : (
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
              )}
              <PasswordInput
                autoComplete="new-password"
                required
                minLength={8}
                value={i === 0 ? password : again}
                onChange={(e) => (i === 0 ? setPassword(e.target.value) : setAgain(e.target.value))}
                placeholder={tr(placeholder)}
                className={input}
              />
            </div>
          </label>
        ))}
        <Message error={error} />
        <button
          type="submit"
          disabled={loading || ready === null}
          className="entry-btn inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {tr("Save and continue")}
        </button>
      </form>
    </Card>
  );
}
