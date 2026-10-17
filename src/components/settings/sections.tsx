"use client";

// The Settings sections, each shown on its own page under /app/settings:
// language and currency (/language), reminders (/reminders), dashboard sections
// (/dashboard), categories (/categories) and the account (/account).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, BellRing, Loader2 } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type Kind } from "@/types";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-sections";
import { CURRENCIES } from "@/lib/currency";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency, tintText } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { tr } from "@/lib/i18n";

const SWATCHES = [
  "#C06A33", "#2E8159", "#3D80BC", "#7A4E86", "#B59A3C", "#CB453B",
  "#4C5B82", "#8E5B6E", "#A6694A", "#2F6F6B", "#7A746A",
];

// ---------------------------------------------------------------- language
export function LanguageSection() {
  const { lang, setLanguage } = useAppData();
  return (
    <section id="language" className="card scroll-mt-20 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        {tr("Language")} <span className="serif-italic text-amber/90">{tr("& words")}</span>
      </h2>
      <p className="mb-4 mt-1 max-w-lg text-sm text-ink/45">{tr("The app, the web and your AI summaries follow this.")}</p>
      <div className="inline-flex gap-1 rounded-xl border border-line bg-ink/[0.02] p-1" role="radiogroup" aria-label={tr("Language")}>
        {(["en", "bn"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            lang={l}
            onClick={() => setLanguage(l)}
            className={cn(
              "min-h-[40px] cursor-pointer rounded-lg px-4 text-sm font-medium transition-colors duration-200",
              lang === l ? "bg-ink/[0.06] text-ink" : "text-ink/50 hover:text-ink/80",
            )}
          >
            {l === "bn" ? "বাংলা" : "English"}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- currency
export function CurrencySection() {
  const { currency, setCurrencyCode } = useAppData();
  return (
    <section id="currency" className="card scroll-mt-20 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        {tr("Currency")}{" "}<span className="serif-italic text-amber/90">{tr("& money")}</span>
      </h2>
      <p className="mb-4 mt-1 max-w-lg text-sm text-ink/45">
        {tr("How amounts are written everywhere — here and in the Android app. It doesn't convert anything: your entries keep their numbers.")}
      </p>
      <select
        value={currency}
        onChange={(e) => setCurrencyCode(e.target.value)}
        aria-label={tr("Currency")}
        className="min-h-[44px] w-full max-w-sm cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink outline-hidden focus:border-amber/50"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-card">
            {c.symbol.trim()} · {tr(c.name)} ({c.code})
          </option>
        ))}
      </select>
      <p className="mt-2 font-mono text-xs text-ink/40">{tr("Example: {amount}", { amount: formatCurrency(125000.5) })}</p>
    </section>
  );
}

// ---------------------------------------------------------------- reminders
function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-ink/[0.02] px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink/85">{label}</span>
        <span className="block text-[11px] text-ink/40">{hint}</span>
      </span>
      <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-amber/70" : "bg-ink/20")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-xs transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function RemindersSection() {
  const { reminders, setReminders } = useAppData();
  const set = (patch: Partial<typeof reminders>) => setReminders({ ...reminders, ...patch });
  const [push, setPush] = useState<"unsupported" | "off" | "on" | "busy">("off");
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    if (!pushSupported()) return setPush("unsupported");
    pushEnabled()
      .then((on) => setPush(on ? "on" : "off"))
      .catch(() => setPush("off"));
  }, []);

  const togglePush = async () => {
    setPushError("");
    const was = push;
    setPush("busy");
    try {
      if (was === "on") {
        await disablePush();
        setPush("off");
      } else {
        await enablePush();
        setPush("on");
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : tr("Couldn't change notifications."));
      setPush(was);
    }
  };

  return (
    <section id="reminders" className="card scroll-mt-20 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        {tr("Reminders")}{" "}<span className="serif-italic text-amber/90">{tr("that help")}</span>
      </h2>
      <p className="mb-4 mt-1 max-w-lg text-sm text-ink/45">
        {tr("Shown at the top of the app here, and as notifications on your phone (Android app) and — if you turn them on below — in this browser.")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle on={reminders.checkin} onChange={(v) => set({ checkin: v })} label={tr("Evening check-in")} hint={tr("“How was today?” if no mood is logged")} />
        <div className={cn("flex min-h-[56px] items-center gap-3 rounded-xl border border-line px-3", !reminders.checkin && "opacity-50")}>
          <span className="flex-1 text-sm text-ink/70">{tr("Check-in time")}</span>
          <input
            type="time"
            value={reminders.checkinTime}
            disabled={!reminders.checkin}
            onChange={(e) => e.target.value && set({ checkinTime: e.target.value })}
            aria-label={tr("Check-in time")}
            className="min-h-[40px] rounded-lg border border-line bg-card px-2 text-sm text-ink outline-hidden focus:border-amber/50"
          />
        </div>
        <Toggle on={reminders.bills} onChange={(v) => set({ bills: v })} label={tr("Bills")} hint={tr("The day before a bill is due, and when it's late")} />
        <Toggle on={reminders.budgets} onChange={(v) => set({ budgets: v })} label={tr("Budgets")} hint={tr("When a category reaches 80% and 100%")} />
        <Toggle on={reminders.dhar} onChange={(v) => set({ dhar: v })} label={tr("Dhar")} hint={tr("The day before money lent or borrowed is due back")} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <span className="min-w-0 flex-1 text-sm text-ink/70">
          {tr("Notifications in this browser")}
          <span className="block text-[11px] text-ink/40">
            {push === "unsupported"
              ? tr("Not available here (or not set up on the server yet).")
              : push === "on"
                ? tr("On — you'll get the evening reminder here.")
                : tr("Off — reminders only show inside the app.")}
          </span>
        </span>
        {push !== "unsupported" && (
          <button
            type="button"
            onClick={() => void togglePush()}
            disabled={push === "busy"}
            className={cn(
              "inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50",
              push === "on" ? "border border-line text-ink/75 hover:bg-ink/[0.04]" : "entry-btn text-paper",
            )}
          >
            <BellRing className="h-4 w-4" aria-hidden />
            {push === "on" ? tr("Turn off") : tr("Turn on")}
          </button>
        )}
      </div>
      {pushError && (
        <p className="mt-2 text-xs text-expense" role="alert">
          {pushError}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- account
export function AccountSection() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const remove = async () => {
    if (confirm !== "DELETE" || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Couldn't delete the account."));
      await createClient().auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Couldn't delete the account."));
      setBusy(false);
    }
  };

  return (
    <section id="account" className="card scroll-mt-20 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        {tr("Your")}{" "}<span className="serif-italic text-amber/90">{tr("account")}</span>
      </h2>
      <p className="mt-1 text-sm text-ink/45">
        {tr("Signed in as {email}. To change your password, sign out and use “Forgot password?” on the login page.", { email: email ?? "…" })}
      </p>
      <div className="mt-5 rounded-xl border border-expense/30 bg-expense/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1 text-sm text-ink/75">
            {tr("Delete account")}
            <span className="block text-[11px] text-ink/45">
              {tr("Permanently removes your account and everything in it — entries, moods, boards, wallets, dhar. This can't be undone.")}
            </span>
          </span>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-expense/40 px-4 text-sm font-semibold text-expense transition-colors hover:bg-expense/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden />{" "}{tr("Delete…")}
            </button>
          )}
        </div>
        {open && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={tr("Type DELETE")}
              aria-label={tr("Type DELETE to confirm")}
              className="min-h-[40px] w-40 rounded-lg border border-line bg-card px-3 font-mono text-sm text-ink outline-hidden focus:border-expense/50"
            />
            <button
              type="button"
              onClick={() => void remove()}
              disabled={confirm !== "DELETE" || busy}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl bg-expense px-4 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tr("Delete my account")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
              className="min-h-[40px] cursor-pointer rounded-xl px-3 text-sm text-ink/60 hover:bg-ink/[0.04]"
            >
              {tr("Cancel")}
            </button>
          </div>
        )}
        {error && (
          <p className="mt-2 text-xs text-expense" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

// Show / hide each of the dashboard's sections. Hiding never touches data.
export function DashboardSections() {
  const { dashboardHidden, setDashboardHidden } = useAppData();
  const hidden = dashboardHidden ?? [];
  const shownCount = DASHBOARD_SECTIONS.length - hidden.length;

  return (
    <section id="dashboard" className="card scroll-mt-20 p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          {tr("Dashboard")}{" "}<span className="serif-italic text-amber/90">{tr("sections")}</span>
        </h2>
        <div className="flex items-center gap-3">
          {hidden.length > 0 && (
            <button
              onClick={() => setDashboardHidden([])}
              className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 transition-colors hover:text-amber"
            >
              {tr("Show all")}
            </button>
          )}
          <span className="label">
            {shownCount} / {DASHBOARD_SECTIONS.length}
          </span>
        </div>
      </div>
      <p className="mb-4 max-w-lg text-sm text-ink/45">
        {tr("Choose what the dashboard shows. Hidden sections keep all their data — it's still recorded and comes back the moment you turn the section on.")}
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {DASHBOARD_SECTIONS.map((s) => {
          const on = !hidden.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={dashboardHidden === null}
                onClick={() =>
                  setDashboardHidden(on ? [...hidden, s.id] : hidden.filter((id) => id !== s.id))
                }
                className={cn(
                  "flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 disabled:cursor-default disabled:opacity-50",
                  on ? "border-line bg-ink/[0.02] hover:bg-ink/[0.04]" : "border-dashed border-line hover:bg-ink/[0.02]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", on ? "text-ink/85" : "text-ink/45")}>{tr(s.label)}</span>
                  <span className="block truncate text-[11px] text-ink/35">{tr(s.hint)}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    on ? "bg-amber/70" : "bg-ink/20",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-xs transition-all",
                      on ? "left-[18px]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CategorySection({ kind }: { kind: Kind }) {
  const { categories, createCategory, editCategory, removeCategory } = useAppData();
  const list = categories.filter((c) => c.kind === kind);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [adding, setAdding] = useState(false);

  const add = async () => {
    const n = name.trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      await createCategory({ name: n, kind, color, sort: list.length });
      setName("");
    } finally {
      setAdding(false);
    }
  };

  const restoreDefaults = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const defaults = kind === "expense" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
      const have = new Set(list.map((c) => c.name.toLowerCase()));
      let i = list.length;
      for (const d of defaults) {
        if (have.has(d.name.toLowerCase())) continue;
        await createCategory({ name: d.name, kind, color: d.color, sort: i++ });
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card min-w-0 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold capitalize text-ink">{kind}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={restoreDefaults}
            disabled={adding}
            className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 transition-colors hover:text-amber disabled:opacity-40"
          >
            {tr("Restore defaults")}
          </button>
          <span className="label">{list.length}</span>
        </div>
      </div>

      <ul className="mb-4 space-y-2">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink/[0.02] p-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ backgroundColor: `${c.color}22`, color: tintText(c.color) }}
            >
              {c.name.slice(0, 1).toUpperCase()}
            </span>
            <input
              defaultValue={c.name}
              maxLength={LIMITS.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) editCategory(c.id, { name: v });
              }}
              aria-label={tr("Rename {name}", { name: c.name })}
              className="w-0 min-w-0 flex-1 bg-transparent text-sm text-ink/85 outline-hidden focus:text-ink"
            />
            <div className="flex items-center gap-1">
              {SWATCHES.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => editCategory(c.id, { color: s })}
                  aria-label={tr("Set color {s}", { s })}
                  className="h-4 w-4 cursor-pointer rounded-full ring-offset-1 ring-offset-card transition-transform hover:scale-125"
                  style={{ backgroundColor: s, boxShadow: c.color === s ? `0 0 0 2px ${s}` : undefined }}
                />
              ))}
            </div>
            <button
              onClick={() => removeCategory(c.id)}
              aria-label={tr("Delete {name}", { name: c.name })}
              className="cursor-pointer rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-ink/5 hover:text-expense"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {/* add new */}
      <div className="rounded-xl border border-dashed border-line p-3">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={tr("New {kind} category", { kind })}
            maxLength={LIMITS.name}
            aria-label={tr("New {kind} category name", { kind })}
            className="min-h-[40px] w-0 min-w-0 flex-1 rounded-lg border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50"
          />
          <button
            onClick={add}
            disabled={!name.trim() || adding}
            aria-label={tr("Add category")}
            className="entry-btn flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-paper disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              onClick={() => setColor(s)}
              aria-label={tr("Pick color {s}", { s })}
              className={cn(
                "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110",
              )}
              style={{ backgroundColor: s }}
            >
              {color === s && <Check className="h-3.5 w-3.5 text-paper" aria-hidden strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
