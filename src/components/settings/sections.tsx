"use client";

// The Settings sections, each shown on its own page under /app/settings:
// language and currency (/language), reminders (/reminders), dashboard sections
// (/dashboard), categories (/categories) and the account (/account).
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, BellRing, Loader2, KeyRound, Eraser } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { useAppData } from "@/hooks/use-app-data";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type Kind } from "@/types";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-sections";
import { CURRENCIES } from "@/lib/currency";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency, tintText, vivid } from "@/lib/utils";
import { SortableList } from "@/components/ui/sortable-list";
import { CategoryIcon } from "@/components/ui/category-icon";
import { CATEGORY_ICONS, categoryIconName } from "@/lib/category-icons";
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

// ---------------------------------------------------------------- notifications
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

/** Settings → Notifications: every kind of reminder and alert, each on or off —
 *  shared with the Android app — and notifications in this browser. */
export function NotificationsSection() {
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
    <section id="notifications" className="card scroll-mt-20 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        {tr("Reminders")}{" "}<span className="serif-italic text-amber/90">{tr("that help")}</span>
      </h2>
      <p className="mb-4 mt-1 max-w-lg text-sm text-ink/45">
        {tr("Turn off anything you don't want. Shown in the app here, as notifications on your phone (Android app) and — if you turn them on below — in this browser.")}
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
      <h3 className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-widest text-ink/40">{tr("Alerts")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle on={reminders.recurring} onChange={(v) => set({ recurring: v })} label={tr("Recurring entries")} hint={tr("When a salary, rent or subscription is added by itself")} />
        <Toggle on={reminders.moodSpend} onChange={(v) => set({ moodSpend: v })} label={tr("Mood & money")} hint={tr("When a low day comes with a lot of spending")} />
        <Toggle on={reminders.streaks} onChange={(v) => set({ streaks: v })} label={tr("Streaks")} hint={tr("Milestones, and when a streak is about to end")} />
        <Toggle on={reminders.challenges} onChange={(v) => set({ challenges: v })} label={tr("Challenges")} hint={tr("Won, missed, or on its last day")} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <span className="min-w-0 flex-1 text-sm text-ink/70">
          {tr("Notifications in this browser")}
          <span className="block text-[11px] text-ink/40">
            {push === "unsupported"
              ? tr("Not available here (or not set up on the server yet).")
              : push === "on"
                ? tr("On — reminders and recurring entries come here too, even with the tab closed.")
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
const passwordInput =
  "min-h-[44px] w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-hidden focus:border-amber/50";

/** Change the password: the current one (checked by signing in with it, which is
 *  also the "recent login" Supabase can ask for), then the new one twice.
 *  Google-only accounts have no password to change. */
function PasswordChange() {
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        const meta = data.user?.app_metadata ?? {};
        const providers: string[] = Array.isArray(meta.providers) ? meta.providers : [meta.provider ?? "email"];
        setHasPassword(providers.includes("email"));
      });
  }, []);

  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setAgain("");
    setError("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = !current
      ? tr("Type your current password.")
      : next.length < 8
        ? tr("Use at least 8 characters.")
        : next !== again
          ? tr("The two passwords don't match.")
          : "";
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: wrong } = await supabase.auth.signInWithPassword({ email: email ?? "", password: current });
      if (wrong) {
        throw new Error(wrong.code === "invalid_credentials" || /invalid login/i.test(wrong.message) ? tr("The current password is wrong.") : wrong.message);
      }
      const { error: failed } = await supabase.auth.updateUser({ password: next });
      if (failed) throw new Error(failed.message);
      close();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-sm text-ink/75">
          {tr("Password")}
          <span className="block text-[11px] text-ink/45">
            {!hasPassword
              ? tr("You sign in with Google, so there's no password to change. To add one, sign out and use “Forgot password?” on the login page.")
              : done
                ? tr("Password changed.")
                : tr("Change it any time — you'll need the current one.")}
          </span>
        </span>
        {hasPassword && !open && (
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink/75 transition-colors hover:bg-ink/[0.04]"
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {tr("Change password")}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={(e) => void save(e)} className="mt-4 grid max-w-sm gap-2">
          <div className="relative">
            <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={tr("Current password")} aria-label={tr("Current password")} className={passwordInput} />
          </div>
          <div className="relative">
            <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={tr("New password (min 8)")} aria-label={tr("New password (min 8)")} className={passwordInput} />
          </div>
          <div className="relative">
            <PasswordInput autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder={tr("Type it again")} aria-label={tr("Type it again")} className={passwordInput} />
          </div>
          {error && (
            <p className="text-xs text-expense" role="alert">
              {error}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tr("Change password")}
            </button>
            <button type="button" onClick={close} className="min-h-[40px] cursor-pointer rounded-xl px-3 text-sm text-ink/60 hover:bg-ink/[0.04]">
              {tr("Cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

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
      <p className="mt-1 text-sm text-ink/45">{tr("Signed in as {email}.", { email: email ?? "…" })}</p>
      <PasswordChange />
      <EraseData />
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

/** Erase my data: every entry goes, the account stays (login and settings) — for
 *  starting over, or handing the account back clean after a try-out. */
function EraseData() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const erase = async () => {
    if (confirm !== "ERASE" || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/erase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Couldn't erase your data — try again."));
      // The zakat figures live with the account's settings; this browser's notes about what it already said go too.
      await createClient().auth.updateUser({ data: { zakat: null } }).catch(() => undefined);
      try {
        for (const key of Object.keys(localStorage)) {
          if (/^(zakat|challenge-notified|streak-celebrated|mood-spend:|budget-alerts:|board:)/.test(key)) localStorage.removeItem(key);
        }
      } catch {
        /* ignore */
      }
      // Start over with a fresh load (it sets up the default categories and wallets again).
      window.location.assign("/app/settings/account?erased=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Couldn't erase your data — try again."));
      setBusy(false);
    }
  };

  const [done, setDone] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("erased") === "1") {
      setDone(true);
      window.history.replaceState(null, "", "/app/settings/account");
    }
  }, []);

  return (
    <div className="mt-5 rounded-xl border border-amber/30 bg-amber/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-sm text-ink/75">
          {tr("Erase my data")}
          <span className="block text-[11px] text-ink/45">
            {done
              ? tr("Done — everything you recorded is gone. Your account and settings are still here.")
              : tr("Deletes every entry, mood, wallet, bill, goal, board and journal note, but keeps your account, password and settings — for starting fresh. This can't be undone.")}
          </span>
        </span>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-amber/50 px-4 text-sm font-semibold text-amber transition-colors hover:bg-amber/10"
          >
            <Eraser className="h-4 w-4" aria-hidden />{" "}{tr("Erase…")}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={tr("Type ERASE")}
            aria-label={tr("Type ERASE to confirm")}
            className="min-h-[40px] w-40 rounded-lg border border-line bg-card px-3 font-mono text-sm text-ink outline-hidden focus:border-amber/50"
          />
          <button
            type="button"
            onClick={() => void erase()}
            disabled={confirm !== "ERASE" || busy}
            className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tr("Erase my data")}
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
  );
}

// Show / hide each of the dashboard's sections. Hiding never touches data.
export function DashboardSections() {
  const { dashboardHidden, setDashboardHidden, dashboardOrder, setDashboardOrder } = useAppData();
  const hidden = dashboardHidden ?? [];
  const shownCount = DASHBOARD_SECTIONS.length - hidden.length;
  const rows = dashboardOrder.map((id) => DASHBOARD_SECTIONS.find((s) => s.id === id)!).filter(Boolean);
  const isDefaultOrder = dashboardOrder.every((id, i) => id === DASHBOARD_SECTIONS[i].id);

  return (
    <section id="dashboard" className="card scroll-mt-20 p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          {tr("Dashboard")}{" "}<span className="serif-italic text-amber/90">{tr("sections")}</span>
        </h2>
        <div className="flex items-center gap-3">
          {!isDefaultOrder && (
            <button
              onClick={() => setDashboardOrder(DASHBOARD_SECTIONS.map((s) => s.id))}
              className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 transition-colors hover:text-amber"
            >
              {tr("Default order")}
            </button>
          )}
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
        {tr("Choose what the dashboard shows, and drag the sections into the order you want — the ones you care about most at the top. Hidden sections keep all their data.")}
      </p>

      <SortableList
        items={rows}
        onReorder={(ids) => setDashboardOrder(ids as typeof dashboardOrder)}
        label={tr("Dashboard sections")}
        itemLabel={(s) => tr(s.label)}
        className="space-y-2"
        renderItem={(s, { handle, arrows, dragging }) => {
          const on = !hidden.includes(s.id);
          return (
            <div className={cn("flex items-center gap-1 rounded-xl border bg-card pl-1 pr-1.5", on ? "border-line" : "border-dashed border-line", dragging && "border-amber/40")}>
              {handle}
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={dashboardHidden === null}
                onClick={() =>
                  setDashboardHidden(on ? [...hidden, s.id] : hidden.filter((id) => id !== s.id))
                }
                className="flex min-h-[56px] min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-200 hover:bg-ink/[0.03] disabled:cursor-default disabled:opacity-50"
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
              {arrows}
            </div>
          );
        }}
      />
    </section>
  );
}

export function CategorySection({ kind }: { kind: Kind }) {
  const { categories, createCategory, editCategory, removeCategory, reorderCategories, pushToast } = useAppData();
  const list = categories.filter((c) => c.kind === kind);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [icon, setIcon] = useState<string | null>(null); // null = picked from the name
  const [picking, setPicking] = useState<string | null>(null); // a category's id, or "new"
  const [adding, setAdding] = useState(false);

  // Icons need the 1.6 database update (categories.icon); say so instead of failing quietly.
  const failed = (err: unknown) =>
    pushToast({
      tone: "warn",
      message: /icon/i.test(String((err as { message?: unknown })?.message ?? ""))
        ? tr("Category icons need the database update — run db/supabase.sql in Supabase.")
        : tr("Couldn't save that — try again."),
    });

  const add = async () => {
    const n = name.trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      // First in its list: below the lowest sort number of its kind.
      const first = list.length ? Math.min(...list.map((c) => c.sort)) - 1 : 0;
      await createCategory({ name: n, kind, color, sort: first, icon });
      setName("");
      setIcon(null);
      setPicking(null);
    } catch (err) {
      failed(err);
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
      let i = list.length ? Math.max(...list.map((c) => c.sort)) + 1 : 0; // after everything else
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
        <h2 className="font-display text-xl font-semibold text-ink">{kind === "expense" ? tr("Expense") : tr("Income")}</h2>
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

      {/* add new — on top, so a new category lands where you can see it */}
      <div className="mb-4 rounded-xl border border-dashed border-line p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPicking(picking === "new" ? null : "new")}
            aria-expanded={picking === "new"}
            aria-label={tr("Choose an icon")}
            title={tr("Choose an icon")}
            className="cursor-pointer rounded-lg ring-amber/50 hover:ring-2"
          >
            <CategoryIcon name={name || "—"} icon={icon} color={color} size="lg" />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={tr("New {kind} category", { kind: tr(kind) })}
            maxLength={LIMITS.name}
            aria-label={tr("New {kind} category name", { kind: tr(kind) })}
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
        {picking === "new" && <IconPicker name={name || "—"} value={icon} color={color} onPick={(v) => { setIcon(v); setPicking(null); }} />}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              onClick={() => setColor(s)}
              aria-label={tr("Pick color {s}", { s })}
              className={cn(
                "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110",
              )}
              style={{ backgroundColor: vivid(s) }}
            >
              {color === s && <Check className="h-3.5 w-3.5 text-white" aria-hidden strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-[11px] text-ink/45">{tr("Drag to put them in the order you want — the entry screen lists them the same way.")}</p>
      <SortableList
        items={list}
        onReorder={(ids) => reorderCategories(ids).catch(failed)}
        label={tr("{kind} categories", { kind: tr(kind) })}
        itemLabel={(c) => tr(c.name)}
        className="space-y-2"
        renderItem={(c, { handle, arrows, dragging }) => (
          <div className={cn("rounded-xl border border-line bg-card", dragging && "border-amber/40")}>
            <div className="flex items-center gap-1.5 p-1.5 pr-1">
              {handle}
              <button
                type="button"
                onClick={() => setPicking(picking === c.id ? null : c.id)}
                aria-expanded={picking === c.id}
                aria-label={tr("Change the icon of {name}", { name: tr(c.name) })}
                title={tr("Change the icon")}
                className="cursor-pointer rounded-lg ring-amber/50 hover:ring-2"
              >
                <CategoryIcon name={c.name} icon={c.icon} color={c.color} />
              </button>
              <input
                defaultValue={c.name}
                maxLength={LIMITS.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) editCategory(c.id, { name: v }).catch(failed);
                }}
                aria-label={tr("Rename {name}", { name: c.name })}
                className="w-0 min-w-0 flex-1 bg-transparent text-sm text-ink/85 outline-hidden focus:text-ink"
              />
              <div className="hidden items-center gap-1 sm:flex">
                {SWATCHES.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => editCategory(c.id, { color: s }).catch(failed)}
                    aria-label={tr("Set color {s}", { s })}
                    className="h-4 w-4 cursor-pointer rounded-full ring-offset-1 ring-offset-card transition-transform hover:scale-125"
                    style={{ backgroundColor: vivid(s), boxShadow: c.color === s ? `0 0 0 2px ${vivid(s)}` : undefined }}
                  />
                ))}
              </div>
              <button
                onClick={() => removeCategory(c.id).catch(failed)}
                aria-label={tr("Delete {name}", { name: c.name })}
                className="cursor-pointer rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-ink/5 hover:text-expense"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
              {arrows}
            </div>
            {picking === c.id && (
              <div className="border-t border-line px-2 pb-2">
                <IconPicker
                  name={c.name}
                  value={c.icon ?? null}
                  color={c.color}
                  onPick={(v) => {
                    setPicking(null);
                    editCategory(c.id, { icon: v }).catch(failed);
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                  {SWATCHES.map((s) => (
                    <button
                      key={s}
                      onClick={() => editCategory(c.id, { color: s }).catch(failed)}
                      aria-label={tr("Set color {s}", { s })}
                      className="h-6 w-6 cursor-pointer rounded-full"
                      style={{ backgroundColor: vivid(s), boxShadow: c.color === s ? `0 0 0 2px rgb(var(--c-card)), 0 0 0 4px ${vivid(s)}` : undefined }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}

/** Every icon a category can have, plus Auto (picked from its name). */
function IconPicker({ name, value, color, onPick }: { name: string; value: string | null; color: string; onPick: (icon: string | null) => void }) {
  const auto = categoryIconName(name, null);
  return (
    <div className="mt-3 grid grid-cols-7 gap-1.5 sm:grid-cols-9" role="radiogroup" aria-label={tr("Icon")}>
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => onPick(null)}
        title={tr("Auto — from the name")}
        aria-label={tr("Auto — from the name")}
        className={cn("flex h-10 cursor-pointer flex-col items-center justify-center rounded-lg border text-[9px] font-semibold uppercase tracking-wide", !value ? "border-amber/60 bg-amber/10 text-ink" : "border-line text-ink/50 hover:bg-ink/[0.04]")}
      >
        {tr("Auto")}
      </button>
      {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(key)}
            title={key}
            aria-label={key.replace(/-/g, " ")}
            className={cn("flex h-10 cursor-pointer items-center justify-center rounded-lg border", on ? "border-amber/60 bg-amber/10" : key === auto && !value ? "border-dashed border-amber/40" : "border-line hover:bg-ink/[0.04]")}
            style={{ color: tintText(color) }}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
